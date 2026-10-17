import { Injectable, Logger } from '@nestjs/common';
import { createCanvas, GlobalFonts, Image, loadImage, SKRSContext2D } from '@napi-rs/canvas';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Semaphore } from '../shared/semaphore';
import type { ImageStyleId } from '../shared/message-config';

export interface CardOptions {
  style: ImageStyleId;
  title: string;
  subtitle: string;
  name: string;
  accentColor: string;
  avatarShape: 'circle' | 'rounded';
  showMemberCount: boolean;
  memberCountText: string;
  avatar: Buffer | null;
  banner: Buffer | null;
}

interface StyleDef {
  stops: string[];
  glows: Array<{ x: number; y: number; r: number; color: string; alpha: number }>;
}

const W = 1100;
const H = 400;
const FONT = '"Inter", "Noto Sans Devanagari", "Noto Sans", "Liberation Sans", sans-serif';

const STYLES: Record<ImageStyleId, StyleDef> = {
  midnight: {
    stops: ['#0d0e2b', '#1a1a4a', '#2b2070'],
    glows: [
      { x: 180, y: 200, r: 360, color: '#7c6cff', alpha: 0.35 },
      { x: 1000, y: 40, r: 300, color: '#3b82f6', alpha: 0.18 },
    ],
  },
  sunset: {
    stops: ['#241030', '#6b2542', '#d9622b'],
    glows: [
      { x: 180, y: 200, r: 360, color: '#fb923c', alpha: 0.3 },
      { x: 1050, y: 380, r: 380, color: '#f43f5e', alpha: 0.25 },
    ],
  },
  aurora: {
    stops: ['#04141c', '#0a3438', '#0f4f48'],
    glows: [
      { x: 200, y: 200, r: 360, color: '#34d399', alpha: 0.3 },
      { x: 950, y: 60, r: 340, color: '#6366f1', alpha: 0.28 },
    ],
  },
  neon: {
    stops: ['#06030f', '#140a2c', '#0a1838'],
    glows: [
      { x: 180, y: 200, r: 340, color: '#22d3ee', alpha: 0.32 },
      { x: 1000, y: 340, r: 360, color: '#e879f9', alpha: 0.3 },
    ],
  },
  ocean: {
    stops: ['#04122a', '#0a2c58', '#0d5384'],
    glows: [
      { x: 200, y: 200, r: 360, color: '#38bdf8', alpha: 0.3 },
      { x: 1000, y: 380, r: 300, color: '#2dd4bf', alpha: 0.18 },
    ],
  },
  minimal: { stops: ['#14161b', '#1b1e25'], glows: [] },
};

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

@Injectable()
export class RenderService {
  private readonly logger = new Logger(RenderService.name);
  private readonly limiter = new Semaphore(4);
  private static fontsRegistered = false;

  constructor() {
    RenderService.registerFonts(this.logger);
  }

  private static registerFonts(logger: Logger): void {
    if (RenderService.fontsRegistered) return;
    RenderService.fontsRegistered = true;
    const tryRegister = (pkg: string, files: string[], family: string) => {
      try {
        const root = join(dirname(require.resolve(`${pkg}/package.json`)), 'files');
        for (const f of files) {
          const p = join(root, f);
          if (existsSync(p)) GlobalFonts.registerFromPath(p, family);
        }
      } catch {
        logger.warn(`Font package ${pkg} not found; falling back to system fonts`);
      }
    };
    tryRegister(
      '@fontsource/inter',
      ['inter-latin-400-normal.woff', 'inter-latin-700-normal.woff', 'inter-latin-800-normal.woff'],
      'Inter',
    );
    tryRegister(
      '@fontsource/noto-sans-devanagari',
      ['noto-sans-devanagari-devanagari-400-normal.woff', 'noto-sans-devanagari-devanagari-700-normal.woff'],
      'Noto Sans Devanagari',
    );
  }

  /** Renders the 1100x400 welcome/goodbye card as PNG. Concurrency is capped so join raids cannot starve the process. */
  renderCard(opts: CardOptions): Promise<Buffer> {
    return this.limiter.run(() => this.draw(opts));
  }

  private async safeLoad(buf: Buffer | null): Promise<Image | null> {
    if (!buf) return null;
    try {
      return await loadImage(buf);
    } catch {
      return null;
    }
  }

