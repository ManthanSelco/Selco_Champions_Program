// Image storage. Today: local disk (server/uploads). Later: AWS S3.
//
// To move to S3:
//   1. npm i @aws-sdk/client-s3
//   2. set STORAGE=s3, S3_BUCKET, AWS_REGION (e.g. ap-south-1), S3_PUBLIC_URL
//      (e.g. https://<bucket>.s3.ap-south-1.amazonaws.com or a CloudFront URL)
//   3. the s3 branch below is ready — it returns the public URL that gets saved
//      on the champion record, so nothing else in the app needs to change.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compressImage } from './compress.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

export async function saveImage(original, originalType) {
  // Compress first (resize + WebP), so both local disk and S3 store the small version.
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

  fs.writeFileSync(path.join(UPLOAD_DIR, key), buffer);
  return `uploads/${key}`;
}
