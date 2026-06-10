import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Design System/Tokens',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj;

export const Colors: Story = {
  render: () => (
    <div style={{ padding: '24px', background: 'var(--bg)', minHeight: '100vh' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', color: 'var(--fg)' }}>
        Color Tokens
      </h2>
      
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '16px' }}>
          Backgrounds
        </h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <ColorSwatch name="--bg" value="#0f1418" />
          <ColorSwatch name="--bg-elevated" value="#161d23" />
          <ColorSwatch name="--sidebar" value="rgba(13, 18, 23, 0.88)" />
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '16px' }}>
          Surfaces
        </h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <ColorSwatch name="--surface" value="rgba(22, 29, 35, 0.92)" />
          <ColorSwatch name="--surface-elevated" value="#1b242c" />
          <ColorSwatch name="--surface-strong" value="#202a33" />
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '16px' }}>
          Accent (SW-labs Orange)
        </h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <ColorSwatch name="--accent" value="#e68900" />
          <ColorSwatch name="--accent-hover" value="#ff9800" />
          <ColorSwatch name="--accent-strong" value="#f5a623" />
          <ColorSwatch name="--accent-soft" value="rgba(230, 137, 0, 0.15)" />
          <ColorSwatch name="--accent-muted" value="#2c1e16" />
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '16px' }}>
          Foregrounds
        </h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <ColorSwatch name="--fg" value="#f3efe4" />
          <ColorSwatch name="--fg-dim" value="#92a0ad" />
          <ColorSwatch name="--fg-muted" value="#667380" />
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '16px' }}>
          Semantic
        </h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
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
    <div style={{ padding: '24px', background: 'var(--bg)', minHeight: '100vh' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', color: 'var(--fg)' }}>
        Typography Scale
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <TypeSample token="--text-display-lg" size="28px" weight={600} />
        <TypeSample token="--text-display" size="24px" weight={600} />
        <TypeSample token="--text-title" size="18px" weight={600} />
        <TypeSample token="--text-body-lg" size="15px" weight={400} />
        <TypeSample token="--text-body" size="13px" weight={400} />
        <TypeSample token="--text-body-sm" size="12px" weight={400} />
        <TypeSample token="--text-label" size="11px" weight={500} uppercase />
        <TypeSample token="--text-caption" size="10px" weight={500} uppercase />
      </div>
    </div>
  ),
};

export const Spacing: Story = {
  render: () => (
    <div style={{ padding: '24px', background: 'var(--bg)', minHeight: '100vh' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', color: 'var(--fg)' }}>
        Spacing Scale (4pt Grid)
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

function ColorSwatch({ name, value }: { name: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '12px',
          background: value,
          border: '1px solid var(--border)',
        }}
      />
      <span style={{ fontSize: '10px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{name}</span>
    </div>
  );
}

function TypeSample({ token, size, weight, uppercase }: { token: string; size: string; weight: number; uppercase?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
      <span style={{ fontSize: '10px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', width: '140px', flexShrink: 0 }}>
        {token}
      </span>
      <span style={{ fontSize: size, fontWeight, textTransform: uppercase ? 'uppercase' : 'none', letterSpacing: uppercase ? '0.05em' : 'normal', color: 'var(--fg)' }}>
        The quick brown fox jumps over the lazy dog
      </span>
    </div>
  );
}

function SpacingSample({ token, value }: { token: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <span style={{ fontSize: '10px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', width: '100px', flexShrink: 0 }}>
        {token}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: value, height: '20px', background: 'var(--accent)', borderRadius: '2px' }} />
        <span style={{ fontSize: '12px', color: 'var(--fg-dim)' }}>{value}px</span>
      </div>
    </div>
  );
}
