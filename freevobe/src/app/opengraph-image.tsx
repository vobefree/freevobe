import { ImageResponse } from 'next/og';

// Bilden ritas en gång vid bygget och läggs som en statisk fil i exporten.
export const dynamic = 'force-static';

export const alt = 'Freevobe – vobe with Ollama';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: 'linear-gradient(160deg, #08080c 0%, #050505 55%, #0d0a1a 100%)',
          color: '#f6f6f8',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #a78bfa, #7c3aed 55%, #2dd4bf)',
            }}
          />
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>Freevobe</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 82, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>
            Vobe with Ollama.
          </div>
          <div style={{ fontSize: 30, color: '#9b9baa', maxWidth: 900, lineHeight: 1.35 }}>
            Local-first AI coding agent. No API keys, no token counting, no cloud dependency.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 24,
            color: '#9b9baa',
          }}
        >
          <div style={{ display: 'flex', gap: 12 }}>
            <span
              style={{
                padding: '8px 16px',
                borderRadius: 999,
                border: '1px solid #2c2c3a',
                color: '#2dd4bf',
              }}
            >
              Local-first
            </span>
            <span
              style={{
                padding: '8px 16px',
                borderRadius: 999,
                border: '1px solid #2c2c3a',
              }}
            >
              No tokens. No limits. Just vibes.
            </span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 22, color: '#8b5cf6' }}>
            freevobe.dev
          </div>
        </div>
      </div>
    ),
    size,
  );
}
