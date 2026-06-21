import { useMemo, useState } from "react";
import { Check, Copy, Pin, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { FormCard, FormRow, SegmentControl, StatTiles, StatusBadge, Toggle } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface MeetingNote {
  id: string;
  title: string;
  transcript: string;
  rawNotes: string;
  enhanced: string;
  speakers: Array<{ id: string; label: string; tone: "accent" | "green" | "orange" }>;
  pinned: boolean;
  updatedAt: string;
}

const SAMPLE_NOTES: MeetingNote[] = [
  {
    id: "demo-1",
    title: "Standup 2026-06-21",
    transcript:
      "Speaker 1: Let's ship the settings restructure today. Speaker 2: Agreed, then review the overlay tab. Speaker 1: I'll handle the Diagnostics sub-tabs.",
    rawNotes:
      "Ship settings restructure\nReview overlay tab\nHandle Diagnostics sub-tabs",
    enhanced:
      "Decisions:\n- Ship settings restructure today\n- Review overlay tab next\n\nAction items:\n- Speaker 1: Diagnostics sub-tabs",
    speakers: [
      { id: "s1", label: "Speaker 1", tone: "accent" },
      { id: "s2", label: "Speaker 2", tone: "orange" },
    ],
    pinned: true,
    updatedAt: "09:41",
  },
  {
    id: "demo-2",
    title: "Customer call — Acme",
    transcript:
      "Speaker 1: The insert recovery flow needs a single home. Speaker 2: Yes, consolidate it out of Input and Permissions.",
    rawNotes: "Consolidate insert recovery\nSingle home for recovery",
    enhanced:
      "Decisions:\n- Consolidate insert & recovery into one area\n\nAction items:\n- Move recovery out of Input and Permissions",
    speakers: [
      { id: "s1", label: "Speaker 1", tone: "accent" },
      { id: "s2", label: "Speaker 2", tone: "green" },
    ],
    pinned: false,
    updatedAt: "11:02",
  },
];

const toneClass: Record<MeetingNote["speakers"][number]["tone"], string> = {
  accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
  green: "bg-[var(--green)]/15 text-[var(--green)]",
  orange: "bg-[var(--orange)]/15 text-[var(--orange)]",
};

export function NotesArea() {
  const [notes, setNotes] = useState<MeetingNote[]>(SAMPLE_NOTES);
  const [activeId, setActiveId] = useState<string>(SAMPLE_NOTES[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState<"transcript" | "raw" | "enhanced">("transcript");
  const [diarization, setDiarization] = useState(true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.transcript.toLowerCase().includes(q) ||
        n.rawNotes.toLowerCase().includes(q),
    );
  }, [notes, search]);

  const pinned = filtered.filter((n) => n.pinned);
  const unpinned = filtered.filter((n) => !n.pinned);
  const active = notes.find((n) => n.id === activeId) ?? filtered[0] ?? null;

  const togglePin = (id: string) =>
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));

  const createNote = () => {
    const id = `note-${Date.now()}`;
    const note: MeetingNote = {
      id,
      title: "Untitled note",
      transcript: "",
      rawNotes: "",
      enhanced: "",
      speakers: [],
      pinned: false,
      updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setNotes((prev) => [note, ...prev]);
    setActiveId(id);
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeId === id) {
      setActiveId(notes.find((n) => n.id !== id)?.id ?? "");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <StatTiles
        items={[
          { label: "Notes", value: String(notes.length), hint: `${pinned.length} pinned` },
          { label: "Speakers", value: diarization ? "On" : "Off", hint: diarization ? "Color-coded labels" : "Single speaker" },
          { label: "Enhancement", value: "AI", hint: "Decisions + action items" },
        ]}
      />

      <FormCard
        title="Meeting notes"
        description="Three-pane view: transcript with speaker diarization, raw notes, and AI-enhanced summary with decisions and action items. Diarization and enhancement are not wired to the runtime yet."
        action={
          <StatusBadge tone="warning" dot>
            Preview layout
          </StatusBadge>
        }
        bodyClassName="py-4"
      >
        <FormRow
          label="Speaker diarization"
          hint="Color-codes each speaker in the transcript pane."
          divider={false}
          control={<Toggle checked={diarization} onCheckedChange={setDiarization} />}
        />
      </FormCard>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Note list */}
        <div className="flex w-full shrink-0 flex-col gap-2 lg:w-64">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes…"
                className="pl-8"
              />
            </div>
            <Button size="icon-sm" variant="outline" onClick={createNote} aria-label="New note">
              <Plus className="size-3.5" />
            </Button>
          </div>

          {pinned.length > 0 && (
            <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Pinned</span>
          )}
          {pinned.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              active={note.id === active?.id}
              onSelect={() => setActiveId(note.id)}
              onPin={() => togglePin(note.id)}
              onDelete={() => deleteNote(note.id)}
            />
          ))}

          {unpinned.length > 0 && (
            <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">All notes</span>
          )}
          {unpinned.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              active={note.id === active?.id}
              onSelect={() => setActiveId(note.id)}
              onPin={() => togglePin(note.id)}
              onDelete={() => deleteNote(note.id)}
            />
          ))}

          {filtered.length === 0 && (
            <p className="px-1 py-4 text-[12px] text-fg-muted">No notes match this search.</p>
          )}
        </div>

        {/* Three-pane view */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {active ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Input
                  value={active.title}
                  onChange={(e) =>
                    setNotes((prev) =>
                      prev.map((n) => (n.id === active.id ? { ...n, title: e.target.value } : n)),
                    )
                  }
                  className="w-[260px]"
                  aria-label="Note title"
                />
                <span className="text-[11px] tabular-nums text-fg-muted">{active.updatedAt}</span>
              </div>

              {active.speakers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {active.speakers.map((s) => (
                    <span
                      key={s.id}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                        toneClass[s.tone],
                      )}
                    >
                      {s.label}
                    </span>
                  ))}
                </div>
              )}

              <SegmentControl
                aria-label="Notes panel"
                value={panel}
                onChange={(v) => setPanel(v as "transcript" | "raw" | "enhanced")}
                options={[
                  { value: "transcript", label: "Transcript" },
                  { value: "raw", label: "Raw notes" },
                  { value: "enhanced", label: "Enhanced" },
                ]}
              />

              <div className="rounded-md border border-border bg-surface p-4">
                {panel === "transcript" && (
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
                    {active.transcript || "No transcript yet. Upload an audio file or start a meeting capture."}
                  </p>
                )}
                {panel === "raw" && (
                  <textarea
                    className="min-h-[200px] w-full resize-y rounded-md border border-border bg-surface-strong px-3 py-2 text-[13px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                    value={active.rawNotes}
                    onChange={(e) =>
                      setNotes((prev) =>
                        prev.map((n) => (n.id === active.id ? { ...n, rawNotes: e.target.value } : n)),
                      )
                    }
                    placeholder="Type raw notes here…"
                  />
                )}
                {panel === "enhanced" && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-[var(--accent)]" />
                      <span className="text-[12px] font-medium text-fg-dim">AI-enhanced summary</span>
                    </div>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
                      {active.enhanced || "Enhancement is not wired yet. It will extract decisions and action items."}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(active.transcript)}>
                  <Copy className="size-3.5" /> Copy transcript
                </Button>
                <Button size="sm" variant="ghost" onClick={() => togglePin(active.id)}>
                  <Pin className="size-3.5" /> {active.pinned ? "Unpin" : "Pin"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteNote(active.id)}>
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-md border border-border bg-surface px-4 py-12 text-center">
              <Check className="mb-2 size-6 text-fg-muted" />
              <p className="text-[13px] text-fg-dim">No note selected.</p>
              <p className="mt-1 text-[11px] text-fg-muted">Create a new note to start.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NoteListItem({
  note,
  active,
  onSelect,
  onPin,
  onDelete,
}: {
  note: MeetingNote;
  active: boolean;
  onSelect: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2.5 transition-colors",
        active ? "border-brand bg-card" : "border-border bg-surface hover:border-border-strong",
      )}
      onClick={onSelect}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{note.title}</p>
        <p className="truncate text-[11px] text-fg-muted">{note.updatedAt} · {note.speakers.length} speakers</p>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onPin(); }}
        className={cn("shrink-0 text-fg-muted hover:text-foreground", note.pinned && "text-[var(--accent)]")}
        aria-label={note.pinned ? "Unpin note" : "Pin note"}
      >
        <Pin className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="shrink-0 text-fg-muted hover:text-[var(--red)]"
        aria-label="Delete note"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}