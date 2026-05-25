#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const rmdir = promisify(fs.rmdir);

// Configuration
const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1339';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PRODUCTS_DIR = path.join(PUBLIC_DIR, 'products');
const STATIC_DIR = path.join(PUBLIC_DIR, 'static');
const IMAGE_MAP_FILE = path.join(PUBLIC_DIR, 'image-map.json');

// Cloudinary configuration — when all three are set, images go to Cloudinary instead of local disk
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const USE_CLOUDINARY = !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);

const REQUEST_TIMEOUT = 30000;

console.log('🎨 Starting image sync process...');
console.log(`📡 Strapi URL: ${STRAPI_URL}`);
console.log(`☁️  Cloudinary: ${USE_CLOUDINARY ? `enabled (${CLOUDINARY_CLOUD_NAME})` : 'disabled — using local files'}`);

// Initialize Cloudinary SDK when configured
let cloudinary;
if (USE_CLOUDINARY) {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Download image into a memory buffer (so we can stream it to Cloudinary)
async function downloadImageToBuffer(imageUrl) {
  const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${STRAPI_URL}${imageUrl}`;
  const protocol = fullUrl.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const request = protocol.get(fullUrl, { timeout: REQUEST_TIMEOUT }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadImageToBuffer(response.headers.location).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });
    request.on('error', reject);
    request.on('timeout', () => { request.destroy(); reject(new Error('Download timeout')); });
  });
}

// Upload to Cloudinary, reusing the existing asset if already uploaded
async function uploadToCloudinary(imageUrl, publicId) {
  // Check if already exists so we don't re-upload on every build
  try {
    const resource = await cloudinary.api.resource(publicId);
    console.log(`  ☁️  Already uploaded: ${publicId}`);
    return resource.secure_url;
  } catch (err) {
    // SDK v2 puts the status at err.error.http_code, not err.http_code
    const httpCode = err.http_code ?? err.error?.http_code;
    if (httpCode && httpCode !== 404) {
      console.warn(`  ⚠️  Cloudinary check warning (${httpCode}): ${err.message ?? err.error?.message}`);
    }
    // 404 = not uploaded yet, anything else = log + try anyway
  }

  // Download locally first (Cloudinary can't reach localhost), then stream up
  console.log(`  📤 Uploading to Cloudinary: ${publicId}`);
  const buffer = await downloadImageToBuffer(imageUrl);

  // Split into folder + filename so Cloudinary creates visible folders in the media library
  const lastSlash = publicId.lastIndexOf('/');
  const folder = publicId.substring(0, lastSlash);
  const filename = publicId.substring(lastSlash + 1);

  return new Promise((resolve, reject) => {
    const { Readable } = require('stream');
    const uploadStream = cloudinary.uploader.upload_stream(
      { public_id: filename, folder, overwrite: true, resource_type: 'image', use_filename: false },
      (error, result) => {
        if (error) reject(new Error(error.message));
        else {
          console.log(`  ✅ Uploaded: ${result.secure_url}`);
          resolve(result.secure_url);
        }
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
}

// ── local-fallback helpers (used when Cloudinary is not configured) ──────────

function hasExistingImages() {
  return fs.existsSync(PRODUCTS_DIR) && fs.existsSync(IMAGE_MAP_FILE);
}

async function getExistingImageCount() {
  if (!fs.existsSync(PRODUCTS_DIR)) return 0;
  try {
    let count = 0;
    const dirs = await readdir(PRODUCTS_DIR);
    for (const dir of dirs) {
      const dirPath = path.join(PRODUCTS_DIR, dir);
      const dirStats = await stat(dirPath);
      if (dirStats.isDirectory()) {
        const files = await readdir(dirPath);
        count += files.length;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

async function downloadImage(imageUrl, filePath) {
  return new Promise((resolve, reject) => {
    const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${STRAPI_URL}${imageUrl}`;
    const protocol = fullUrl.startsWith('https') ? https : http;
    const request = protocol.get(fullUrl, { timeout: REQUEST_TIMEOUT }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadImage(response.headers.location, filePath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      const fileStream = fs.createWriteStream(filePath);
      response.pipe(fileStream);
      fileStream.on('finish', () => { fileStream.close(); resolve(); });
      fileStream.on('error', reject);
    });
    request.on('error', reject);
    request.on('timeout', () => { request.destroy(); reject(new Error('Image download timeout')); });
  });
}

