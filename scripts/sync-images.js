#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Configuration
const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1339';
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PRODUCTS_DIR = path.join(PUBLIC_DIR, 'products');
const STATIC_DIR = path.join(PUBLIC_DIR, 'static');
const IMAGE_MAP_FILE = path.join(__dirname, '..', 'image-map.json');

// Ensure directories exist
function ensureDirectories() {
  [PUBLIC_DIR, PRODUCTS_DIR, STATIC_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Download file from URL
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url} -> ${filepath}`);

    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, (response) => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(filepath);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✓ Downloaded: ${path.basename(filepath)}`);
          resolve(filepath);
        });
      } else if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirects
        downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
      } else {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
      }
    }).on('error', reject);

    // Set timeout
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error(`Download timeout for ${url}`));
    });
  });
}

// Get file extension from URL or content-type
function getFileExtension(url, contentType = '') {
  try {
    // Handle relative URLs
    if (url.startsWith('/')) {
      return path.extname(url);
    }
    const urlExt = path.extname(new URL(url).pathname);
    if (urlExt) return urlExt;
  } catch (error) {
    // If URL parsing fails, try to extract extension from string
    const match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    if (match) return '.' + match[1];
  }

  if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('gif')) return '.gif';

  return '.jpg'; // Default fallback
}

// Fetch data from Strapi API
async function fetchFromStrapi(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `${STRAPI_URL}/api/${endpoint}`;
    console.log(`Fetching: ${url}`);

    const protocol = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'Authorization': `Bearer ${STRAPI_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const request = protocol.get(url, options, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (error) {
          reject(new Error(`Failed to parse JSON from ${url}: ${error.message}`));
        }
      });
    }).on('error', reject);

    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error(`API request timeout for ${url}`));
    });
  });
}

// Main sync function
async function syncImages() {
  console.log('🎨 Starting image sync...');

  try {
    ensureDirectories();

    // Initialize image map
    const imageMap = {
      products: {},
      static: {},
      lastSync: new Date().toISOString()
    };

    // 1. Fetch all products with images
    console.log('\n📦 Fetching products...');
    const productsResponse = await fetchFromStrapi('products?populate=*');
    const products = productsResponse.data || [];

    console.log(`Found ${products.length} products`);

    // 2. Process each product
    for (const product of products) {
      const productSlug = product.slug;
      const productDir = path.join(PRODUCTS_DIR, productSlug);

      // Ensure product directory exists
      if (!fs.existsSync(productDir)) {
        fs.mkdirSync(productDir, { recursive: true });
      }

      console.log(`\n📸 Processing product: ${product.title} (${productSlug})`);

      if (product.images && product.images.length > 0) {
        imageMap.products[productSlug] = [];

        for (let i = 0; i < product.images.length; i++) {
          const image = product.images[i];
          const imageUrl = `${STRAPI_URL}${image.url}`;
          const extension = getFileExtension(image.url);
          const filename = `image${i + 1}${extension}`;
          const filepath = path.join(productDir, filename);
          const staticPath = `/products/${productSlug}/${filename}`;

          try {
            await downloadFile(imageUrl, filepath);

            // Add to image map
            imageMap.products[productSlug].push({
              original: image.url,
              static: staticPath,
              alt: image.alternativeText || product.title,
              width: image.width,
              height: image.height
            });

          } catch (error) {
            console.error(`❌ Failed to download ${imageUrl}:`, error.message);
          }
        }
      } else {
        console.log(`  No images found for ${productSlug}`);
      }
    }

    // 3. Download static assets (logo, etc.)
    console.log('\n🖼️  Processing static assets...');
    const staticAssets = [
      {
        url: '/uploads/tysondrawsstuff_web_logo_06_e9ebe2d054.png',
        filename: 'logo.png',
        description: 'Site logo'
      },
      {
        url: '/uploads/TysonPuppet_head_07_small_01.png',
        filename: 'artist-photo.png',
        description: 'Artist profile photo'
      }
      // Add more static assets here as needed
    ];

    for (const asset of staticAssets) {
      const assetUrl = `${STRAPI_URL}${asset.url}`;
      const filepath = path.join(STATIC_DIR, asset.filename);
      const staticPath = `/static/${asset.filename}`;

      try {
        await downloadFile(assetUrl, filepath);

        imageMap.static[asset.url] = {
          static: staticPath,
          description: asset.description
        };

      } catch (error) {
        console.error(`❌ Failed to download ${assetUrl}:`, error.message);
      }
    }

    // 4. Save image map
    fs.writeFileSync(IMAGE_MAP_FILE, JSON.stringify(imageMap, null, 2));
    console.log(`\n💾 Image map saved to: ${IMAGE_MAP_FILE}`);

    // 5. Summary
    const totalProducts = Object.keys(imageMap.products).length;
    const totalImages = Object.values(imageMap.products).reduce((sum, imgs) => sum + imgs.length, 0);
    const totalStatic = Object.keys(imageMap.static).length;

    console.log('\n✅ Image sync completed!');
    console.log(`   Products: ${totalProducts}`);
    console.log(`   Product images: ${totalImages}`);
    console.log(`   Static assets: ${totalStatic}`);
    console.log(`   Total files: ${totalImages + totalStatic}`);

  } catch (error) {
    console.error('❌ Image sync failed:', error);
    process.exit(1);
  }
}

// Run the sync
if (require.main === module) {
  syncImages();
}

module.exports = { syncImages };