import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #059669 0%, #047857 50%, #022c22 100%)',
          borderRadius: '40px',
          border: '4px solid rgba(52, 211, 153, 0.4)',
          position: 'relative',
        }}
      >
        <div style={{ fontSize: 82, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          🌿
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.5px',
            fontFamily: 'sans-serif',
            marginTop: -4,
          }}
        >
          TaazaTokra
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
