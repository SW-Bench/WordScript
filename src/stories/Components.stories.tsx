import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Design System/Components',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj;

/* ── Stories ────────────────────────────────────────────────────────────────── */

export const Card: Story = {
  render: () => (
    <div style={{ padding: '32px', background: 'var(--bg)', minHeight: '100vh' }}>
      <h2 style={{ fontSize: 'var(--text-display)', fontWeight: 600, marginBottom: '24px', color: 'var(--fg)' }}>
        Settings Cards
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '520px' }}>
        {/* Provider Card — uses real .settings__provider-card + .form-row */}
        <div className="settings__provider-card">
          <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: 'var(--space-3)' }}>
            Provider Setup
          </div>
          <div className="form-row">
            <label>Cloud Provider</label>
            <div>
              <button className="pill__action-button pill__action-button--primary">Cloud</button>
              <button className="pill__action-button">Local</button>
            </div>
          </div>
          <div className="form-row">
            <label>API Key</label>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--fg-dim)' }}>••••••••gsk_</span>
          </div>
        </div>

        {/* Processing Mode Card */}
        <div className="settings__provider-card">
          <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: 'var(--space-3)' }}>
            Processing Mode
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['Verbatim', 'Cleanup', 'Rewrite', 'Agent'].map((m, i) => (
              <button key={m} className={i === 1 ? 'pill__action-button pill__action-button--primary' : 'pill__action-button'}>
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
      <div className="settings__sidebar" style={{ width: '220px', flexShrink: 0 }}>
        <nav className="settings__nav">
          <div className="settings__nav-group">
            <span className="settings__nav-group-label">Navigation</span>
            <div className="settings__nav-group-stack">
              {[
                { label: 'Dictate', active: true },
                { label: 'Text Rules', active: false },
                { label: 'Modes', active: false },
                { label: 'Provider', active: false },
                { label: 'Input', active: false },
                { label: 'Diagnostics', active: false },
                { label: 'About', active: false },
              ].map(item => (
                <button key={item.label} className={item.active ? 'settings__nav-item settings__nav-item--active' : 'settings__nav-item'}>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="settings__nav-group">
            <span className="settings__nav-group-label">Preview</span>
            <div className="settings__nav-group-stack">
              {['Chat', 'Upload', 'Notes'].map(label => (
                <button key={label} className="settings__nav-item" disabled style={{ opacity: 0.35 }}>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>
      </div>

      <div style={{ flex: 1, padding: '28px', background: 'var(--bg)' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--fg)', marginBottom: '8px' }}>
          Content Area
        </h2>
        <p style={{ color: 'var(--fg-dim)', fontSize: '13px' }}>
          Active nav item shows gradient background with inset highlight.
          Preview items at 35% opacity.
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '400px' }}>
        <label className="form-check">
          <input type="checkbox" defaultChecked />
          <span>Enable Feature</span>
        </label>

        <label className="form-check">
          <input type="checkbox" />
          <span>Auto-detect</span>
        </label>

        <label className="form-check">
          <input type="checkbox" disabled />
          <span>Disabled Option</span>
        </label>
      </div>
    </div>
  ),
};
