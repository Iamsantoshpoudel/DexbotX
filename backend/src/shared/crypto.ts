import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** AES-256-GCM. Output format: v1.<iv>.<tag>.<ciphertext> (base64url). */
const GCM_AUTH_TAG_LENGTH = 16;
const GCM_IV_LENGTH = 12;

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(GCM_IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: GCM_AUTH_TAG_LENGTH });
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.');
}

export function decrypt(payload: string, key: Buffer): string {
  const [version, iv, tag, ct] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !ct) throw new Error('Invalid ciphertext');
  const ivBytes = Buffer.from(iv, 'base64url');
  const tagBytes = Buffer.from(tag, 'base64url');
  if (ivBytes.length !== GCM_IV_LENGTH || tagBytes.length !== GCM_AUTH_TAG_LENGTH) {
    throw new Error('Invalid ciphertext');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, ivBytes, { authTagLength: GCM_AUTH_TAG_LENGTH });
  decipher.setAuthTag(tagBytes);
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
