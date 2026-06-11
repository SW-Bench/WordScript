import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  FormCard,
  FormRow,
  SegmentControl,
  Select,
  StatTiles,
  StatusBadge,
  Stepper,
  Toggle,
} from "../components/shell";
import { Button } from "../components/ui/button";
import "../styles/globals.css";

/**
 * These stories render the REAL production shell components so Storybook stays
 * an honest mirror of the app. No bespoke markup or invented classes — if it
 * looks a certain way here, it looks that way in WordScript.
 */
const meta: Meta = {
  title: "Design System/Form Kit",
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-background p-8 text-foreground">
        <div className="mx-auto max-w-[560px]">
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj;

export const StatTilesRow: Story = {
  name: "StatTiles",
  render: () => (
    <StatTiles
      items={[
        { label: "Lane", value: "Groq cloud", hint: "Cloud transcription with local BYOK." },
        { label: "Active model", value: "whisper-large-v3", hint: "quality transcription mode" },
        { label: "Status", value: "Stored key available", hint: "Not checked in this session", accent: true },
      ]}
    />
  ),
};

export const ProviderCard: Story = {
  render: () => {
    const [lane, setLane] = useState("cloud");
    const [language, setLanguage] = useState("auto");
    const [cleanup, setCleanup] = useState(true);
    return (
      <FormCard
        title="Speech & AI"
        description="Cloud BYOK or local lane, language, models and cleanup."
        action={
          <StatusBadge tone="success" dot>
            Ready
          </StatusBadge>
        }
      >
        <FormRow
          label="Transcription lane"
          hint="Cloud uses your stored Groq key. Local runs fully offline."
          control={
            <SegmentControl
              aria-label="Transcription lane"
              value={lane}
              onChange={setLane}
              options={[
                { value: "cloud", label: "Cloud" },
                { value: "local", label: "Local" },
              ]}
            />
          }
        />
        <FormRow
          label="Language"
          htmlFor="lang"
          control={
            <Select id="lang" className="w-[180px]" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="auto">Auto-detect</option>
              <option value="en">English</option>
              <option value="de">German</option>
            </Select>
          }
        />
        <FormRow
          label="Cleanup pass"
          hint="Removes filler words and fixes punctuation after transcription."
          divider={false}
          control={<Toggle aria-label="Cleanup pass" checked={cleanup} onCheckedChange={setCleanup} />}
        />
      </FormCard>
    );
  },
};

export const Controls: Story = {
  render: () => {
    const [mode, setMode] = useState("cleanup");
    const [beam, setBeam] = useState(5);
    const [sound, setSound] = useState(false);
    return (
      <FormCard title="Modes & controls" bodyClassName="py-1">
        <FormRow
          label="Processing mode"
          control={
            <SegmentControl
              aria-label="Processing mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: "verbatim", label: "Verbatim" },
                { value: "cleanup", label: "Cleanup" },
                { value: "rewrite", label: "Rewrite" },
                { value: "agent", label: "Agent" },
              ]}
            />
          }
        />
        <FormRow
          label="Beam size"
          hint="Higher is more accurate but slower."
          control={<Stepper aria-label="Beam size" value={beam} onChange={setBeam} min={1} max={10} />}
        />
        <FormRow
          label="Play sound feedback"
          divider={false}
          control={<Toggle aria-label="Play sound feedback" checked={sound} onCheckedChange={setSound} />}
        />
      </FormCard>
    );
  },
};

export const Badges: Story = {
  render: () => (
    <FormCard title="Status badges">
      <div className="flex flex-wrap gap-2 py-3">
        <StatusBadge tone="success" dot>
          Ready
        </StatusBadge>
        <StatusBadge tone="accent" dot>
          Recording
        </StatusBadge>
        <StatusBadge tone="warning" dot>
          Paused
        </StatusBadge>
        <StatusBadge tone="error" dot>
          Error
        </StatusBadge>
        <StatusBadge tone="info" dot>
          Processing
        </StatusBadge>
        <StatusBadge tone="neutral">Idle</StatusBadge>
      </div>
    </FormCard>
  ),
};

export const Buttons: Story = {
  render: () => (
    <FormCard title="Buttons">
      <div className="flex flex-wrap gap-2 py-3">
        <Button size="sm">Primary</Button>
        <Button size="sm" variant="outline">
          Outline
        </Button>
        <Button size="sm" variant="ghost">
          Ghost
        </Button>
        <Button size="sm" variant="destructive">
          Destructive
        </Button>
      </div>
    </FormCard>
  ),
};
