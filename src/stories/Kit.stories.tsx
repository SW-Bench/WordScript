import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Home,
  History,
  BookText,
  Cpu,
  SlidersHorizontal,
  Keyboard,
  ShieldCheck,
  ActivitySquare,
  Info,
  MessageSquare,
  Upload,
  NotebookPen,
} from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormCard,
  FormRow,
  DisclosureRow,
  Inspector,
  SegmentControl,
  StatusBadge,
  Stepper,
  Select,
  Toggle,
  Sidebar,
} from "@/components/shell";

const meta: Meta = {
  title: "Design System/Kit",
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <div style={{ width: 460 }}>
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj;

export const GroupedForm: Story = {
  render: () => {
    const [lane, setLane] = useState<"cloud" | "local">("cloud");
    const [cleanup, setCleanup] = useState(true);
    const [limit, setLimit] = useState(120);
    return (
      <FormCard
        title="Speech to text"
        description="Pick the transcription lane and how it is cleaned up."
      >
        <FormRow label="Lane" hint="Cloud BYOK or the bundled local runtime.">
          <SegmentControl
            value={lane}
            onChange={setLane}
            options={[
              { value: "cloud", label: "Cloud" },
              { value: "local", label: "Local" },
            ]}
          />
        </FormRow>
        <FormRow label="Language">
          <Select defaultValue="">
            <option value="">Auto detect</option>
            <option value="en">English</option>
            <option value="de">German</option>
          </Select>
        </FormRow>
        <FormRow label="AI cleanup" hint="Remove fillers and tidy phrasing.">
          <Toggle checked={cleanup} onCheckedChange={setCleanup} />
        </FormRow>
        <FormRow label="Max recording">
          <Stepper value={limit} onChange={setLimit} min={10} max={3600} step={10} suffix="s" />
        </FormRow>
        <DisclosureRow title="Advanced">
          <FormRow label="Beam size" divider={false}>
            <Stepper value={5} onChange={() => {}} min={1} max={10} />
          </FormRow>
        </DisclosureRow>
      </FormCard>
    );
  },
};

export const Badges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge tone="success" dot>Ready</StatusBadge>
      <StatusBadge tone="warning" dot>Needs key</StatusBadge>
      <StatusBadge tone="error" dot>Error</StatusBadge>
      <StatusBadge tone="info" dot>Recording</StatusBadge>
      <StatusBadge tone="accent">Local</StatusBadge>
      <StatusBadge tone="neutral">Synced</StatusBadge>
    </div>
  ),
};

export const Controls: Story = {
  render: () => {
    const [mode, setMode] = useState<"tap" | "hold">("hold");
    const [on, setOn] = useState(false);
    return (
      <div className="flex flex-col gap-4">
        <SegmentControl
          value={mode}
          onChange={setMode}
          options={[
            { value: "tap", label: "Tap to toggle" },
            { value: "hold", label: "Hold to talk" },
          ]}
        />
        <div className="flex items-center gap-3">
          <Toggle checked={on} onCheckedChange={setOn} />
          <Stepper value={30} onChange={() => {}} min={0} max={300} suffix="s" />
        </div>
      </div>
    );
  },
};

export const InspectorPanel: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div className="relative h-[360px] w-full overflow-hidden rounded-xl border border-border bg-card">
        <div className="p-4">
          <Button onClick={() => setOpen(true)}>Edit entry</Button>
        </div>
        <Inspector
          open={open}
          onClose={() => setOpen(false)}
          title="Dictionary entry"
          description="Heard as -> replace with"
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => setOpen(false)}>
                Save
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Input placeholder="Heard as" defaultValue="cursor" />
            <Input placeholder="Replace with" defaultValue="Cursor" />
          </div>
        </Inspector>
      </div>
    );
  },
};

export const ShellSidebar: Story = {
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <div style={{ height: 560 }}>
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
  render: () => {
    const [active, setActive] = useState("home");
    return (
      <Sidebar
        activeId={active}
        onSelect={setActive}
        header={
          <div className="px-4 py-3">
            <div className="text-[13px] font-semibold text-foreground">WordScript</div>
            <div className="text-[11px] text-fg-muted">0.2.2-alpha</div>
          </div>
        }
        footer={
          <div className="px-3 py-2 text-[12px] text-fg-dim">Profile: Developer</div>
        }
        groups={[
          {
            label: "Workspace",
            items: [
              { id: "home", label: "Home", icon: Home },
              { id: "history", label: "History", icon: History },
              { id: "profiles", label: "Profiles", icon: BookText },
            ],
          },
          {
            label: "Engine",
            items: [
              { id: "speech", label: "Speech & AI", icon: Cpu },
              { id: "modes", label: "Modes", icon: SlidersHorizontal },
              { id: "capture", label: "Capture", icon: Keyboard },
            ],
          },
          {
            label: "System",
            items: [
              { id: "permissions", label: "Permissions", icon: ShieldCheck },
              { id: "diagnostics", label: "Diagnostics", icon: ActivitySquare },
              { id: "about", label: "About", icon: Info },
            ],
          },
          {
            label: "Preview",
            items: [
              { id: "chat", label: "Chat", icon: MessageSquare, preview: true },
              { id: "upload", label: "Upload", icon: Upload, preview: true },
              { id: "notes", label: "Notes", icon: NotebookPen, preview: true },
            ],
          },
        ]}
      />
    );
  },
};
