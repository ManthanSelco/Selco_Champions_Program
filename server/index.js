import express from 'express';
import compression from 'compression';
import cors from 'cors';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { load, getDb, save, addEvent, hashPassword, verifyPassword } from './db.js';
import { saveImage, UPLOAD_DIR } from './storage.js';
import { aggregate } from '../shared/analytics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const CLIENT_DIR = path.join(__dirname, '..', 'client');
const CLIENT_DIST = path.join(CLIENT_DIR, 'dist');
const VITE_CONFIG = path.join(CLIENT_DIR, 'vite.config.js');
// `npm run dev` → --dev: website served live from source (hot reload) on the same port as the API.
const DEV = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const TOKEN_TTL_MS = 12 * 3600 * 1000;

load();
const app = express();
app.set('trust proxy', true);
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

/* ----------------------------- auth helpers ----------------------------- */
const b64 = (s) => Buffer.from(s).toString('base64url');
function sign(payload) {
  const { tokenSecret } = getDb().settings;
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', tokenSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verify(token) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const { tokenSecret, passwordVersion } = getDb().settings;
  const expect = crypto.createHmac('sha256', tokenSecret).update(body).digest('base64url');
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (payload.exp < Date.now() || payload.pv !== passwordVersion) return null;
  return payload;
}
function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const user = verify(token);
  if (!user) return res.status(401).json({ error: 'Please log in again.' });
  req.admin = user;
  next();
}

// Very small in-memory brute-force guard for the login route.
const attempts = new Map();
function loginGuard(req, res, next) {
  const key = req.ip;
  const a = attempts.get(key) || { n: 0, until: 0 };
  if (a.until > Date.now()) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  req._attempt = a;
  next();
}

/* ------------------------------ validation ------------------------------ */
const TEXT_FIELDS = [
  'name', 'gender', 'age', 'occupation', 'organisation', 'tagline', 'photo', 'district', 'village', 'address',
  'mapLink', 'phonePrimary', 'phoneSecondary', 'valueChain', 'valueChainDetail', 'implementation', 'profile',
  'whyChampion', 'achievement', 'successStory', 'uniqueness', 'selcoEngagement',
];
function clean(input) {
  const out = {};
  for (const f of TEXT_FIELDS) out[f] = typeof input[f] === 'string' ? input[f].trim().slice(0, 20000) : '';
  out.lat = Number.isFinite(Number(input.lat)) && input.lat !== '' ? Number(input.lat) : null;
  out.lng = Number.isFinite(Number(input.lng)) && input.lng !== '' ? Number(input.lng) : null;
  out.gallery = Array.isArray(input.gallery) ? input.gallery.filter((g) => typeof g === 'string').slice(0, 40) : [];
  out.highlights = Array.isArray(input.highlights)
    ? input.highlights
        .filter((h) => h && (h.value || h.label))
        .slice(0, 6)
        .map((h) => ({ value: String(h.value || '').slice(0, 40), label: String(h.label || '').slice(0, 60) }))
    : [];
  out.published = input.published !== false;
  return out;
}
function slugify(name) {
  return (
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'champion'
  );
}

/* --------------------------------- API ---------------------------------- */
const api = express.Router();

api.get('/health', (_req, res) => res.json({ ok: true }));

/* ------------- addresses for sharing on the same Wi-Fi / network ------------- */
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (/vEthernet|VirtualBox|VMware|docker|br-|veth|WSL|Hyper-V/i.test(name)) continue;
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) out.push(a.address);
  }
  // Prefer typical home/office Wi-Fi ranges first.
  return out.sort((a, b) => Number(!/^192\.168\./.test(a)) - Number(!/^192\.168\./.test(b)));
}
// PUBLIC_URL (e.g. https://champions.selcofoundation.org) wins once the site is deployed.
api.get('/site', (_req, res) => {
  const lan = lanAddresses().map((ip) => `http://${ip}:${PORT}`);
  res.json({ publicUrl: process.env.PUBLIC_URL || null, lanUrls: lan });
});

api.get('/champions', (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const isAdmin = !!verify(token);
  const list = getDb().champions.filter((c) => isAdmin || c.published !== false);
  res.json(list);
});

api.get('/champions/:id', (req, res) => {
  const c = getDb().champions.find((x) => x.id === req.params.id);
  if (!c || c.published === false) return res.status(404).json({ error: 'Not found' });
  res.json(c);
});

api.post('/auth/login', loginGuard, (req, res) => {
  const { id, password } = req.body || {};
  const s = getDb().settings;
  const ok = id === s.adminId && typeof password === 'string' && verifyPassword(password, s.passwordHash);
  if (!ok) {
    const a = req._attempt;
    a.n += 1;
    if (a.n >= 8) {
      a.until = Date.now() + 5 * 60 * 1000;
      a.n = 0;
    }
    attempts.set(req.ip, a);
    return res.status(401).json({ error: 'Incorrect admin ID or password.' });
  }
  attempts.delete(req.ip);
  const token = sign({ sub: s.adminId, pv: s.passwordVersion, exp: Date.now() + TOKEN_TTL_MS });
  res.json({ token, adminId: s.adminId, passwordChangedAt: s.passwordChangedAt });
});

api.get('/auth/me', requireAdmin, (req, res) => {
  const s = getDb().settings;
  res.json({ adminId: s.adminId, passwordChangedAt: s.passwordChangedAt });
});

