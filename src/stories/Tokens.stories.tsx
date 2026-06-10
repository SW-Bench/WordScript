import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Design System/Tokens',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj;

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function ColorSwatch({ name, value }: { name: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ width: '72px', height: '72px', borderRadius: '10px', background: value, border: '1px solid rgba(255,255,255,0.06)' }} />
      <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>{name}</span>
    </div>
  );
}

function TypeSample({ token, size, weight, lh, ls, uppercase, color = 'var(--fg)' }: { token: string; size: string; weight: number; lh?: string; ls?: string; uppercase?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
      <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', width: '150px', flexShrink: 0 }}>
        {token}
      </span>
      <span style={{ fontSize: size, fontWeight: weight, lineHeight: lh || 1.4, letterSpacing: ls || 'normal', textTransform: uppercase ? 'uppercase' : 'none', color }}>
        The quick brown fox jumps over the lazy dog
      </span>
    </div>
  );
}

function SpacingSample({ token, value }: { token: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', width: '100px', flexShrink: 0 }}>{token}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: value, height: '16px', background: 'var(--accent)', borderRadius: '2px' }} />
        <span style={{ fontSize: '11px', color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)' }}>{value}px</span>
      </div>
    </div>
  );
}

/* ── Stories ──────────────────────────────────────────────────────────────── */

export const Colors: Story = {
  render: () => (
    <div style={{ padding: '32px', background: 'var(--bg)', minHeight: '100vh' }}>
      <h2 style={{ fontSize: 'var(--text-display)', fontWeight: 600, marginBottom: '32px', color: 'var(--fg)' }}>
        Color Tokens
      </h2>

      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: 'var(--text-label)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-muted)', marginBottom: '16px' }}>
          Backgrounds
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <ColorSwatch name="--bg" value="#0f1418" />
          <ColorSwatch name="--bg-elevated" value="#161d23" />
          <ColorSwatch name="--sidebar" value="rgba(13, 18, 23, 0.88)" />
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: 'var(--text-label)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-muted)', marginBottom: '16px' }}>
          Surfaces
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <ColorSwatch name="--surface" value="rgba(22, 29, 35, 0.92)" />
          <ColorSwatch name="--surface-elevated" value="#1b242c" />
          <ColorSwatch name="--surface-strong" value="#202a33" />
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: 'var(--text-label)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-muted)', marginBottom: '16px' }}>
          Accent (SW-labs Orange)
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <ColorSwatch name="--accent" value="#e68900" />
          <ColorSwatch name="--accent-hover" value="#ff9800" />
          <ColorSwatch name="--accent-strong" value="#f5a623" />
          <ColorSwatch name="--accent-soft" value="rgba(230, 137, 0, 0.15)" />
          <ColorSwatch name="--accent-muted" value="#2c1e16" />
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: 'var(--text-label)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-muted)', marginBottom: '16px' }}>
          Foregrounds
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <ColorSwatch name="--fg" value="#f3efe4" />
          <ColorSwatch name="--fg-dim" value="#92a0ad" />
          <ColorSwatch name="--fg-muted" value="#667380" />
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: 'var(--text-label)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-muted)', marginBottom: '16px' }}>
          Semantic
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <ColorSwatch name="--green" value="#81d6ae" />
          <ColorSwatch name="--red" value="#ff7a6b" />
          <ColorSwatch name="--voice" value="#87e6d7" />
        </div>
      </section>
    </div>
  ),
};

export const Typography: Story = {
  render: () => (
    <div style={{ padding: '32px', background: 'var(--bg)', minHeight: '100vh' }}>
      <h2 style={{ fontSize: 'var(--text-display)', fontWeight: 600, marginBottom: '32px', color: 'var(--fg)' }}>
        Typography Scale
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <TypeSample token="display-lg / 28px / 600" size="28px" weight={600} lh="1.2" />
        <TypeSample token="display / 24px / 600" size="24px" weight={600} lh="1.3" />
        <TypeSample token="title / 18px / 600" size="18px" weight={600} lh="1.4" />
        <TypeSample token="body-lg / 15px / 400" size="15px" weight={400} lh="1.5" />
        <TypeSample token="body / 13px / 400" size="13px" weight={400} lh="1.5" />
        <TypeSample token="body-sm / 12px / 400" size="12px" weight={400} lh="1.5" color="var(--fg-dim)" />
        <TypeSample token="label / 11px / 500" size="11px" weight={500} ls="0.05em" uppercase color="var(--fg-muted)" />
        <TypeSample token="caption / 10px / 500" size="10px" weight={500} ls="0.08em" uppercase color="var(--fg-muted)" />
      </div>

      <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 'var(--text-label)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-muted)', marginBottom: '16px' }}>
          Font Stack
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--fg-dim)' }}>
          <span>Display: Aptos Display, SF Pro Display, Segoe UI Variable Display</span>
          <span>Body: Aptos, SF Pro Text, Segoe UI Variable</span>
          <span>Mono: IBM Plex Mono, Cascadia Code, SF Mono</span>
        </div>
      </div>
    </div>
  ),
};

export const Spacing: Story = {
  render: () => (
    <div style={{ padding: '32px', background: 'var(--bg)', minHeight: '100vh' }}>
      <h2 style={{ fontSize: 'var(--text-display)', fontWeight: 600, marginBottom: '32px', color: 'var(--fg)' }}>
        Spacing Scale (4pt Grid)
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <SpacingSample token="--space-1" value={4} />
        <SpacingSample token="--space-2" value={8} />
        <SpacingSample token="--space-3" value={12} />
        <SpacingSample token="--space-4" value={16} />
        <SpacingSample token="--space-5" value={20} />
        <SpacingSample token="--space-6" value={24} />
        <SpacingSample token="--space-8" value={32} />
        <SpacingSample token="--space-10" value={40} />
      </div>
    </div>
  ),
};

export const Radius: Story = {
  render: () => (
    <div style={{ padding: '32px', background: 'var(--bg)', minHeight: '100vh' }}>
      <h2 style={{ fontSize: 'var(--text-display)', fontWeight: 600, marginBottom: '32px', color: 'var(--fg)' }}>
        Border Radius
      </h2>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {[
          { name: 'badge', r: '4px', size: 40 },
          { name: 'button', r: '8px', size: 48 },
          { name: 'card', r: '12px', size: 80 },
          { name: 'pill', r: '20px', size: 48 },
          { name: 'lg', r: '24px', size: 80 },
        ].map(({ name, r, size }) => (
          <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: size, height: size, borderRadius: r, background: 'var(--surface-elevated)', border: '1px solid var(--border)' }} />
            <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{name} / {r}</span>
          </div>
        ))}
      </div>
    </div>
  ),
};
