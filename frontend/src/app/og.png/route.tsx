import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/site';

export const alt = 'DexBotX welcome card banner';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#171717',
          color: '#f5f5f5',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center',
          padding: 64,
          whiteSpace: 'pre-wrap',
          fontSize: 38,
          lineHeight: 1.5,
        }}
      >
        {`d+  ${SITE.brandName}\n\n${SITE.tagline}\n\nFree Discord welcome & goodbye bot\n\nby ${SITE.creatorDisplayName}`}
      </div>
    ),
    {
      ...size,
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' },
    },
  );
}
