#!/usr/bin/env node

// Simple verification script to test what NEXT_PUBLIC_STRAPI_URL is actually being used
console.log('🔍 Environment Variable Verification');
console.log('=====================================');
console.log('NEXT_PUBLIC_STRAPI_URL:', process.env.NEXT_PUBLIC_STRAPI_URL || 'NOT SET');
console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
console.log('VERCEL_ENV:', process.env.VERCEL_ENV || 'NOT SET');
console.log('');

// Try to load from .env.local if running locally
if (!process.env.VERCEL_ENV) {
  const fs = require('fs');
  const path = require('path');

  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    console.log('📄 Loading from .env.local:');
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      if (line.startsWith('NEXT_PUBLIC_STRAPI_URL=')) {
        console.log('Local value:', line);
      }
    });
  }
}