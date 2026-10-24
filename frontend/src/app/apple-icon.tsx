import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 36,
          background: '#171717',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: 999,
            background: '#8ab4f8',
            color: '#171717',
            fontFamily: 'Arial, sans-serif',
            fontSize: 100,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          d
        </div>
      </div>
    ),
    size,
  );
}