  private async draw(o: CardOptions): Promise<Buffer> {
    const [avatar, banner] = await Promise.all([this.safeLoad(o.avatar), this.safeLoad(o.banner)]);
    const style = STYLES[o.style] ?? STYLES.midnight;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Rounded outer shape so the corners are transparent inside Discord.
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 28);
    ctx.clip();

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, W, H);
    style.stops.forEach((c, i) => bg.addColorStop(style.stops.length === 1 ? 0 : i / (style.stops.length - 1), c));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    if (banner) {
      this.drawCover(ctx, banner, 0, 0, W, H);
      const shade = ctx.createLinearGradient(0, 0, W, 0);
      shade.addColorStop(0, 'rgba(6, 7, 18, 0.82)');
      shade.addColorStop(1, 'rgba(6, 7, 18, 0.5)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, H);
    } else {
      for (const g of style.glows) {
        const rg = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
        rg.addColorStop(0, rgba(g.color, g.alpha));
        rg.addColorStop(1, rgba(g.color, 0));
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // Avatar
    const size = 232;
    const cx = 210;
    const cy = H / 2;
    const x = cx - size / 2;
    const y = cy - size / 2;
    const shapePath = (inset = 0) => {
      ctx.beginPath();
      if (o.avatarShape === 'circle') ctx.arc(cx, cy, size / 2 - inset, 0, Math.PI * 2);
      else ctx.roundRect(x + inset, y + inset, size - inset * 2, size - inset * 2, 56 - inset);
    };

    ctx.save();
    ctx.shadowColor = rgba(o.accentColor, 0.65);
    ctx.shadowBlur = 40;
    shapePath();
    ctx.fillStyle = '#0b0c1a';
    ctx.fill();
    ctx.restore();

    ctx.save();
    shapePath(8);
    ctx.clip();
    if (avatar) {
      this.drawCover(ctx, avatar, x + 8, y + 8, size - 16, size - 16);
    } else {
      ctx.fillStyle = rgba(o.accentColor, 0.35);
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 110px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((Array.from(o.name)[0] ?? '?').toUpperCase(), cx, cy + 6);
    }
    ctx.restore();

    shapePath(4);
    ctx.lineWidth = 8;
    ctx.strokeStyle = o.accentColor;
    ctx.stroke();

    // Text block
    const tx = 380;
    const maxW = W - tx - 60;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    if (o.title.trim()) {
      ctx.font = `700 28px ${FONT}`;
      ctx.letterSpacing = '4px';
      ctx.fillStyle = o.accentColor;
      ctx.fillText(this.ellipsize(ctx, o.title.trim(), maxW), tx, 124);
      ctx.letterSpacing = '0px';
    }

    let nameSize = 70;
    ctx.font = `800 ${nameSize}px ${FONT}`;
    while (ctx.measureText(o.name).width > maxW && nameSize > 34) {
      nameSize -= 4;
      ctx.font = `800 ${nameSize}px ${FONT}`;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.ellipsize(ctx, o.name, maxW), tx, 204);

    if (o.subtitle.trim()) {
      ctx.font = `400 30px ${FONT}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
      ctx.fillText(this.ellipsize(ctx, o.subtitle.trim(), maxW), tx, 254);
    }

    if (o.showMemberCount) {
      ctx.font = `700 24px ${FONT}`;
      const label = o.memberCountText;
      const padX = 22;
      const w = ctx.measureText(label).width + padX * 2;
      const py = 292;
      ctx.beginPath();
      ctx.roundRect(tx, py, w, 46, 23);
      ctx.fillStyle = rgba(o.accentColor, 0.16);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(o.accentColor, 0.55);
      ctx.stroke();
      ctx.fillStyle = o.accentColor;
      ctx.textBaseline = 'middle';
      ctx.fillText(label, tx + padX, py + 24);
    }

    // Soft inner border
    ctx.beginPath();
    ctx.roundRect(1, 1, W - 2, H - 2, 27);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.stroke();

    return canvas.encode('png');
  }

  private drawCover(ctx: SKRSContext2D, img: Image, dx: number, dy: number, dw: number, dh: number): void {
    const scale = Math.max(dw / img.width, dh / img.height);
    const sw = dw / scale;
    const sh = dh / scale;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, dx, dy, dw, dh);
  }

  private ellipsize(ctx: SKRSContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    const chars = Array.from(text);
    while (chars.length > 1 && ctx.measureText(`${chars.join('')}…`).width > maxWidth) chars.pop();
    return `${chars.join('')}…`;
  }
}
