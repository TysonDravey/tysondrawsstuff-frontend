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
const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PRODUCTS_DIR = path.join(PUBLIC_DIR, 'products');
const STATIC_DIR = path.join(PUBLIC_DIR, 'static');
const IMAGE_MAP_FILE = path.join(PUBLIC_DIR, 'image-map.json');

// Timeout for HTTP requests
const REQUEST_TIMEOUT = 15000; // Reduced timeout for faster failure detection

console.log('🎨 Starting image sync process...');
console.log(`📡 Strapi URL: ${STRAPI_URL}`);

// Check if existing images and map exist
function hasExistingImages() {
  return fs.existsSync(PRODUCTS_DIR) && fs.existsSync(IMAGE_MAP_FILE);
}

// Get count of existing images
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

// Fetch data from Strapi API with robust error handling
async function fetchFromStrapi(endpoint) {
  const url = `${STRAPI_URL}/api/${endpoint}`;
  console.log(`📊 Attempting to fetch: ${url}`);

  const protocol = url.startsWith('https') ? https : http;
  const options = {
    timeout: REQUEST_TIMEOUT,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (STRAPI_API_TOKEN) {
    options.headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;
  }

  return new Promise((resolve, reject) => {
    const request = protocol.get(url, options, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`));
    });
  });
}

// Download image from URL to file path
async function downloadImage(imageUrl, filePath) {
  return new Promise((resolve, reject) => {
    const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${STRAPI_URL}${imageUrl}`;

    const protocol = fullUrl.startsWith('https') ? https : http;
    const request = protocol.get(fullUrl, { timeout: REQUEST_TIMEOUT }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirects
        downloadImage(response.headers.location, filePath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const fileStream = fs.createWriteStream(filePath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', reject);
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Image download timeout'));
    });
  });
}

// Get file extension from URL
function getImageExtension(url) {
  try {
    // Handle relative URLs
    if (url.startsWith('/')) {
      const ext = path.extname(url);
      return ext || '.jpg';
    }

    // Parse full URLs
    const urlObj = new URL(url);
    const ext = path.extname(urlObj.pathname).toLowerCase();

    if (ext && ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      return ext;
    }

    return '.jpg'; // Default fallback
  } catch (error) {
    // If URL parsing fails, try to extract extension from string
    const match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    if (match && ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes('.' + match[1].toLowerCase())) {
      return '.' + match[1].toLowerCase();
    }
    return '.jpg';
  }
}

// Clean up old product directories that no longer exist
async function cleanOldProducts(currentSlugs) {
  try {
    if (!fs.existsSync(PRODUCTS_DIR)) {
      return;
    }

    const existingDirs = await readdir(PRODUCTS_DIR);

    for (const dir of existingDirs) {
      if (!currentSlugs.includes(dir)) {
        const dirPath = path.join(PRODUCTS_DIR, dir);

        try {
          const stats = await stat(dirPath);
          if (stats.isDirectory()) {
            console.log(`🗑️  Removing old product directory: ${dir}`);

            // Remove all files in directory first
            const files = await readdir(dirPath);
            for (const file of files) {
              await unlink(path.join(dirPath, file));
            }
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

// Fallback: Use existing images and image map
async function useFallbackImages() {
  const existingCount = await getExistingImageCount();

  console.log('\n⚠️  Strapi unavailable - using existing images');

  if (existingCount > 0) {
    console.log(`📁 Found ${existingCount} existing images in /public/products/`);

    // Verify image map exists
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

    // If images exist but no map, create empty map
    console.log('📝 Creating minimal image map for existing images');
    await writeFile(IMAGE_MAP_FILE, JSON.stringify({}, null, 2));
    console.log('✅ Build will continue with existing images');
    return true;
  } else {
    // No existing images - create empty map to prevent build errors
    console.log('📭 No existing images found');

    await mkdir(PUBLIC_DIR, { recursive: true });
    await mkdir(PRODUCTS_DIR, { recursive: true });
    await writeFile(IMAGE_MAP_FILE, JSON.stringify({}, null, 2));

    console.log('📝 Created empty image map - build will continue without images');
    return true;
  }
}

// Main sync function
async function syncImages() {
  try {
    console.log('🔍 Checking Strapi connectivity...');

    // Test Strapi connectivity with a quick health check
    let strapiAvailable = true;
    let products = [];

    try {
      const productsResponse = await fetchFromStrapi('products?populate=*&pagination[limit]=100&sort=id:desc');
      products = productsResponse.data || [];
      console.log(`✅ Strapi connected - found ${products.length} products`);
    } catch (error) {
      strapiAvailable = false;
      console.log(`❌ Strapi connection failed: ${error.message}`);

      // Use fallback and exit successfully
      await useFallbackImages();
      return; // Exit gracefully without error
    }

    if (products.length === 0) {
      console.log('⚠️  No products found in Strapi');
      await useFallbackImages();
      return;
    }

    // Strapi is available - proceed with fresh sync
    console.log('\n🔄 Syncing fresh images from Strapi...');

    // Ensure public and products directories exist
    await mkdir(PUBLIC_DIR, { recursive: true });
    await mkdir(PRODUCTS_DIR, { recursive: true });

    const imageMap = {};
    const currentSlugs = [];
    let totalDownloaded = 0;
    let totalErrors = 0;

    // Process each product
    for (const product of products) {
      const slug = product.slug;
      if (!slug) {
        console.warn('⚠️  Product missing slug:', product.title || product.id);
        continue;
      }

      currentSlugs.push(slug);
      console.log(`\n🖼️  Processing product: ${product.title} (${slug})`);

      const productDir = path.join(PRODUCTS_DIR, slug);
      await mkdir(productDir, { recursive: true });

      const images = product.images || [];
      const localImages = [];

      if (images.length === 0) {
        console.log('  📭 No images found for this product');
        imageMap[slug] = [];
        continue;
      }

      // Download each image (always overwrite existing)
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
            originalUrl: imageUrl
          });

          totalDownloaded++;

        } catch (error) {
          totalErrors++;
          console.error(`  ❌ Failed to download image ${i + 1}: ${error.message}`);
        }
      }

      imageMap[slug] = localImages;
      console.log(`  ✅ Downloaded ${localImages.length}/${images.length} images`);
    }

    // Clean up old product directories
    await cleanOldProducts(currentSlugs);

    // Sync show logos to static directory
    console.log('\n🎪 Syncing show logos...');
    let showCount = 0;
    let showLogoCount = 0;

    try {
      const showsResponse = await fetchFromStrapi('shows?populate=*');
      const shows = showsResponse.data || [];
      showCount = shows.length;

      if (shows.length > 0) {
        await mkdir(STATIC_DIR, { recursive: true });

        for (const show of shows) {
          if (show.logo && show.logo.url) {
            try {
              const logoUrl = show.logo.url;
              const fileName = path.basename(logoUrl.split('?')[0]); // Remove query params
              const filePath = path.join(STATIC_DIR, fileName);

              console.log(`  📥 Downloading show logo: ${show.title}`);
              await downloadImage(logoUrl, filePath);
              console.log(`  ✅ Saved: ${fileName}`);
              showLogoCount++;
            } catch (error) {
              console.error(`  ❌ Failed to download logo for ${show.title}: ${error.message}`);
            }
          }
        }

        console.log(`  ✅ Downloaded ${showLogoCount}/${showCount} show logos`);
      } else {
        console.log('  📭 No shows found');
      }
    } catch (error) {
      console.warn(`  ⚠️  Could not sync show logos: ${error.message}`);
    }

    // Write new image map only if we successfully processed products
    console.log('\n📝 Writing image map...');
    await writeFile(IMAGE_MAP_FILE, JSON.stringify(imageMap, null, 2));

    console.log(`\n🎉 Image sync complete!`);
    console.log(`   📊 Processed ${products.length} products`);
    console.log(`   ✅ Downloaded ${totalDownloaded} product images successfully`);
    console.log(`   🎪 Downloaded ${showLogoCount} show logos`);
    if (totalErrors > 0) {
      console.log(`   ⚠️  ${totalErrors} image download failures`);
    }
    console.log(`   📁 Product images: ${PRODUCTS_DIR}`);
    console.log(`   🎪 Show logos: ${STATIC_DIR}`);
    console.log(`   📝 Image map: ${IMAGE_MAP_FILE}`);

  } catch (error) {
    console.error('💥 Unexpected error during sync:', error.message);

    // Even on unexpected errors, try to use fallback
    console.log('🔄 Attempting to use existing images as fallback...');
    await useFallbackImages();
  }
}

// Always exit with success code to prevent build failures
process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught exception:', error.message);
  console.log('🔄 Using fallback images...');
  await useFallbackImages();
  process.exit(0);
});

process.on('unhandledRejection', async (error) => {
  console.error('💥 Unhandled rejection:', error.message);
  console.log('🔄 Using fallback images...');
  await useFallbackImages();
  process.exit(0);
});

// Run the sync
if (require.main === module) {
  syncImages().then(() => {
    console.log('✨ Image sync process finished successfully');
    process.exit(0);
  }).catch(async (error) => {
    console.error('💥 Final error:', error.message);
    console.log('🔄 Using fallback images...');
    await useFallbackImages();
    process.exit(0);
  });
}

module.exports = { syncImages };