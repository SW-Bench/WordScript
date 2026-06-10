import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Design System/Components',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj;

export const Card: Story = {
  render: () => (
    <div style={{ padding: '24px', background: 'var(--bg)', minHeight: '100vh' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', color: 'var(--fg)' }}>
        Card Component
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
        <div className="ws-card">
          <div className="ws-card-title">Default Card</div>
          <p style={{ color: 'var(--fg-dim)', fontSize: '13px' }}>
            This is a standard settings card with title and content. 
            Elevation is achieved through background color, not shadow.
          </p>
        </div>

        <div className="ws-card">
          <div className="ws-card-title">Card with Controls</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--fg)', fontSize: '13px' }}>Enable Feature</span>
              <div style={{ width: '28px', height: '16px', background: 'var(--accent)', borderRadius: '8px', position: 'relative' }}>
                <div style={{ width: '14px', height: '14px', background: 'white', borderRadius: '50%', position: 'absolute', right: '1px', top: '1px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--fg)', fontSize: '13px' }}>Another Setting</span>
              <div style={{ width: '28px', height: '16px', background: 'var(--surface-strong)', borderRadius: '8px', position: 'relative' }}>
                <div style={{ width: '14px', height: '14px', background: 'var(--fg-dim)', borderRadius: '50%', position: 'absolute', left: '1px', top: '1px' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};

export const Buttons: Story = {
  render: () => (
    <div style={{ padding: '24px', background: 'var(--bg)', minHeight: '100vh' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', color: 'var(--fg)' }}>
        Button Variants
      </h2>
      
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button className="ws-btn-primary">Primary Action</button>
        <button className="ws-btn-secondary">Secondary</button>
        <button className="ws-btn-secondary" style={{ background: 'transparent', color: 'var(--fg-dim)' }}>
          Ghost
        </button>
      </div>
    </div>
  ),
};

export const SidebarNavigation: Story = {
  render: () => (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: '200px', background: 'var(--sidebar)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div className="ws-sidebar-item active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
          <span>Dictate</span>
        </div>
        <div className="ws-sidebar-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
          </svg>
          <span>Text Rules</span>
        </div>
        <div className="ws-sidebar-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          <span>Modes</span>
        </div>
        
        <div style={{ height: '16px' }} />
        
        <div className="ws-sidebar-item preview">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>Chat</span>
        </div>
        <div className="ws-sidebar-item preview">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Upload</span>
        </div>
      </div>
      
      <div style={{ flex: 1, padding: '24px', background: 'var(--bg)' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--fg)' }}>
          Content Area
        </h2>
        <p style={{ color: 'var(--fg-dim)', marginTop: '8px' }}>
          Active sidebar item shows orange accent strip. Preview items are at 35% opacity.
        </p>
      </div>
    </div>
  ),
};

export const OverlayPill: Story = {
  render: () => (
    <div style={{ padding: '48px', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '32px', alignItems: 'center' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#fff' }}>
        Overlay Pill States
      </h2>
      
      {/* Idle */}
      <div className="ws-pill" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--fg-dim)" strokeWidth="1.5">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        </svg>
        <span style={{ color: 'var(--fg-dim)', fontSize: '13px' }}>Ready</span>
      </div>

      {/* Recording */}
      <div className="ws-pill" style={{ 
        padding: '12px 20px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        boxShadow: '0 0 20px rgba(230, 137, 0, 0.4), 0 4px 16px rgba(0,0,0,0.3)'
      }}>
        <div style={{ width: '10px', height: '10px', background: 'var(--red)', borderRadius: '50%' }} />
        <span style={{ color: 'var(--fg)', fontSize: '13px', fontWeight: 500 }}>Recording</span>
        <span style={{ color: 'var(--fg-dim)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>00:12</span>
      </div>

      {/* Processing */}
      <div className="ws-pill" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <span style={{ color: 'var(--accent)', fontSize: '13px' }}>Processing...</span>
      </div>
    </div>
  ),
};