function getImageExtension(url) {
  try {
    if (url.startsWith('/')) {
      const ext = path.extname(url);
      return ext || '.jpg';
    }
    const urlObj = new URL(url);
    const ext = path.extname(urlObj.pathname).toLowerCase();
    if (ext && ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return ext;
    return '.jpg';
  } catch {
    const match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    if (match && ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes('.' + match[1].toLowerCase())) {
      return '.' + match[1].toLowerCase();
    }
    return '.jpg';
  }
}

async function cleanOldProducts(currentSlugs) {
  try {
    if (!fs.existsSync(PRODUCTS_DIR)) return;
    const existingDirs = await readdir(PRODUCTS_DIR);
    for (const dir of existingDirs) {
      if (!currentSlugs.includes(dir)) {
        const dirPath = path.join(PRODUCTS_DIR, dir);
        try {
          const stats = await stat(dirPath);
          if (stats.isDirectory()) {
            console.log(`🗑️  Removing old product directory: ${dir}`);
            const files = await readdir(dirPath);
            for (const file of files) await unlink(path.join(dirPath, file));
            await rmdir(dirPath);
          }
        } catch (error) {
          console.warn(`⚠️  Could not remove directory ${dir}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.warn('⚠️  Error cleaning old products:', error.message);
  }
}

// ── Strapi helpers ────────────────────────────────────────────────────────────

async function fetchFromStrapi(endpoint) {
  const url = `${STRAPI_URL}/api/${endpoint}`;
  console.log(`📊 Fetching: ${url}`);
  const protocol = url.startsWith('https') ? https : http;
  const options = {
    timeout: REQUEST_TIMEOUT,
    headers: { 'Content-Type': 'application/json' },
  };
  if (STRAPI_API_TOKEN) options.headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;

  return new Promise((resolve, reject) => {
    const request = protocol.get(url, options, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (error) { reject(new Error(`Failed to parse JSON: ${error.message}`)); }
      });
    });
    request.on('error', reject);
    request.on('timeout', () => { request.destroy(); reject(new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`)); });
  });
}

// ── Fallback when Strapi is down ──────────────────────────────────────────────

