// Data layer. Two interchangeable stores with the same async API:
//   • MongoStore — used when MONGODB_URI is set (MongoDB Atlas / your own MongoDB).
//                  Champions, admin settings, analytics events AND photos (GridFS) live in MongoDB.
//   • FileStore  — local fallback: server/data/db.json + server/uploads (no setup needed).
// The rest of the server only talks to the functions below, never to Mongo or files directly.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = path.join(__dirname, '..', 'shared', 'champions.seed.json');

export const ADMIN_ID = process.env.ADMIN_ID || 'admin';
const DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'Selco@2026';
const MAX_EVENTS = 200000;
const ON_VERCEL = !!process.env.VERCEL;

/* ------------------------------ passwords ------------------------------- */
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64);
  const real = Buffer.from(hash, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

function freshSettings() {
  return {
    adminId: ADMIN_ID,
    passwordHash: hashPassword(DEFAULT_PASSWORD),
    passwordVersion: 1,
    passwordChangedAt: null,
    tokenSecret: crypto.randomBytes(32).toString('hex'),
  };
}
function seedChampions() {
  const now = new Date().toISOString();
  return JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')).map((c) => ({ ...c, createdAt: now, updatedAt: now }));
}
function announce(where) {
  console.log(`[db] ${where} created with the 11 seed champions`);
  console.log(`[db] admin login → ID: ${ADMIN_ID}  password: ${DEFAULT_PASSWORD}  (change it from the admin panel)`);
}

export class ReadOnlyError extends Error {
  constructor() {
    super('Saving is switched off: this hosting has no database. Set MONGODB_URI (MongoDB Atlas) in the hosting settings and redeploy.');
    this.status = 503;
  }
}

/* ------------------------------ FileStore ------------------------------- */
class FileStore {
  kind = 'file';
  constructor() {
    this.dir = process.env.DATA_DIR || path.join(__dirname, 'data');
    this.file = path.join(this.dir, 'db.json');
    this.uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
    // Serverless hosting without MONGODB_URI: the disk is read-only, so serve the seed data read-only.
    this.readOnly = ON_VERCEL;
    this.timer = null;
  }
  async init() {
    if (this.readOnly) {
      this.db = { settings: freshSettings(), champions: seedChampions(), events: [] };
      console.warn('[db] No MONGODB_URI on serverless hosting — showing seed data, saving is disabled.');
      return this;
    }
    fs.mkdirSync(this.dir, { recursive: true });
    if (fs.existsSync(this.file)) this.db = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    else {
      this.db = { settings: freshSettings(), champions: seedChampions(), events: [] };
      this.flush();
      announce(this.file);
    }
    return this;
  }
  guard() {
    if (this.readOnly) throw new ReadOnlyError();
  }
  flush() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2));
    fs.renameSync(tmp, this.file);
  }
  save(now = true) {
    if (now) {
      clearTimeout(this.timer);
      this.timer = null;
      return this.flush();
    }
    if (!this.timer) this.timer = setTimeout(() => ((this.timer = null), this.flush()), 1500);
  }

  async getSettings() {
    return { ...this.db.settings };
  }
  async updateSettings(patch) {
    this.guard();
    Object.assign(this.db.settings, patch);
    this.save();
  }
  async listChampions() {
    return this.db.champions.map((c) => ({ ...c }));
  }
  async getChampion(id) {
    const c = this.db.champions.find((x) => x.id === id);
    return c ? { ...c } : null;
  }
  async championExists(id) {
    return this.db.champions.some((x) => x.id === id);
  }
  async insertChampion(c) {
    this.guard();
    this.db.champions.push(c);
    this.save();
    return c;
  }
  async updateChampion(id, patch) {
    this.guard();
    const i = this.db.champions.findIndex((x) => x.id === id);
    if (i < 0) return null;
    this.db.champions[i] = { ...this.db.champions[i], ...patch };
    this.save();
    return { ...this.db.champions[i] };
  }
  async deleteChampion(id) {
    this.guard();
    const before = this.db.champions.length;
    this.db.champions = this.db.champions.filter((x) => x.id !== id);
    if (this.db.champions.length === before) return false;
    this.save();
    return true;
  }
  async addEvent(evt) {
    if (this.readOnly) return;
    this.db.events.push(evt);
    if (this.db.events.length > MAX_EVENTS) this.db.events.splice(0, this.db.events.length - MAX_EVENTS);
    this.save(false);
  }
  async analyticsInput() {
    return { events: this.db.events, champions: this.db.champions };
  }
  async putImage(key, buffer) {
    this.guard();
    fs.mkdirSync(this.uploadDir, { recursive: true });
    fs.writeFileSync(path.join(this.uploadDir, key), buffer);
    return `uploads/${key}`;
  }
  async getImage() {
    return null;
  }
}

