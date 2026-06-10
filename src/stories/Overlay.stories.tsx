import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Design System/Overlay',
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'wordscript-dark' },
  },
};

export default meta;

type Story = StoryObj;

/* ─── Constants copied from Master ─────────────────────────────────────────── */

const BAR_COUNT = 11;
const IDLE_WAVEFORM = [4, 5, 6, 8, 10, 12, 10, 8, 6, 5, 4];

/* ─── MicIcon: copied 1:1 from Master ────────────────────────────────────── */

function MicIcon({ muted }: { muted: boolean }) {
  const color = muted ? 'var(--red)' : 'var(--fg)';
  return (
    <svg width="34" height="40" viewBox="0 0 38 46" fill="none" aria-hidden="true">
      <rect x="12" y="3" width="14" height="24" rx="7" fill={color} />
      <path d="M6 21c0 17 26 17 26 0" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" />
      <line x1="19" y1="35" x2="19" y2="41" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <line x1="11" y1="42" x2="27" y2="42" stroke={color} strokeWidth="4" strokeLinecap="round" />
      {muted && (
        <line x1="7" y1="6" x2="31" y2="40" stroke="var(--red)" strokeWidth="4" strokeLinecap="round" />
      )}
    </svg>
  );
}

/* ─── Helper: render bars ────────────────────────────────────────────────── */

function Bars({ heights, muted = false }: { heights: number[]; muted?: boolean }) {
  return (
    <div className="pill__bars" aria-label="Audio level">
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          className={`bar${muted ? ' bar--muted' : ''}`}
          style={{ height: heights[i] ?? 4 }}
        />
      ))}
    </div>
  );
}

/* ─── Stories ──────────────────────────────────────────────────────────────── */

export const ReadyState: Story = {
  render: () => (
    <div className="overlay-shell" style={{ position: 'relative' }}>
      <div className="pill pill--compact">
        <button type="button" className="pill__mic" title="Mute">
          <MicIcon muted={false} />
        </button>
        <div className="pill__center">
          <Bars heights={IDLE_WAVEFORM} />
        </div>
        <div className="pill__divider" />
        <button type="button" className="pill__side" title="Open Settings">
          <span className="pill__side-copy">
            <span className="pill__timer">00:00</span>
            <span className="pill__side-label">Settings</span>
          </span>
        </button>
      </div>
    </div>
  ),
};

export const RecordingState: Story = {
  render: () => (
    <div className="overlay-shell" style={{ position: 'relative' }}>
      <div className="pill pill--compact pill--recording">
        <button type="button" className="pill__mic" title="Mute">
          <MicIcon muted={false} />
        </button>
        <div className="pill__center">
          <Bars heights={[8, 14, 22, 18, 26, 30, 24, 16, 12, 8, 6]} />
        </div>
        <div className="pill__divider" />
        <button type="button" className="pill__side" title="Agent mode · pause recording">
          <span className="pill__side-copy">
            <span className="pill__timer">00:06</span>
            <span className="pill__side-label">Agent</span>
          </span>
        </button>
      </div>
    </div>
  ),
};

export const MutedState: Story = {
  render: () => (
    <div className="overlay-shell" style={{ position: 'relative' }}>
      <div className="pill pill--compact pill--recording pill--muted">
        <button type="button" className="pill__mic" title="Unmute">
          <MicIcon muted={true} />
        </button>
        <div className="pill__center">
          <Bars heights={[6, 8, 10, 12, 14, 16, 14, 12, 10, 8, 6]} muted />
        </div>
        <div className="pill__divider" />
        <button type="button" className="pill__side" title="Agent mode · pause recording">
          <span className="pill__side-copy">
            <span className="pill__timer">00:06</span>
            <span className="pill__side-label">Muted</span>
          </span>
        </button>
      </div>
    </div>
  ),
};

export const PausedState: Story = {
  render: () => (
    <div className="overlay-shell" style={{ position: 'relative' }}>
      <div className="pill pill--compact pill--recording pill--paused">
        <button type="button" className="pill__mic" title="Mute">
          <MicIcon muted={false} />
        </button>
        <div className="pill__center">
          <Bars heights={[4, 5, 6, 8, 10, 12, 10, 8, 6, 5, 4]} />
        </div>
        <div className="pill__divider" />
        <button type="button" className="pill__side" title="Resume recording">
          <span className="pill__side-copy">
            <span className="pill__timer">00:06</span>
            <span className="pill__side-label">Paused</span>
          </span>
        </button>
      </div>
    </div>
  ),
};

export const ProcessingState: Story = {
  render: () => (
    <div className="overlay-shell" style={{ position: 'relative' }}>
      <div className="pill pill--compact pill--processing">
        <button type="button" className="pill__mic" title="Mute">
          <MicIcon muted={false} />
        </button>
        <div className="pill__center">
          <div className="pill__bars" aria-label="Audio level">
            {Array.from({ length: BAR_COUNT }, (_, i) => (
              <div key={i} className="bar" style={{ height: IDLE_WAVEFORM[i] }} />
            ))}
          </div>
        </div>
        <div className="pill__divider" />
        <button type="button" className="pill__side" title="Cleanup mode · processing">
          <span className="pill__side-copy">
            <span className="pill__timer">00:06</span>
            <span className="pill__side-label">Cleanup</span>
          </span>
        </button>
      </div>
    </div>
  ),
};

export const DoneState: Story = {
  render: () => (
    <div className="overlay-shell" style={{ position: 'relative' }}>
      <div className="pill pill--result-actions">
        <div className="pill__center pill__center--actions">
          <div className="pill__action-strip" aria-label="Result actions">
            <button type="button" className="pill__action-button">Copy</button>
            <button type="button" className="pill__action-button">Edit</button>
          </div>
        </div>
        <div className="pill__divider" />
        <button type="button" className="pill__side pill__side--action" title="Dismiss">
          <span className="pill__side-copy">
            <span className="pill__timer">Done</span>
            <span className="pill__side-label">Dismiss</span>
          </span>
        </button>
      </div>
    </div>
  ),
};

export const EditModal: Story = {
  render: () => (
    <div className="overlay-shell" style={{ position: 'relative' }}>
      <div className="pill pill--edit-mode">
        <div className="pill__edit-body">
          <textarea
            className="pill__edit-textarea"
            defaultValue="edit test"
            aria-label="Edit transcription text"
          />
          <div className="pill__edit-footer">
            <button type="button" className="pill__action-button pill__action-button--primary">
              Confirm
            </button>
            <button type="button" className="pill__action-button">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  ),
};
