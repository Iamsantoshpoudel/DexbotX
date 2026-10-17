import { createHash } from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { BadRequestException } from '@nestjs/common';

const CARD_W = 1100;
const CARD_H = 400;
const MAX_SIDE = 4096;
const MAX_PIXELS = 16_000_000;
const MIN_SIDE = 200;

export type ImageKind = 'png' | 'jpeg' | 'webp';

/**
 * Reads the declared size from the file header WITHOUT decoding pixels, so a tiny file that
 * claims to be 60000x60000 is rejected before it can exhaust memory ("decompression bomb").
 */
export function probeImage(buf: Buffer): { kind: ImageKind; width: number; height: number } | null {
  if (buf.length >= 24 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { kind: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xff) {
        i++;
        continue;
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = buf.readUInt16BE(i + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { kind: 'jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
    return null;
  }
  if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { kind: 'webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { kind: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { kind: 'webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

/**
 * Validates, decodes and re-encodes an upload as a 1100x400 JPEG (cover crop).
 * Re-encoding strips metadata and any payload hidden in the original file.
 */
export async function processBackground(input: Buffer): Promise<{ data: Buffer; hash: string }> {
  const probe = probeImage(input);
  if (!probe) throw new BadRequestException('Upload a PNG, JPEG or WebP image');
  if (probe.width < MIN_SIDE || probe.height < MIN_SIDE) throw new BadRequestException(`Image must be at least ${MIN_SIDE}x${MIN_SIDE}px`);
  if (probe.width > MAX_SIDE || probe.height > MAX_SIDE || probe.width * probe.height > MAX_PIXELS) {
    throw new BadRequestException(`Image is too large (max ${MAX_SIDE}px per side)`);
  }

  let img;
  try {
    img = await loadImage(input);
  } catch {
    throw new BadRequestException('That file is not a valid image');
  }
  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx = canvas.getContext('2d');
  const scale = Math.max(CARD_W / img.width, CARD_H / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (CARD_W - dw) / 2, (CARD_H - dh) / 2, dw, dh);
  const data = await canvas.encode('jpeg', 85);
  return { data, hash: createHash('sha256').update(data).digest('hex') };
}
