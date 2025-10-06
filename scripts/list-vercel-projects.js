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

console.log('🔍 Listing all Vercel projects...\n');

const options = {
  hostname: 'api.vercel.com',
  port: 443,
  path: '/v9/projects',
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
      console.log(`Found ${data.projects.length} projects:\n`);
      data.projects.forEach(project => {
        console.log(`📦 ${project.name}`);
        console.log(`   ID: ${project.id}`);
        console.log(`   Framework: ${project.framework || 'None'}`);
        console.log(`   Updated: ${new Date(project.updatedAt).toLocaleString()}`);
        console.log('');
      });

      // Check which one matches our .env
      const configuredId = process.env.VERCEL_PROJECT_ID;
      const matchingProject = data.projects.find(p => p.id === configuredId);
      if (matchingProject) {
        console.log(`\n✅ Configured project ID matches: ${matchingProject.name}`);
      } else {
        console.log(`\n⚠️  WARNING: Configured ID ${configuredId} not found in your projects!`);
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
