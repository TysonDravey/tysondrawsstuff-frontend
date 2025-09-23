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

// Configuration
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const TEAM_ID = process.env.VERCEL_TEAM_ID;

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

async function getExistingEnvVar(key) {
  return new Promise((resolve, reject) => {
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
          const envVars = JSON.parse(responseData);
          const existingVar = envVars.envs.find(env => env.key === key);
          resolve(existingVar);
        } else {
          reject(new Error(`Failed to get env vars: ${res.statusCode} ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function updateVercelEnv(key, value) {
  // First check if the variable exists
  const existingVar = await getExistingEnvVar(key);

  const data = JSON.stringify({
    key: key,
    type: 'encrypted',
    value: value,
    target: ['production', 'preview', 'development']
  });

  const isUpdate = !!existingVar;
  const method = isUpdate ? 'PATCH' : 'POST';
  const path = isUpdate
    ? `/v10/projects/${PROJECT_ID}/env/${existingVar.id}${TEAM_ID ? `?teamId=${TEAM_ID}` : ''}`
    : `/v10/projects/${PROJECT_ID}/env${TEAM_ID ? `?teamId=${TEAM_ID}` : ''}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.vercel.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    console.log(`🔄 ${isUpdate ? 'Updating existing' : 'Creating new'} environment variable ${key}...`);
    if (isUpdate) {
      console.log(`   Existing variable ID: ${existingVar.id}`);
      console.log(`   Current value: ${existingVar.value ? '[ENCRYPTED]' : '[EMPTY]'}`);
      console.log(`   New value: ${value}`);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ ${isUpdate ? 'Updated' : 'Created'} ${key} to: ${value}`);
          resolve(responseData);
        } else {
          reject(new Error(`Failed to ${isUpdate ? 'update' : 'create'} ${key}: ${res.statusCode} ${responseData}`));
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