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
const ENV_VAR_ID = 'Fj0DJbkAWt89WnlC'; // The ID we know from the logs

console.log('🔍 Fetching actual decrypted value from Vercel...\n');

const options = {
  hostname: 'api.vercel.com',
  port: 443,
  path: `/v1/projects/${PROJECT_ID}/env/${ENV_VAR_ID}`,
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
      console.log('✅ Successfully retrieved environment variable:\n');
      console.log(`   Key: ${data.key}`);
      console.log(`   Value: ${data.value || '[ENCRYPTED - no plaintext access]'}`);
      console.log(`   Type: ${data.type}`);
      console.log(`   Target: ${data.target.join(', ')}`);
      console.log(`   Created: ${new Date(data.createdAt).toLocaleString()}`);
      console.log(`   Updated: ${new Date(data.updatedAt).toLocaleString()}`);

      if (!data.value) {
        console.log('\n⚠️  Note: Encrypted values cannot be retrieved via API for security.');
        console.log('   The value WAS updated (see timestamp), but Vercel hides the plaintext.');
      }
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
