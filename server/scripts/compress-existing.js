// One-time: compress photos that were uploaded BEFORE server-side compression existed.
// Converts every non-WebP image in server/uploads to a resized WebP, updates the paths
// in server/data/db.json, and deletes the old files.
//
//   1. stop the server   2. npm run images:compress   3. start the server again
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compressImage } from '../compress.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(here, '..', 'uploads');
const DB_FILE = path.join(process.env.DATA_DIR || path.join(here, '..', 'data'), 'db.json');
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' };

if (!fs.existsSync(DB_FILE) || !fs.existsSync(UPLOAD_DIR)) {
  console.log('Nothing to do (no database or uploads folder yet).');
  process.exit(0);
}

const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
fs.copyFileSync(DB_FILE, DB_FILE + '.before-compress.bak');

const renamed = {};
let before = 0;
let after = 0;
for (const name of fs.readdirSync(UPLOAD_DIR)) {
  const type = TYPES[path.extname(name).toLowerCase()];
  if (!type) continue;
  const src = path.join(UPLOAD_DIR, name);
  const input = fs.readFileSync(src);
  try {
    const out = await compressImage(input, type);
    if (out.ext !== '.webp') continue; // animated GIF kept as is
    const newName = name.replace(/\.[^.]+$/, '.webp');
    fs.writeFileSync(path.join(UPLOAD_DIR, newName), out.buffer);
    fs.unlinkSync(src);
    renamed[`uploads/${name}`] = `uploads/${newName}`;
    before += input.length;
    after += out.buffer.length;
    console.log(`✓ ${name}  ${(input.length / 1024).toFixed(0)} KB → ${(out.buffer.length / 1024).toFixed(0)} KB`);
  } catch (e) {
    console.warn(`✗ skipped ${name}: ${e.message}`);
  }
}

const fix = (u) => renamed[u] || u;
for (const c of db.champions) {
  c.photo = fix(c.photo);
  c.gallery = (c.gallery || []).map(fix);
}
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
console.log(
  `\nDone: ${Object.keys(renamed).length} photo(s), ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB.` +
    `\nBackup of the old database: ${DB_FILE}.before-compress.bak`
);
