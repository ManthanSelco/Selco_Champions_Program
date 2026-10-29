// Image storage. Every photo is compressed first (server/compress.js), then saved to:
//   • AWS S3            when STORAGE=s3   (S3_BUCKET, AWS_REGION, S3_PUBLIC_URL; needs @aws-sdk/client-s3)
//   • MongoDB (GridFS)  when MONGODB_URI is set → served from /api/images/<file>
//   • local disk        otherwise (server/uploads) → served from /uploads/<file>
// The returned URL is saved on the champion record, so nothing else needs to change.
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compressImage } from './compress.js';
import { getStore } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

export async function saveImage(original, originalType) {
  const { buffer, mimetype, ext: outExt } = await compressImage(original, originalType);
  const ext = outExt || EXT[mimetype] || '.jpg';
  const key = `${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(8).toString('hex')}${ext}`;

  if (process.env.STORAGE === 's3') {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({ region: process.env.AWS_REGION });
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: `champions/${key}`,
        Body: buffer,
        ContentType: mimetype,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
    return `${process.env.S3_PUBLIC_URL.replace(/\/$/, '')}/champions/${key}`;
  }

  const store = await getStore();
  return store.putImage(key, buffer, mimetype);
}
