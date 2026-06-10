import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Design System/Components',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj;

/* ── Shared Styles ────────────────────────────────────────────────────────── */

const glassSurface = {
  background: 'rgba(13, 16, 23, 0.88)',
  backdropFilter: 'blur(24px) saturate(1.3)',
  WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.3)',
};

const pillBtn = {
  padding: '5px 12px',
  borderRadius: '999px',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  border: 'none',
  cursor: 'pointer',
};

/* ── Stories ──────────────────────────────────────────────────────────────── */

export const Card: Story = {
  render: () => (
    <div style={{ padding: '32px', background: 'var(--bg)', minHeight: '100vh' }}>
      <h2 style={{ fontSize: 'var(--text-display)', fontWeight: 600, marginBottom: '24px', color: 'var(--fg)' }}>
        Glass Card
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '520px' }}>
        <div style={{ ...glassSurface, borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '16px' }}>
            Provider Setup
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--fg)', fontSize: '13px' }}>Cloud Provider</span>
              <div style={{ display: 'flex', gap: '4px', padding: '2px', background: 'var(--surface-strong)', borderRadius: '8px' }}>
                <button style={{ ...pillBtn, background: 'var(--surface-elevated)', color: 'var(--accent)' }}>Cloud</button>
                <button style={{ ...pillBtn, background: 'transparent', color: 'var(--fg-dim)' }}>Local</button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--fg)', fontSize: '13px' }}>API Key</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--fg-dim)' }}>••••••••gsk_</span>
            </div>
          </div>
        </div>

        <div style={{ ...glassSurface, borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '16px' }}>
            Processing Mode
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['Verbatim', 'Cleanup', 'Rewrite', 'Agent'].map((m, i) => (
              <button key={m} style={{
                ...pillBtn,
                background: i === 1 ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: i === 1 ? '#0f1418' : 'var(--fg-dim)',
              }}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  ),
};

export const Sidebar: Story = {
  render: () => (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{
        width: '200px',
        background: 'var(--sidebar)',
        padding: '12px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        {[
          { icon: 'mic', label: 'Dictate', active: true },
          { icon: 'book', label: 'Text Rules', active: false },
          { icon: 'sliders', label: 'Modes', active: false },
          { icon: 'cpu', label: 'Provider', active: false },
          { icon: 'keyboard', label: 'Input', active: false },
          { icon: 'activity', label: 'Diagnostics', active: false },
          { icon: 'info', label: 'About', active: false },
        ].map((item, i) => (
          <div key={item.label} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 10px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.01em',
            textTransform: 'uppercase' as const,
            color: item.active ? 'var(--fg)' : 'var(--fg-dim)',
            background: item.active ? 'rgba(255,255,255,0.04)' : 'transparent',
            cursor: 'pointer',
            position: 'relative',
          }}>
            {item.active && (
              <div style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: '3px',
                height: '16px',
                background: 'var(--accent)',
                borderRadius: '0 2px 2px 0',
              }} />
            )}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={item.active ? 1 : 0.6}>
              {item.icon === 'mic' && <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></>}
              {item.icon === 'book' && <><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" /></>}
              {item.icon === 'sliders' && <><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>}
              {item.icon === 'cpu' && <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M15 2v2" /><path d="M15 20v2" /><path d="M2 15h2" /><path d="M2 9h2" /><path d="M20 15h2" /><path d="M20 9h2" /><path d="M9 2v2" /><path d="M9 20v2" /></>}
              {item.icon === 'keyboard' && <><path d="M10 8h.01" /><path d="M12 12h.01" /><path d="M14 8h.01" /><path d="M16 12h.01" /><path d="M18 8h.01" /><path d="M6 12h.01" /><path d="M8 8h.01" /><rect x="2" y="4" width="20" height="16" rx="2" /></>}
              {item.icon === 'activity' && <><rect x="2" y="2" width="20" height="20" rx="2" /><path d="M18 12h-4" /><path d="M10 12H6" /><path d="M14 16v-4" /><path d="M10 8v4" /></>}
              {item.icon === 'info' && <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>}
            </svg>
            <span>{item.label}</span>
          </div>
        ))}

        <div style={{ height: '12px' }} />

        {[
          { icon: 'message', label: 'Chat' },
          { icon: 'upload', label: 'Upload' },
          { icon: 'notebook', label: 'Notes' },
        ].map(item => (
          <div key={item.label} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 10px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.01em',
            textTransform: 'uppercase' as const,
            color: 'var(--fg-muted)',
            opacity: 0.35,
            cursor: 'not-allowed',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              {item.icon === 'message' && <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>}
              {item.icon === 'upload' && <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>}
              {item.icon === 'notebook' && <><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9.4" /><path d="M2 6h4" /><path d="M2 10h4" /><path d="M2 14h4" /><path d="M2 18h4" /><path d="M18.4 2.6a2.17 2.17 0 0 1 3 3L16 11l-4 1 1-4Z" /></>}
            </svg>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: '28px', background: 'var(--bg)' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--fg)', marginBottom: '8px' }}>
          Content Area
        </h2>
        <p style={{ color: 'var(--fg-dim)', fontSize: '13px' }}>
          Active sidebar item shows 3px orange accent strip. Preview items at 35% opacity.
        </p>
      </div>
    </div>
  ),
};

export const Toggle: Story = {
  render: () => (
    <div style={{ padding: '32px', background: 'var(--bg)', minHeight: '100vh' }}>
      <h2 style={{ fontSize: 'var(--text-display)', fontWeight: 600, marginBottom: '24px', color: 'var(--fg)' }}>
        Toggle Switch
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '300px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--fg)' }}>Enable Feature</span>
          <div style={{
            width: '36px',
            height: '20px',
            background: 'var(--accent)',
            borderRadius: '10px',
            position: 'relative',
            cursor: 'pointer',
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              background: '#fff',
              borderRadius: '50%',
              position: 'absolute',
              right: '2px',
              top: '2px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--fg)' }}>Auto-detect</span>
          <div style={{
            width: '36px',
            height: '20px',
            background: 'var(--surface-strong)',
            borderRadius: '10px',
            position: 'relative',
            cursor: 'pointer',
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              background: 'var(--fg-dim)',
              borderRadius: '50%',
              position: 'absolute',
              left: '2px',
              top: '2px',
            }} />
          </div>
        </div>
      </div>
    </div>
  ),
};
