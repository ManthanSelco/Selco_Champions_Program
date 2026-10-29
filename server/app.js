// The Express app (API only). Used by:
//   • server/index.js  — local / EC2 server (adds the website + listens on a port)
//   • api/index.js     — Vercel serverless function
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import multer from 'multer';
import crypto from 'node:crypto';
import os from 'node:os';
import { getStore, hashPassword, verifyPassword, ReadOnlyError } from './db.js';
import { saveImage } from './storage.js';
import { aggregate } from '../shared/analytics.js';

const TOKEN_TTL_MS = 12 * 3600 * 1000;
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ----------------------------- auth helpers ----------------------------- */
const b64 = (s) => Buffer.from(s).toString('base64url');
function sign(settings, payload) {
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', settings.tokenSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verify(settings, token) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expect = crypto.createHmac('sha256', settings.tokenSecret).update(body).digest('base64url');
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Date.now() || payload.pv !== settings.passwordVersion) return null;
    return payload;
  } catch {
    return null;
  }
}
const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer /, '');
const requireAdmin = wrap(async (req, res, next) => {
  const store = await getStore();
  const user = verify(await store.getSettings(), bearer(req));
  if (!user) return res.status(401).json({ error: 'Please log in again.' });
  req.admin = user;
  next();
});

// Small in-memory brute-force guard for the login route.
const attempts = new Map();

/* ------------------------------ validation ------------------------------ */
const TEXT_FIELDS = [
  'name', 'gender', 'age', 'occupation', 'organisation', 'tagline', 'photo', 'district', 'village', 'address',
  'mapLink', 'phonePrimary', 'phoneSecondary', 'valueChain', 'valueChainDetail', 'implementation', 'profile',
  'whyChampion', 'achievement', 'successStory', 'uniqueness', 'selcoEngagement',
];
function clean(input) {
  const out = {};
  for (const f of TEXT_FIELDS) out[f] = typeof input[f] === 'string' ? input[f].trim().slice(0, 20000) : '';
  out.lat = Number.isFinite(Number(input.lat)) && input.lat !== '' && input.lat !== null ? Number(input.lat) : null;
  out.lng = Number.isFinite(Number(input.lng)) && input.lng !== '' && input.lng !== null ? Number(input.lng) : null;
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
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'champion';

export function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (/vEthernet|VirtualBox|VMware|docker|br-|veth|WSL|Hyper-V/i.test(name)) continue;
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) out.push(a.address);
  }
  return out.sort((a, b) => Number(!/^192\.168\./.test(a)) - Number(!/^192\.168\./.test(b)));
}

