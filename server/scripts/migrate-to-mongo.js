// One-time: copy your existing local data into MongoDB.
//   • champions (incl. edits made in the admin panel)   → "champions" collection
//   • admin ID + password                               → "settings" collection (same login keeps working)
//   • visitor analytics                                 → "events" collection (only if Mongo has none yet)
//   • photos in server/uploads                          → MongoDB GridFS ("images"), links updated
// Usage: put MONGODB_URI in .env, then:  npm run db:migrate
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile?.(path.join(here, '..', '..', '.env'));
} catch {
  /* no .env */
}
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set. Add it to the .env file (see .env.example) and run again.');
  process.exit(1);
}

const DATA_FILE = path.join(process.env.DATA_DIR || path.join(here, '..', 'data'), 'db.json');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(here, '..', 'uploads');
if (!fs.existsSync(DATA_FILE)) {
  console.log(`No local database found at ${DATA_FILE} — nothing to migrate. Just start the server; MongoDB gets the seed champions automatically.`);
  process.exit(0);
}

const { MongoClient, GridFSBucket } = await import('mongodb');
const local = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const client = await new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 }).connect();
const db = client.db(process.env.MONGODB_DB || 'selco_champions');
const bucket = new GridFSBucket(db, { bucketName: 'images' });
console.log(`Connected → database "${db.databaseName}"`);

const TYPES = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' };
let photos = 0;
const moved = new Map();
async function movePhoto(url) {
  if (typeof url !== 'string' || !url.startsWith('uploads/')) return url; // seed/… and http(s) links stay as they are
  if (moved.has(url)) return moved.get(url);
  const key = url.slice('uploads/'.length);
  const file = path.join(UPLOAD_DIR, key);
  if (!fs.existsSync(file)) {
    console.warn(`  ! missing photo ${file} — link kept as is`);
    return url;
  }
  const exists = await bucket.find({ filename: key }).limit(1).next();
  if (!exists) {
    await new Promise((resolve, reject) => {
      const up = bucket.openUploadStream(key, { metadata: { contentType: TYPES[path.extname(key).toLowerCase()] || 'image/webp' } });
      Readable.from(fs.readFileSync(file)).pipe(up).on('finish', resolve).on('error', reject);
    });
    photos++;
  }
  const next = `api/images/${key}`;
  moved.set(url, next);
  return next;
}

// champions
const champions = db.collection('champions');
await champions.createIndex({ id: 1 }, { unique: true }).catch(() => {});
for (const c of local.champions || []) {
  const doc = { ...c, photo: await movePhoto(c.photo), gallery: await Promise.all((c.gallery || []).map(movePhoto)) };
  delete doc._id;
  await champions.replaceOne({ id: c.id }, doc, { upsert: true });
}
// remove champions that were deleted locally (e.g. the seed copies the server created earlier)
const ids = (local.champions || []).map((c) => c.id);
const removed = (await champions.deleteMany({ id: { $nin: ids } })).deletedCount;

// admin settings (keeps the current password)
if (local.settings) await db.collection('settings').replaceOne({ _id: 'admin' }, { _id: 'admin', ...local.settings }, { upsert: true });

// analytics
const events = db.collection('events');
let copiedEvents = 0;
if ((await events.countDocuments()) === 0 && local.events?.length) {
  await events.insertMany(local.events.map((e) => Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined))));
  copiedEvents = local.events.length;
}
await events.createIndex({ ts: 1 }).catch(() => {});

console.log(`\nDone:
  champions  ${ids.length} saved${removed ? `, ${removed} old removed` : ''}
  photos     ${photos} uploaded to MongoDB
  admin      login + password copied
  analytics  ${copiedEvents ? `${copiedEvents} events copied` : 'kept (MongoDB already had events or none locally)'}
Now start the server with MONGODB_URI set — it will read everything from MongoDB.`);
await client.close();