/* ------------------------------ MongoStore ------------------------------ */
class MongoStore {
  kind = 'mongo';
  async init() {
    const { MongoClient, GridFSBucket } = await import('mongodb');
    // Re-use one connection across serverless invocations.
    globalThis.__selcoMongo ||= new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 }).connect();
    const client = await globalThis.__selcoMongo;
    this.db = client.db(process.env.MONGODB_DB || 'selco_champions');
    this.settings = this.db.collection('settings');
    this.champions = this.db.collection('champions');
    this.events = this.db.collection('events');
    this.bucket = new GridFSBucket(this.db, { bucketName: 'images' });

    if (!globalThis.__selcoMongoReady) {
      globalThis.__selcoMongoReady = (async () => {
        await Promise.all([
          this.champions.createIndex({ id: 1 }, { unique: true }),
          this.events.createIndex({ ts: 1 }),
          this.events.createIndex({ type: 1, ts: 1 }),
        ]).catch(() => {});
        // First run on an empty database: create admin settings + seed champions.
        if (!(await this.settings.findOne({ _id: 'admin' }))) {
          await this.settings.updateOne({ _id: 'admin' }, { $setOnInsert: freshSettings() }, { upsert: true });
          if ((await this.champions.countDocuments()) === 0) {
            await this.champions.insertMany(seedChampions());
            announce(`MongoDB database "${this.db.databaseName}"`);
          }
        }
      })();
    }
    await globalThis.__selcoMongoReady;
    return this;
  }

  async getSettings() {
    const s = await this.settings.findOne({ _id: 'admin' });
    const { _id, ...rest } = s || {};
    return rest;
  }
  async updateSettings(patch) {
    await this.settings.updateOne({ _id: 'admin' }, { $set: patch });
  }
  async listChampions() {
    return this.champions.find({}, { projection: { _id: 0 } }).sort({ createdAt: 1, name: 1 }).toArray();
  }
  async getChampion(id) {
    return this.champions.findOne({ id }, { projection: { _id: 0 } });
  }
  async championExists(id) {
    return (await this.champions.countDocuments({ id }, { limit: 1 })) > 0;
  }
  async insertChampion(c) {
    await this.champions.insertOne({ ...c });
    return c;
  }
  async updateChampion(id, patch) {
    const r = await this.champions.updateOne({ id }, { $set: patch });
    if (!r.matchedCount) return null;
    return this.getChampion(id);
  }
  async deleteChampion(id) {
    const r = await this.champions.deleteOne({ id });
    return r.deletedCount > 0;
  }
  async addEvent(evt) {
    const doc = Object.fromEntries(Object.entries(evt).filter(([, v]) => v !== undefined));
    await this.events.insertOne(doc);
  }
  async analyticsInput(days) {
    const since = new Date(Date.now() - Math.max(days, 1) * 86400000).toISOString();
    const [events, champions, allTimeVisits, visitorIds, recent] = await Promise.all([
      this.events.find({ ts: { $gte: since } }, { projection: { _id: 0 } }).sort({ ts: 1 }).limit(MAX_EVENTS).toArray(),
      this.listChampions(),
      this.events.countDocuments({ type: 'pageview' }),
      this.events.distinct('visitorId', { type: 'pageview' }),
      this.events.find({}, { projection: { _id: 0 } }).sort({ ts: -1 }).limit(12).toArray(),
    ]);
    return { events, champions, allTime: { visits: allTimeVisits, visitors: visitorIds.length }, recent };
  }
  async putImage(key, buffer, contentType) {
    await new Promise((resolve, reject) => {
      const up = this.bucket.openUploadStream(key, { metadata: { contentType } });
      Readable.from(buffer).pipe(up).on('finish', resolve).on('error', reject);
    });
    return `api/images/${key}`;
  }
  async getImage(key) {
    const file = await this.bucket.find({ filename: key }).limit(1).next();
    if (!file) return null;
    return { stream: this.bucket.openDownloadStream(file._id), contentType: file.metadata?.contentType || 'image/webp', length: file.length };
  }
}

/* ------------------------------- factory -------------------------------- */
let storePromise = null;
export function getStore() {
  storePromise ||= (process.env.MONGODB_URI ? new MongoStore() : new FileStore()).init().catch((e) => {
    storePromise = null; // retry on the next request (e.g. Atlas was briefly unreachable)
    throw e;
  });
  return storePromise;
}
