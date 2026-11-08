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

// Web-safe copies: every product image is stored on Cloudinary already shrunk to WEB_MAX_PX on its
// long side with the TDS watermark burned in (an "incoming transformation"), so the full-size original
// never exists on Cloudinary for these. This is done per upload, NOT with account-wide settings like
// strict transformations, so nothing else on the shared Cloudinary account (e.g. KAC) is affected.
// Changing the watermark or size? Bump the -vN suffixes and every image re-uploads on the next build.
const WEB_PREFIX = 'TysonDrawsStuff/web-v2'; // v2: watermark moved to bottom centre
const WATERMARK_ID = 'TysonDrawsStuff/brand/watermark-v1';
const WATERMARK_FILE = path.join(PUBLIC_DIR, 'brand', 'tds-watermark.png');
const WEB_MAX_PX = 1600;
const UPLOAD_CACHE_FILE = path.join(__dirname, '..', 'node_modules', '.cache', 'tds-cloudinary-uploads.json');
const WEB_TRANSFORMATION = [
  { width: WEB_MAX_PX, height: WEB_MAX_PX, crop: 'limit' },
  { overlay: WATERMARK_ID.replace(/\//g, ':'), width: 0.4, flags: 'relative', opacity: 55 },
  // Bottom-centre: Tyson signs bottom-left or bottom-right, so the corners stay clear
  { flags: 'layer_apply', gravity: 'south', y: 0.03 },
  { quality: 'auto:good' },
];

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

// IMPORTANT: never call cloudinary.api.* (the Admin API) per image. It is capped at 500 calls/hour for the
// WHOLE Cloudinary account (shared with KAC); a few builds in a row used it up and every image failed.
// Instead we use the Upload API with overwrite:false, which isn't rate limited that way: if the asset
// already exists Cloudinary skips the upload and just returns the existing asset's details.

// Make sure the watermark image exists on Cloudinary (uploaded once from public/brand/)
async function ensureWatermark() {
  await cloudinary.uploader.upload(WATERMARK_FILE, { public_id: WATERMARK_ID, overwrite: false, resource_type: 'image' });
}

// Upload a web-safe (shrunk + watermarked) copy to Cloudinary, or get the existing one.
// Returns { url, width, height } of the stored copy.
async function uploadToCloudinary(imageUrl, publicId) {
  const options = {
    public_id: publicId, overwrite: false, resource_type: 'image',
    format: 'jpg', transformation: WEB_TRANSFORMATION,
  };
  const done = (result) => {
    console.log(result.existing
      ? `  ☁️  Already on Cloudinary: ${publicId}`
      : `  ✅ Uploaded (${result.width}×${result.height}, watermarked): ${result.secure_url}`);
    return { url: result.secure_url, width: result.width, height: result.height };
  };

  const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${STRAPI_URL}${imageUrl}`;
  // A public Strapi (Railway) can be fetched by Cloudinary directly; a local one can't, so stream it up.
  if (/^https:\/\//.test(fullUrl) && !/localhost|127\.0\.0\.1/.test(fullUrl)) {
    return done(await cloudinary.uploader.upload(fullUrl, options));
  }

  const buffer = await downloadImageToBuffer(imageUrl);
  return new Promise((resolve, reject) => {
    const { Readable } = require('stream');
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(new Error(error.message));
      else resolve(done(result));
    });
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
    // Remember what is already on Cloudinary between builds, so a normal build makes no Cloudinary calls
    // at all: only new or changed images get sent. node_modules/.cache survives between Vercel builds
    // (and between local runs); if it's ever empty, the overwrite:false uploads still just return the
    // existing copies, so the worst case is one round of cheap "already there" calls.
    let uploadCache = {};
    try { uploadCache = JSON.parse(await readFile(UPLOAD_CACHE_FILE, 'utf8')); } catch { /* first build */ }

    if (USE_CLOUDINARY && !uploadCache[WATERMARK_ID]) {
      await ensureWatermark();
      uploadCache[WATERMARK_ID] = { url: 'ok' };
    }

    // Load existing image-map so we can skip Cloudinary API calls for already-uploaded images
    let existingImageMap = {};
    try {
      existingImageMap = JSON.parse(await readFile(IMAGE_MAP_FILE, 'utf8'));
    } catch { /* first run or missing file — start fresh */ }

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
        const existingEntries = existingImageMap[slug] || [];
        for (let i = 0; i < images.length; i++) {
          const image = images[i];
          try {
            // If this image already has a Cloudinary URL in the local map, reuse it —
            // no API call needed, avoids rate limits on every build.
            // Match on the Strapi source URL, not position, so reordering images in Strapi takes effect.
            // Only reuse web-safe copies; older full-size uploads (without WEB_PREFIX) get replaced.
            const cached = existingEntries.find(e => e.originalUrl === image.url);
            if (cached && cached.url && cached.url.startsWith('https://res.cloudinary.com/') && cached.url.includes(`/${WEB_PREFIX}/`)) {
              console.log(`  ☁️  Cached: ${cached.url.split('/').slice(-2).join('/')}`);
              localImages.push({ ...cached, id: image.id, alternativeText: image.alternativeText || cached.alternativeText });
              totalProcessed++;
              continue;
            }

            // Name by the Strapi file hash (unique per upload) rather than position, otherwise an
            // existing "image-1" on Cloudinary gets reused even after the order changes
            const publicId = `${WEB_PREFIX}/products/${slug}/${image.hash || `image-${image.id}`}`;
            let uploaded = uploadCache[publicId];
            if (uploaded) {
              console.log(`  ☁️  Cached: ${publicId.split('/').slice(-2).join('/')}`);
            } else {
              uploaded = await uploadToCloudinary(image.url, publicId);
              uploadCache[publicId] = uploaded;
            }

            localImages.push({
              id: image.id,
              url: uploaded.url,
              alternativeText: image.alternativeText || '',
              width: uploaded.width || image.width || 800,
              height: uploaded.height || image.height || 600,
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
    if (USE_CLOUDINARY) {
      try {
        await mkdir(path.dirname(UPLOAD_CACHE_FILE), { recursive: true });
        await writeFile(UPLOAD_CACHE_FILE, JSON.stringify(uploadCache));
      } catch (error) {
        console.warn(`⚠️  Could not save upload cache: ${error.message}`);
      }
    }

    console.log('\n📝 Writing image map...');
    await writeFile(IMAGE_MAP_FILE, JSON.stringify(imageMap, null, 2));

    const mode = USE_CLOUDINARY ? '☁️  Cloudinary' : '📁 Local';
    console.log(`\n🎉 Image sync complete! (${mode})`);
    console.log(`   📊 Processed ${products.length} products`);
    console.log(`   ✅ ${totalProcessed} product images`);
    console.log(`   🎪 ${showLogoCount} show logos`);
    if (totalErrors > 0) console.log(`   ⚠️  ${totalErrors} failures`);

    // Never publish a site with missing paintings: fail the build so Vercel keeps the last good version.
    if (USE_CLOUDINARY && totalErrors > 0) {
      console.error(`💥 ${totalErrors} product image(s) failed to sync to Cloudinary. Failing the build so the previous deployment stays live.`);
      process.exit(1);
    }

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

module.exports = { syncImages, ensureWatermark, uploadToCloudinary, WEB_PREFIX };
