import { ImageResponse } from 'next/og';

export const size = {
  width: 512,
  height: 512,
};
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: '128px',
          border: '12px solid rgba(52, 211, 153, 0.4)',
          position: 'relative',
        }}
      >
        <div
          style={{
            fontSize: '220px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            filter: 'drop-shadow(0 16px 20px rgba(0,0,0,0.35))',
          }}
        >
          🌿
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            fontWeight: 900,
            letterSpacing: '-1px',
            fontFamily: 'sans-serif',
            marginTop: '-10px',
          }}
        >
          <span style={{ color: '#ffffff' }}>Taaza</span>
          <span style={{ color: '#34d399' }}>Tokra</span>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: '26px',
            fontWeight: 700,
            color: '#a7f3d0',
            marginTop: '2px',
          }}
        >
          તાજાટોકરા
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
