import { ImageResponse } from 'next/og';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#171717',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 360,
            height: 360,
            borderRadius: 999,
            background: '#8ab4f8',
            color: '#171717',
            fontFamily: 'Arial, sans-serif',
            fontSize: 280,
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
    { width: 512, height: 512 },
  );
}
