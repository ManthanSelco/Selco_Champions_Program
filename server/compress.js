// Server-side image compression (sharp).
// Every uploaded photo is: rotated upright (phone EXIF), resized so the long side is at
// most IMAGE_MAX_SIZE px, stripped of metadata (incl. GPS) and saved as WebP.
// A 5–8 MB phone photo typically becomes ~150–350 KB with no visible quality loss.
import sharp from 'sharp';

const MAX = Number(process.env.IMAGE_MAX_SIZE || 1600); // px, long side
const QUALITY = Number(process.env.IMAGE_QUALITY || 78); // 1–100

/**
 * @returns {{ buffer: Buffer, mimetype: string, ext: string, width: number, height: number }}
 */
export async function compressImage(input, mimetype) {
  // Animated GIFs are kept as they are (re-encoding would drop the animation).
  if (mimetype === 'image/gif') {
    const meta = await sharp(input, { animated: true }).metadata();
    if ((meta.pages || 1) > 1) return { buffer: input, mimetype, ext: '.gif', width: meta.width, height: meta.pageHeight || meta.height };
  }

  const { data, info } = await sharp(input, { failOn: 'error' })
    .rotate() // honour EXIF orientation, then metadata is dropped
    .resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 4, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });

  return { buffer: data, mimetype: 'image/webp', ext: '.webp', width: info.width, height: info.height };
}
