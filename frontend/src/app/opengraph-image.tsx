import { ImageResponse } from 'next/og';

export const alt = 'DexBotX, free open source Discord bot';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 88,
          background: 'linear-gradient(135deg, #171717 0%, #202b3d 100%)',
          color: '#e8eaed',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ color: '#8ab4f8', fontSize: 28, fontWeight: 700, letterSpacing: 4 }}>
          FREE · OPEN SOURCE · PUBLIC
        </div>
        <div style={{ marginTop: 26, fontSize: 82, fontWeight: 800, letterSpacing: -4 }}>
          DexBotX Discord Bot
        </div>
        <div style={{ marginTop: 24, maxWidth: 920, fontSize: 34, lineHeight: 1.35, color: '#c4c7cc' }}>
          Moderation, welcome messages, auto roles, social notifications, and AI chat.
        </div>
        <div style={{ marginTop: 42, fontSize: 24, color: '#8ab4f8' }}>
          Configured in one easy web dashboard
        </div>
      </div>
    ),
    size,
  );
}
