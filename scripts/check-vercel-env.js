#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length && !key.startsWith('#')) {
      process.env[key.trim()] = values.join('=').trim();
    }
  });
}

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const TEAM_ID = process.env.VERCEL_TEAM_ID;

if (!VERCEL_TOKEN || !PROJECT_ID) {
  console.error('❌ Missing VERCEL_TOKEN or VERCEL_PROJECT_ID');
  process.exit(1);
}

console.log('🔍 Checking Vercel environment variables...');
console.log(`   Project ID: ${PROJECT_ID}`);
console.log(`   Team ID: ${TEAM_ID || 'None (personal account)'}`);

const options = {
  hostname: 'api.vercel.com',
  port: 443,
  path: `/v10/projects/${PROJECT_ID}/env${TEAM_ID ? `?teamId=${TEAM_ID}` : ''}`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${VERCEL_TOKEN}`,
  }
};

const req = https.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => responseData += chunk);
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const data = JSON.parse(responseData);
      const strapiVar = data.envs.find(env => env.key === 'NEXT_PUBLIC_STRAPI_URL');

      if (strapiVar) {
        console.log('\n✅ Found NEXT_PUBLIC_STRAPI_URL:');
        console.log(`   ID: ${strapiVar.id}`);
        console.log(`   Type: ${strapiVar.type}`);
        console.log(`   Value: ${strapiVar.value || '[ENCRYPTED - cannot display]'}`);
        console.log(`   Target: ${strapiVar.target.join(', ')}`);
        console.log(`   Created: ${new Date(strapiVar.createdAt).toLocaleString()}`);
        console.log(`   Updated: ${new Date(strapiVar.updatedAt).toLocaleString()}`);
      } else {
        console.log('\n❌ NEXT_PUBLIC_STRAPI_URL not found in this project');
      }

      console.log(`\n📊 Total environment variables: ${data.envs.length}`);
      console.log('\nAll environment variables:');
      data.envs.forEach(env => {
        console.log(`   - ${env.key} (${env.type}) → ${env.target.join(', ')}`);
      });
    } else {
      console.error(`❌ API Error: ${res.statusCode}`);
      console.error(responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
});

req.end();
