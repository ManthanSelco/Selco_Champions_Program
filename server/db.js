// Tiny JSON-file database. Swap this module for MongoDB / DynamoDB later —
// the rest of the server only uses the functions exported here.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SEED_FILE = path.join(__dirname, '..', 'shared', 'champions.seed.json');

export const ADMIN_ID = process.env.ADMIN_ID || 'admin';
const DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'Selco@2026';
const MAX_EVENTS = 100000;

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64);
  const real = Buffer.from(hash, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

function freshDb() {
  const now = new Date().toISOString();
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  return {
    settings: {
      adminId: ADMIN_ID,
      passwordHash: hashPassword(DEFAULT_PASSWORD),
      passwordVersion: 1,
      passwordChangedAt: null,
      tokenSecret: crypto.randomBytes(32).toString('hex'),
    },
    champions: seed.map((c) => ({ ...c, createdAt: now, updatedAt: now })),
    events: [],
  };
}

let db;
let writeTimer = null;

export function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db = freshDb();
    flush();
    console.log(`[db] created ${DB_FILE} with ${db.champions.length} seed champions`);
    console.log(`[db] admin login → ID: ${ADMIN_ID}  password: ${DEFAULT_PASSWORD}  (change it from the admin panel)`);
  }
  return db;
}

export function flush() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

// Debounced save so a burst of analytics events doesn't hammer the disk.
export function save(immediate = false) {
  if (immediate) {
    clearTimeout(writeTimer);
    writeTimer = null;
    return flush();
  }
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    flush();
  }, 1500);
}

export const getDb = () => db;

export function addEvent(evt) {
  db.events.push(evt);
  if (db.events.length > MAX_EVENTS) db.events.splice(0, db.events.length - MAX_EVENTS);
  save();
}