export function createApp({ port = process.env.PORT || 8080 } = {}) {
  const app = express();
  app.set('trust proxy', true);
  app.use(compression());
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  const api = express.Router();

  api.get('/health', wrap(async (_req, res) => {
    const store = await getStore();
    res.json({ ok: true, db: store.kind, readOnly: !!store.readOnly });
  }));

  api.get('/site', (_req, res) => {
    const onServerless = !!process.env.VERCEL;
    res.json({
      publicUrl: process.env.PUBLIC_URL || null,
      lanUrls: onServerless ? [] : lanAddresses().map((ip) => `http://${ip}:${port}`),
    });
  });

  api.get('/champions', wrap(async (req, res) => {
    const store = await getStore();
    const isAdmin = !!verify(await store.getSettings(), bearer(req));
    const list = (await store.listChampions()).filter((c) => isAdmin || c.published !== false);
    res.json(list);
  }));

  api.get('/champions/:id', wrap(async (req, res) => {
    const c = await (await getStore()).getChampion(req.params.id);
    if (!c || c.published === false) return res.status(404).json({ error: 'Not found' });
    res.json(c);
  }));

  api.post('/auth/login', wrap(async (req, res) => {
    const key = req.ip;
    const a = attempts.get(key) || { n: 0, until: 0 };
    if (a.until > Date.now()) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    const { id, password } = req.body || {};
    const store = await getStore();
    if (store.readOnly) throw new ReadOnlyError();
    const s = await store.getSettings();
    const ok = id === s.adminId && typeof password === 'string' && verifyPassword(password, s.passwordHash);
    if (!ok) {
      a.n += 1;
      if (a.n >= 8) {
        a.until = Date.now() + 5 * 60 * 1000;
        a.n = 0;
      }
      attempts.set(key, a);
      return res.status(401).json({ error: 'Incorrect admin ID or password.' });
    }
    attempts.delete(key);
    const token = sign(s, { sub: s.adminId, pv: s.passwordVersion, exp: Date.now() + TOKEN_TTL_MS });
    res.json({ token, adminId: s.adminId, passwordChangedAt: s.passwordChangedAt });
  }));

  api.get('/auth/me', requireAdmin, wrap(async (_req, res) => {
    const s = await (await getStore()).getSettings();
    res.json({ adminId: s.adminId, passwordChangedAt: s.passwordChangedAt });
  }));

  api.post('/auth/change-password', requireAdmin, wrap(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    const store = await getStore();
    const s = await store.getSettings();
    if (!verifyPassword(String(currentPassword || ''), s.passwordHash))
      return res.status(400).json({ error: 'Current password is incorrect.' });
    if (typeof newPassword !== 'string' || newPassword.length < 8)
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    const patch = {
      passwordHash: hashPassword(newPassword),
      passwordVersion: (s.passwordVersion || 1) + 1,
      passwordChangedAt: new Date().toISOString(),
    };
    await store.updateSettings(patch);
    const next = { ...s, ...patch };
    const token = sign(next, { sub: next.adminId, pv: next.passwordVersion, exp: Date.now() + TOKEN_TTL_MS });
    res.json({ ok: true, token, passwordChangedAt: next.passwordChangedAt });
  }));

  api.post('/champions', requireAdmin, wrap(async (req, res) => {
    const data = clean(req.body || {});
    if (!data.name) return res.status(400).json({ error: 'Name is required.' });
    if (!data.district) return res.status(400).json({ error: 'Please select a district.' });
    const store = await getStore();
    let id = slugify(data.name);
    while (await store.championExists(id)) id = `${slugify(data.name)}-${crypto.randomBytes(2).toString('hex')}`;
    const now = new Date().toISOString();
    const champion = { id, ...data, createdAt: now, updatedAt: now };
    await store.insertChampion(champion);
    res.status(201).json(champion);
  }));

  api.put('/champions/:id', requireAdmin, wrap(async (req, res) => {
    const data = clean(req.body || {});
    if (!data.name) return res.status(400).json({ error: 'Name is required.' });
    if (!data.district) return res.status(400).json({ error: 'Please select a district.' });
    const updated = await (await getStore()).updateChampion(req.params.id, { ...data, updatedAt: new Date().toISOString() });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  }));

  api.delete('/champions/:id', requireAdmin, wrap(async (req, res) => {
    const ok = await (await getStore()).deleteChampion(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  }));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024, files: 20 },
    fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
  });
  api.post('/upload', requireAdmin, upload.array('files', 20), wrap(async (req, res) => {
    try {
      const urls = [];
      for (const f of req.files || []) urls.push(await saveImage(f.buffer, f.mimetype));
      if (!urls.length) return res.status(400).json({ error: 'Please choose JPG, PNG or WebP images (max 25 MB each).' });
      res.json({ urls });
    } catch (e) {
      if (e.status) throw e;
      console.error(e);
      const bad = /unsupported image format|Input buffer|corrupt/i.test(e.message || '');
      res.status(bad ? 400 : 500).json({ error: bad ? 'One of the files is not a valid image.' : 'Upload failed.' });
    }
  }));

  // Photos stored in MongoDB (GridFS)
  api.get('/images/:key', wrap(async (req, res) => {
    const img = await (await getStore()).getImage(req.params.key);
    if (!img) return res.status(404).json({ error: 'Image not found' });
    res.set({ 'Content-Type': img.contentType, 'Content-Length': img.length, 'Cache-Control': 'public, max-age=31536000, immutable' });
    img.stream.on('error', () => res.destroy()).pipe(res);
  }));

  /* ---------------------------- analytics ---------------------------- */
  const TYPES = new Set(['pageview', 'profile_view', 'share']);
  api.post('/analytics/track', wrap(async (req, res) => {
    const b = req.body || {};
    if (!TYPES.has(b.type)) return res.status(400).end();
    const ua = req.headers['user-agent'] || '';
    if (/bot|crawler|spider|headless|lighthouse/i.test(ua)) return res.status(204).end();
    await (await getStore()).addEvent({
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
  }));

  api.get('/analytics', requireAdmin, wrap(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const { events, champions, allTime, recent } = await (await getStore()).analyticsInput(days);
    res.json(aggregate(events, champions, days, Date.now(), { allTime, recent }));
  }));

  app.use('/api', api);
  return app;
}

/** Final JSON error handler — add it after any other routes. */
export function errorHandler(err, _req, res, _next) {
  if (!err.status || err.status >= 500) console.error(err);
  const dbDown = /MongoServerSelectionError|ECONNREFUSED|querySrv|Authentication failed|bad auth/i.test(`${err.name} ${err.message}`);
  res.status(dbDown ? 503 : err.status || 500).json({
    error: dbDown ? 'Cannot reach the database. Check MONGODB_URI and that this server’s IP is allowed in MongoDB Atlas (Network Access).' : err.message || 'Server error',
  });
}