async function useFallbackImages() {
  const existingCount = await getExistingImageCount();
  console.log('\n⚠️  Strapi unavailable — using existing images');

  if (existingCount > 0) {
    console.log(`📁 Found ${existingCount} existing images in /public/products/`);
    if (fs.existsSync(IMAGE_MAP_FILE)) {
      try {
        const existingMap = await readFile(IMAGE_MAP_FILE, 'utf8');
        const imageMapData = JSON.parse(existingMap);
        const productCount = Object.keys(imageMapData).length;
        console.log(`📝 Using existing image map with ${productCount} products`);
        console.log('✅ Build will continue with cached images');
        return true;
      } catch (error) {
        console.warn('⚠️  Could not read existing image map:', error.message);
      }
    }
    console.log('📝 Creating minimal image map for existing images');
    await writeFile(IMAGE_MAP_FILE, JSON.stringify({}, null, 2));
    return true;
  }

  console.log('📭 No existing images found');
  await mkdir(PUBLIC_DIR, { recursive: true });
  await mkdir(PRODUCTS_DIR, { recursive: true });
  await writeFile(IMAGE_MAP_FILE, JSON.stringify({}, null, 2));
  console.log('📝 Created empty image map — build will continue without images');
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function syncImages() {
  try {
    console.log('🔍 Checking Strapi connectivity...');

    let products = [];
    try {
      const productsResponse = await fetchFromStrapi('products?populate=*&pagination[limit]=100&sort=id:desc');
      products = productsResponse.data || [];
      console.log(`✅ Strapi connected — found ${products.length} products`);
    } catch (error) {
      console.log(`❌ Strapi connection failed: ${error.message}`);
      await useFallbackImages();
      return;
    }

    if (products.length === 0) {
      console.log('⚠️  No products found in Strapi');
      await useFallbackImages();
      return;
    }

    await mkdir(PUBLIC_DIR, { recursive: true });
    if (!USE_CLOUDINARY) await mkdir(PRODUCTS_DIR, { recursive: true });

    const imageMap = {};
    const currentSlugs = [];
    let totalProcessed = 0;
    let totalErrors = 0;

    for (const product of products) {
      const slug = product.slug;
      if (!slug) {
        console.warn('⚠️  Product missing slug:', product.title || product.id);
        continue;
      }

      currentSlugs.push(slug);
      console.log(`\n🖼️  Processing: ${product.title} (${slug})`);

      const images = product.images || [];
      const localImages = [];

      if (images.length === 0) {
        console.log('  📭 No images');
        imageMap[slug] = [];
        continue;
      }

      if (!USE_CLOUDINARY) {
        // Local mode: download to /public/products/
        const productDir = path.join(PRODUCTS_DIR, slug);
        await mkdir(productDir, { recursive: true });

        for (let i = 0; i < images.length; i++) {
          const image = images[i];
          try {
            const imageUrl = image.url;
            const extension = getImageExtension(imageUrl);
            const fileName = `image-${i + 1}${extension}`;
            const filePath = path.join(productDir, fileName);
            const publicPath = `/products/${slug}/${fileName}`;

            console.log(`  📥 Downloading: ${path.basename(imageUrl)}`);
            await downloadImage(imageUrl, filePath);
            console.log(`  ✅ Saved: ${fileName}`);

            localImages.push({
              id: image.id,
              url: publicPath,
              alternativeText: image.alternativeText || '',
              width: image.width || 800,
              height: image.height || 600,
              originalUrl: imageUrl,
            });
            totalProcessed++;
          } catch (error) {
            totalErrors++;
            console.error(`  ❌ Failed image ${i + 1}: ${error.message}`);
          }
        }
      } else {
        // Cloudinary mode: upload from Strapi URL, store Cloudinary URL
        for (let i = 0; i < images.length; i++) {
          const image = images[i];
          try {
            const publicId = `TysonDrawsStuff/products/${slug}/image-${i + 1}`;
            const cloudinaryUrl = await uploadToCloudinary(image.url, publicId);

            localImages.push({
              id: image.id,
              url: cloudinaryUrl,
              alternativeText: image.alternativeText || '',
              width: image.width || 800,
              height: image.height || 600,
              originalUrl: image.url,
            });
            totalProcessed++;
          } catch (error) {
            totalErrors++;
            console.error(`  ❌ Failed image ${i + 1}: ${error.message}`);
          }
        }
      }

      imageMap[slug] = localImages;
      console.log(`  ✅ Processed ${localImages.length}/${images.length} images`);
    }

    // Clean up stale local product dirs (local mode only)
    if (!USE_CLOUDINARY) {
      await cleanOldProducts(currentSlugs);
    }

    // Sync show logos to /public/static/ (always local — fewer files, not worth migrating)
    console.log('\n🎪 Syncing show logos...');
    let showLogoCount = 0;
    try {
      const showsResponse = await fetchFromStrapi('shows?populate=*');
      const shows = showsResponse.data || [];

      if (shows.length > 0) {
        await mkdir(STATIC_DIR, { recursive: true });
        for (const show of shows) {
          if (show.logo && show.logo.url) {
            try {
              const logoUrl = show.logo.url;
              const fileName = path.basename(logoUrl.split('?')[0]);
              const filePath = path.join(STATIC_DIR, fileName);
              console.log(`  📥 Downloading logo: ${show.title}`);
              await downloadImage(logoUrl, filePath);
              showLogoCount++;
            } catch (error) {
              console.error(`  ❌ Failed logo for ${show.title}: ${error.message}`);
            }
          }
        }
        console.log(`  ✅ Downloaded ${showLogoCount} show logos`);
      } else {
        console.log('  📭 No shows found');
      }
    } catch (error) {
      console.warn(`  ⚠️  Could not sync show logos: ${error.message}`);
    }

    // Write image map
    console.log('\n📝 Writing image map...');
    await writeFile(IMAGE_MAP_FILE, JSON.stringify(imageMap, null, 2));

    const mode = USE_CLOUDINARY ? '☁️  Cloudinary' : '📁 Local';
    console.log(`\n🎉 Image sync complete! (${mode})`);
    console.log(`   📊 Processed ${products.length} products`);
    console.log(`   ✅ ${totalProcessed} product images`);
    console.log(`   🎪 ${showLogoCount} show logos`);
    if (totalErrors > 0) console.log(`   ⚠️  ${totalErrors} failures`);

  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
    console.log('🔄 Attempting fallback...');
    await useFallbackImages();
  }
}

process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught exception:', error.message);
  await useFallbackImages();
  process.exit(0);
});

process.on('unhandledRejection', async (error) => {
  console.error('💥 Unhandled rejection:', error.message);
  await useFallbackImages();
  process.exit(0);
});

if (require.main === module) {
  syncImages().then(() => {
    console.log('✨ Sync finished');
    process.exit(0);
  }).catch(async (error) => {
    console.error('💥 Final error:', error.message);
    await useFallbackImages();
    process.exit(0);
  });
}

module.exports = { syncImages };
