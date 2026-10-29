// Local / EC2 server: API + website on one port.
//   npm run dev    → website from source with live reload
//   npm start      → built website (builds itself on first run)
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

// Load settings from a .env file in the project folder, if present (MONGODB_URI etc.).
try {
  process.loadEnvFile?.(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'));
} catch {
  /* no .env file — fine */
}

const { createApp, errorHandler, lanAddresses } = await import('./app.js');
const { getStore } = await import('./db.js');
const { UPLOAD_DIR } = await import('./storage.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const CLIENT_DIR = path.join(__dirname, '..', 'client');
const CLIENT_DIST = path.join(CLIENT_DIR, 'dist');
const VITE_CONFIG = path.join(CLIENT_DIR, 'vite.config.js');
const DEV = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

// Connect to the database first so problems show up immediately in the terminal.
let store;
try {
  store = await getStore();
} catch (e) {
  console.error(`\n[db] Could not connect to MongoDB: ${e.message}`);
  console.error('     Check MONGODB_URI in .env, your internet, and Atlas → Network Access (allow your IP).\n');
  process.exit(1);
}

const app = createApp({ port: PORT });
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d' }));

const server = http.createServer(app);

if (DEV) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    configFile: VITE_CONFIG,
    // allowedHosts: true → the dev site also opens through Wi-Fi IPs and tunnels (*.trycloudflare.com)
    server: { middlewareMode: true, hmr: { server }, allowedHosts: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  if (!fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    console.log('[web] no build found — building the website (first run only)…');
    const { build } = await import('vite');
    await build({ configFile: VITE_CONFIG, logLevel: 'warn' });
  }
  app.use(express.static(CLIENT_DIST, { maxAge: '1h', index: false }));
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

app.use(errorHandler);

const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`\nSELCO Champions ${DEV ? '(dev, live reload) ' : ''}is running`);
  console.log(`  Database:           ${store.kind === 'mongo' ? `MongoDB (${process.env.MONGODB_DB || 'selco_champions'})` : 'local file server/data/db.json'}`);
  console.log(`  On this computer:   http://localhost:${PORT}        admin → http://localhost:${PORT}/#/admin`);
  const lan = lanAddresses();
  if (lan.length) for (const ip of lan) console.log(`  Same Wi-Fi / LAN:   http://${ip}:${PORT}   ← open this on other phones/laptops`);
  console.log('');
});
