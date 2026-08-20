import { ImageResponse } from 'next/og';

export const alt = 'TaazaTokra (તાજાટોકરા) - Fresh Fruits & Vegetables Delivery in Halol';
export const size = {
  width: 1200,
  height: 630,
};
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
          justifyContent: 'space-between',
          padding: '60px 80px',
          background: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #047857 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Top Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '24px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px',
                border: '2px solid rgba(255,255,255,0.2)',
              }}
            >
              🌿
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: '38px', fontWeight: 900, letterSpacing: '-1px' }}>
                <span style={{ color: '#ffffff' }}>Taaza</span>
                <span style={{ color: '#34d399' }}>Tokra</span>
              </div>
              <div style={{ display: 'flex', fontSize: '20px', color: '#a7f3d0', fontWeight: 600 }}>
                તાજાટોકરા • Halol, Gujarat
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              padding: '12px 24px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              fontSize: '18px',
              fontWeight: 700,
              color: '#fef08a',
            }}
          >
            ⚡ Daily Morning Delivery
          </div>
        </div>

        {/* Main Headline Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '30px 0' }}>
          <div
            style={{
              display: 'flex',
              fontSize: '54px',
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: '-1.5px',
              color: '#ffffff',
            }}
          >
            Fresh Fruits &amp; Vegetables Delivered in Halol
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: '32px',
              fontWeight: 700,
              color: '#6ee7b7',
              letterSpacing: '-0.5px',
            }}
          >
            તાજા ફળ, તાજું શાક — સીધું તમારા ઘર સુધી.
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: '22px',
              color: '#d1fae5',
              fontWeight: 500,
              opacity: 0.9,
              maxWidth: '900px',
            }}
          >
            Sourced daily from APMC Mandi with doorstep Cash on Delivery (COD).
          </div>
        </div>

        {/* Footer Badges Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '14px 28px',
              borderRadius: '20px',
              background: '#f59e0b',
              color: '#0f172a',
              fontSize: '20px',
              fontWeight: 900,
            }}
          >
            🎁 10% OFF with FIRST500
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '14px 28px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              fontSize: '20px',
              fontWeight: 700,
              color: '#ffffff',
            }}
          >
            💵 2% Cash on Delivery Discount
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '14px 28px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              fontSize: '20px',
              fontWeight: 700,
              color: '#ffffff',
            }}
          >
            🚚 ₹200 Minimum Order
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
