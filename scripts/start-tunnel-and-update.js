#!/usr/bin/env node

const { spawn } = require('child_process');
const { execSync } = require('child_process');

console.log('🚀 Starting Cloudflare tunnel and updating Vercel...');

// Start tunnel in background
const tunnel = spawn('npx', ['cloudflared', 'tunnel', '--url', 'http://localhost:1339'], {
  cwd: '../backend',
  stdio: 'pipe'
});

let tunnelUrl = null;

tunnel.stderr.on('data', (data) => {
  const output = data.toString();
  console.log(output);

  // Extract tunnel URL from output
  const urlMatch = output.match(/https:\/\/([a-z0-9-]+\.trycloudflare\.com)/);
  if (urlMatch && !tunnelUrl) {
    tunnelUrl = urlMatch[0];
    console.log(`\n🔗 Tunnel URL found: ${tunnelUrl}`);

    // Update Vercel environment variable
    if (process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID) {
      try {
        console.log('🔄 Updating Vercel environment variables...');
        execSync(`node scripts/update-vercel-env.js "${tunnelUrl}"`, { stdio: 'inherit' });
      } catch (error) {
        console.error('❌ Failed to update Vercel env vars:', error.message);
      }
    } else {
      console.log('⚠️  VERCEL_TOKEN or VERCEL_PROJECT_ID not set - skipping auto-update');
      console.log(`📋 Manual update: Set NEXT_PUBLIC_STRAPI_URL to ${tunnelUrl}`);
    }
  }
});

tunnel.on('close', (code) => {
  console.log(`\n🛑 Tunnel closed with code ${code}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down tunnel...');
  tunnel.kill();
  process.exit();
});