api.post('/auth/change-password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const s = getDb().settings;
  if (!verifyPassword(String(currentPassword || ''), s.passwordHash))
    return res.status(400).json({ error: 'Current password is incorrect.' });
  if (typeof newPassword !== 'string' || newPassword.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  s.passwordHash = hashPassword(newPassword);
  s.passwordVersion += 1;
  s.passwordChangedAt = new Date().toISOString();
  save(true);
  const token = sign({ sub: s.adminId, pv: s.passwordVersion, exp: Date.now() + TOKEN_TTL_MS });
  res.json({ ok: true, token, passwordChangedAt: s.passwordChangedAt });
});

api.post('/champions', requireAdmin, (req, res) => {
  const data = clean(req.body || {});
  if (!data.name) return res.status(400).json({ error: 'Name is required.' });
  if (!data.district) return res.status(400).json({ error: 'Please select a district.' });
  const db = getDb();
  let id = slugify(data.name);
  while (db.champions.some((c) => c.id === id)) id = `${slugify(data.name)}-${crypto.randomBytes(2).toString('hex')}`;
  const now = new Date().toISOString();
  const champion = { id, ...data, createdAt: now, updatedAt: now };
  db.champions.push(champion);
  save(true);
  res.status(201).json(champion);
});

api.put('/champions/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const idx = db.champions.findIndex((c) => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  const data = clean(req.body || {});
  if (!data.name) return res.status(400).json({ error: 'Name is required.' });
  if (!data.district) return res.status(400).json({ error: 'Please select a district.' });
  db.champions[idx] = { ...db.champions[idx], ...data, updatedAt: new Date().toISOString() };
  save(true);
  res.json(db.champions[idx]);
});

api.delete('/champions/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const before = db.champions.length;
  db.champions = db.champions.filter((c) => c.id !== req.params.id);
  if (db.champions.length === before) return res.status(404).json({ error: 'Not found' });
  save(true);
  res.json({ ok: true });
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 20 }, // big phone photos are fine — they get compressed
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});
api.post('/upload', requireAdmin, upload.array('files', 20), async (req, res) => {
  try {
    const urls = [];
    for (const f of req.files || []) urls.push(await saveImage(f.buffer, f.mimetype));
    if (!urls.length) return res.status(400).json({ error: 'Please choose JPG, PNG or WebP images (max 25 MB each).' });
    res.json({ urls });
  } catch (e) {
    console.error(e);
    const bad = /unsupported image format|Input buffer|corrupt/i.test(e.message || '');
    res.status(bad ? 400 : 500).json({ error: bad ? 'One of the files is not a valid image.' : 'Upload failed.' });
  }
});

/* ------------------------------ analytics ------------------------------- */
const TYPES = new Set(['pageview', 'profile_view', 'share']);
api.post('/analytics/track', (req, res) => {
  const b = req.body || {};
  if (!TYPES.has(b.type)) return res.status(400).end();
  const ua = req.headers['user-agent'] || '';
  if (/bot|crawler|spider|headless|lighthouse/i.test(ua)) return res.status(204).end();
  addEvent({
    type: b.type,
    visitorId: String(b.visitorId || '').slice(0, 64) || 'anon',
    sessionId: String(b.sessionId || '').slice(0, 64) || 'anon',
    ts: new Date().toISOString(),
    path: String(b.path || '').slice(0, 200),
    championId: b.championId ? String(b.championId).slice(0, 80) : undefined,
    referrer: String(b.referrer || '').slice(0, 300),
    device: /Mobi|Android|iPhone/i.test(ua) ? 'Mobile' : /iPad|Tablet/i.test(ua) ? 'Tablet' : 'Desktop',
    channel: b.channel ? String(b.channel).slice(0, 30) : undefined,
  });
  res.status(204).end();
});

api.get('/analytics', requireAdmin, (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const db = getDb();
  res.json(aggregate(db.events, db.champions, days));
});

app.use('/api', api);

/* ------------------------- website (same port) -------------------------- */
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d' }));

const server = http.createServer(app);

if (DEV) {
  // Development: Vite runs inside this Express server — one process, one port, hot reload.
  const { createServer } = await import('vite');
  const vite = await createServer({
    configFile: VITE_CONFIG,
    // allowedHosts: true → the dev site also opens through Wi-Fi IPs and tunnels
    // (e.g. *.trycloudflare.com), not only via "localhost".
    server: { middlewareMode: true, hmr: { server }, allowedHosts: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  // Production: build the website once if it hasn't been built yet, then serve it.
  if (!fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    console.log('[web] no build found — building the website (first run only)…');
    const { build } = await import('vite');
    await build({ configFile: VITE_CONFIG, logLevel: 'warn' });
  }
  app.use(express.static(CLIENT_DIST, { maxAge: '1h', index: false }));
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const HOST = process.env.HOST || '0.0.0.0'; // all interfaces → reachable from other devices on the same Wi-Fi
server.listen(PORT, HOST, () => {
  console.log(`\nSELCO Champions ${DEV ? '(dev, live reload) ' : ''}is running`);
  console.log(`  On this computer:   http://localhost:${PORT}        admin → http://localhost:${PORT}/#/admin`);
  const lan = lanAddresses();
  if (lan.length) for (const ip of lan) console.log(`  Same Wi-Fi / LAN:   http://${ip}:${PORT}   ← open this on other phones/laptops`);
  else console.log('  (No Wi-Fi/LAN address found — connect to a network to share on Wi-Fi.)');
  console.log('');
});
