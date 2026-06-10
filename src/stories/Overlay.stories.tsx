import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Design System/Overlay',
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'gradient-dark' },
  },
};

export default meta;

type Story = StoryObj;

/* ── Shared Overlay Styles (from screenshots) ─────────────────────────────── */

const pillBase = {
  display: 'flex' as const,
  alignItems: 'center' as const,
  gap: '10px',
  padding: '8px 14px',
  borderRadius: '999px',
  background: 'rgba(13, 16, 23, 0.88)',
  backdropFilter: 'blur(24px) saturate(1.3)',
  WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.4)',
};

const pillButton = {
  padding: '5px 12px',
  borderRadius: '999px',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  border: 'none',
  cursor: 'pointer',
};

const waveBar = (height: number) => ({
  width: '3px',
  height: `${height}px`,
  borderRadius: '2px',
  background: 'rgba(255,255,255,0.75)',
});

/* ── Stories ──────────────────────────────────────────────────────────────── */

export const DoneState: Story = {
  render: () => (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f1418 0%, #1a2332 100%)',
    }}>
      <div style={pillBase}>
        <button style={{ ...pillButton, background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
          Copy
        </button>
        <button style={{ ...pillButton, background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
          Edit
        </button>
        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Done</span>
          <span style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Deserters</span>
        </div>
      </div>
    </div>
  ),
};

export const RecordingState: Story = {
  render: () => (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f1418 0%, #1a2332 100%)',
    }}>
      <div style={{
        ...pillBase,
        padding: '10px 16px',
        gap: '14px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 24px rgba(230, 137, 0, 0.25), 0 8px 32px rgba(0,0,0,0.4)',
      }}>
        {/* Mic Icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>

        {/* Waveform */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '28px' }}>
          {[12, 18, 10, 22, 16, 8, 20, 14, 24, 10, 16, 20, 12, 18, 8, 14, 22, 16].map((h, i) => (
            <div key={i} style={waveBar(h)} />
          ))}
        </div>

        {/* Timer + Agent */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>00:06</span>
          <span style={{ fontSize: '8px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>Agent</span>
        </div>
      </div>
    </div>
  ),
};

export const ProcessingState: Story = {
  render: () => (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f1418 0%, #1a2332 100%)',
    }}>
      <div style={pillBase}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e68900" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--accent)' }}>Processing...</span>
      </div>
    </div>
  ),
};

export const ReadyState: Story = {
  render: () => (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f1418 0%, #1a2332 100%)',
    }}>
      <div style={pillBase}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        </svg>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>Ready</span>
      </div>
    </div>
  ),
};

export const EditModal: Story = {
  render: () => (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f1418 0%, #1a2332 100%)',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        padding: '16px',
        borderRadius: '16px',
        background: 'rgba(13, 16, 23, 0.92)',
        backdropFilter: 'blur(24px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <textarea
          defaultValue="edit test"
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '12px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: '13px',
            fontFamily: 'var(--font)',
            lineHeight: 1.5,
            resize: 'none',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button style={{ ...pillButton, background: 'var(--accent)', color: '#0f1418' }}>
            Confirm
          </button>
          <button style={{ ...pillButton, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  ),
};

export const AllStates: Story = {
  render: () => (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '24px',
      background: 'linear-gradient(135deg, #0f1418 0%, #1a2332 100%)',
      padding: '48px',
    }}>
      <ReadyState.render />
      <RecordingState.render />
      <ProcessingState.render />
      <DoneState.render />
      <EditModal.render />
    </div>
  ),
};
