import type { Request } from 'express';
import type { GuildRow } from '../db/schema';

export interface SessionData {
  userId: string;
  username: string;
  globalName: string | null;
  avatarHash: string | null;
  /** Discord OAuth access token, AES-256-GCM encrypted. */
  accessTokenEnc: string;
  createdAt: number;
  expiresAt: number;
}

export interface AuthedRequest extends Request {
  session?: SessionData;
  sid?: string;
  guild?: GuildRow;
}
