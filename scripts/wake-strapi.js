#!/usr/bin/env node
/**
 * First prebuild step: wake Strapi and wait until it answers.
 *
 * Strapi on Railway sleeps when idle and takes a little while to start. Builds
 * started by a git push don't go through the tray's wake step, and the content
 * fetches give up after 10 seconds, so without this a push could hit a sleeping
 * Strapi and abort the build.
 */
const fs = require('fs');
const path = require('path');

// Same .env.local loading as the other build scripts (local builds only; Vercel sets env directly)
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const [key, ...values] = line.split('=');
    if (key && values.length && !key.startsWith('#') && !process.env[key.trim()]) {
      process.env[key.trim()] = values.join('=').trim();
    }
  }
}

const STRAPI_URL = (process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1339').replace(/\/$/, '');
const MAX_WAIT_MS = 3 * 60 * 1000;

async function healthy() {
  try {
    const res = await fetch(`${STRAPI_URL}/_health`, { signal: AbortSignal.timeout(30000) });
    return res.status === 200 || res.status === 204;
  } catch {
    return false;
  }
}

(async () => {
  const started = Date.now();
  console.log('⏰ Waking Strapi…');
  while (Date.now() - started < MAX_WAIT_MS) {
    if (await healthy()) {
      console.log(`✅ Strapi is awake (${Math.round((Date.now() - started) / 1000)}s)`);
      return;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  // Don't fail here: the next steps report the real error and abort safely.
  console.warn('⚠️  Strapi did not answer within 3 minutes; continuing so the next step reports the error.');
})();
