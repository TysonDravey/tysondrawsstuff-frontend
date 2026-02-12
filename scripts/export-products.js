#!/usr/bin/env node

/**
 * Export products from Strapi to static JSON file
 * This allows API routes to access product data without calling Strapi at runtime
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1339';
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'products-data.json');
const SETTINGS_OUTPUT_FILE = path.join(__dirname, '..', 'public', 'site-settings.json');

console.log('📦 Exporting products from Strapi...');
console.log(`   Strapi URL: ${STRAPI_URL}`);

async function fetchProducts() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${STRAPI_URL}/api/products?populate=*&pagination[limit]=1000`);
    const client = url.protocol === 'https:' ? https : http;

    const options = {
      headers: {
        'Authorization': `Bearer ${STRAPI_TOKEN}`,
        'Content-Type': 'application/json',
      }
    };

    client.get(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(data);
            resolve(result.data);
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function fetchGlobalSettings() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${STRAPI_URL}/api/global`);
    const client = url.protocol === 'https:' ? https : http;

    const options = {
      headers: {
        'Authorization': `Bearer ${STRAPI_TOKEN}`,
        'Content-Type': 'application/json',
      }
    };

    client.get(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(data);
            resolve(result.data);
          } catch (error) {
            reject(new Error(`Failed to parse global JSON: ${error.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  try {
    const products = await fetchProducts();

    // Create a lookup object by slug for fast access
    const productsBySlug = {};
    products.forEach(product => {
      productsBySlug[product.slug] = product;
    });

    // Write to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(productsBySlug, null, 2));

    console.log(`✅ Exported ${products.length} products to ${OUTPUT_FILE}`);
    console.log('   Products can now be accessed without Strapi at runtime');
  } catch (error) {
    console.error('❌ Failed to export products:', error.message);
    console.warn('⚠️  Creating empty products file to prevent build errors');
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({}, null, 2));
  }

  // Export global site settings (posterPrice, etc.)
  try {
    const globalData = await fetchGlobalSettings();
    const siteSettings = {
      posterPrice: globalData.posterPrice || null,
    };

    fs.writeFileSync(SETTINGS_OUTPUT_FILE, JSON.stringify(siteSettings, null, 2));
    console.log(`✅ Exported site settings to ${SETTINGS_OUTPUT_FILE}`);
    if (siteSettings.posterPrice) {
      console.log(`   Poster price: $${siteSettings.posterPrice}`);
    }
  } catch (error) {
    console.error('❌ Failed to export site settings:', error.message);
    console.warn('⚠️  Creating default site settings file');
    fs.writeFileSync(SETTINGS_OUTPUT_FILE, JSON.stringify({ posterPrice: null }, null, 2));
  }
}

main();
