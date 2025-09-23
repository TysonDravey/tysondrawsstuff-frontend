#!/usr/bin/env node

const https = require('https');

// Configuration
const VERCEL_TOKEN = process.env.VERCEL_TOKEN; // You'll need to set this
const PROJECT_ID = process.env.VERCEL_PROJECT_ID; // Your Vercel project ID
const TEAM_ID = process.env.VERCEL_TEAM_ID; // Optional, if using a team

if (!VERCEL_TOKEN) {
  console.error('❌ VERCEL_TOKEN environment variable is required');
  process.exit(1);
}

if (!PROJECT_ID) {
  console.error('❌ VERCEL_PROJECT_ID environment variable is required');
  process.exit(1);
}

const newStrapiUrl = process.argv[2];
if (!newStrapiUrl) {
  console.error('❌ Usage: node update-vercel-env.js <new-strapi-url>');
  process.exit(1);
}

async function updateVercelEnv(key, value) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      type: 'encrypted',
      value: value,
      target: ['production', 'preview', 'development']
    });

    const options = {
      hostname: 'api.vercel.com',
      port: 443,
      path: `/v10/projects/${PROJECT_ID}/env/${key}${TEAM_ID ? `?teamId=${TEAM_ID}` : ''}`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Updated ${key} to: ${value}`);
          resolve(responseData);
        } else {
          reject(new Error(`Failed to update ${key}: ${res.statusCode} ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  try {
    console.log(`🔄 Updating Vercel environment variables...`);
    await updateVercelEnv('NEXT_PUBLIC_STRAPI_URL', newStrapiUrl);
    console.log(`✅ Successfully updated NEXT_PUBLIC_STRAPI_URL to: ${newStrapiUrl}`);
    console.log(`🚀 You can now redeploy on Vercel to use the new URL`);
  } catch (error) {
    console.error('❌ Failed to update Vercel environment variables:', error.message);
    process.exit(1);
  }
}

main();