import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Pin,
  Search,
  Clock,
  FileText,
  Bold,
  Italic,
  List,
  ListOrdered,
  Type,
  Check,
} from "lucide-react";
import { cn } from "./ui/lib/utils";
import { Button } from "./ui/Button";
import { Input, TextArea } from "./ui/Input";
import { Badge } from "./ui/Badge";

export interface Note {
  id: string;
  title: string;
  content: string;
  pinned?: boolean;
  color?: "default" | "accent" | "green" | "orange";
  updatedAt: string;
  tags?: string[];
}

interface NotesProps {
  notes: Note[];
  activeNoteId?: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  className?: string;
}

const colorBorders: Record<string, string> = {
  default: "border-[var(--hairline)]",
  accent: "border-[var(--accent)]/30",
  green: "border-[var(--green)]/30",
  orange: "border-[var(--orange)]/30",
};

const colorBgs: Record<string, string> = {
  default: "bg-[var(--surface-2)]",
  accent: "bg-[var(--accent-soft)]/30",
  green: "bg-[var(--green)]/10",
  orange: "bg-[var(--orange)]/10",
};

function useDebouncedAutosave(value: string, onSave: (v: string) => void) {
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [dirty, setDirty] = React.useState(false);
  React.useEffect(() => {
    setDirty(true);
    const t = setTimeout(() => {
      onSave(value);
      setSavedAt(new Date());
      setDirty(false);
    }, 600);
    return () => clearTimeout(t);
  }, [value, onSave]);
  return { savedAt, dirty };
}

export function Notes({
  notes,
  activeNoteId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onPin,
  className,
}: NotesProps) {
  const [search, setSearch] = React.useState("");
  const activeNote = notes.find((n) => n.id === activeNoteId);

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase()) ||
      n.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const pinned = filtered.filter((n) => n.pinned);
  const unpinned = filtered.filter((n) => !n.pinned);

  return (
    <div
      className={cn(
        "flex h-full rounded-[var(--radius-lg)] overflow-hidden",
        "bg-[var(--surface-1)] border border-[var(--hairline)] material",
        className
      )}
    >
      {/* Sidebar */}
      <div className="w-64 min-w-0 flex flex-col border-r border-[var(--hairline)]">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-[10px] font-semibold text-[var(--fg-muted)] uppercase tracking-wider">
            Notes
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCreate}>
            <Plus size={14} />
          </Button>
        </div>

        <div className="px-3 pb-2">
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-[var(--fg-muted)]/60 pointer-events-none">
              <Search size={12} />
            </span>
            <Input
              size="sm"
              className="pl-7"
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {pinned.length > 0 && (
            <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--fg-muted)] px-2.5 py-1.5 flex items-center gap-1.5">
              <Pin size={9} /> Pinned
            </div>
          )}
          {pinned.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              active={activeNoteId === note.id}
              onClick={() => onSelect(note.id)}
            />
          ))}
          {unpinned.length > 0 && pinned.length > 0 && (
            <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--fg-muted)] px-2.5 py-1.5 mt-1.5">
              All notes
            </div>
          )}
          {unpinned.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              active={activeNoteId === note.id}
              onClick={() => onSelect(note.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="px-2.5 py-6 text-center text-[12px] text-[var(--fg-muted)]">
              No notes match.
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeNote ? (
          <NoteEditor
            note={activeNote}
            onUpdate={(updates) => onUpdate(activeNote.id, updates)}
            onPin={() => onPin(activeNote.id)}
            onDelete={() => onDelete(activeNote.id)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--fg-muted)]">
            <div className="text-center">
              <FileText size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-[13px] text-[var(--fg-dim)]">Select or create a note</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NoteRow({
  note,
  active,
  onClick,
}: {
  note: Note;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      key={note.id}
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left bg-transparent rounded-[var(--radius-control)] px-2.5 py-2 transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40",
        active
          ? "bg-[var(--surface-2)] border border-[var(--hairline-strong)] material"
          : "border border-transparent hover:bg-[var(--surface-2)]"
      )}
    >
      <div className="flex items-center gap-1.5">
        {note.pinned && <Pin size={9} className="text-[var(--accent)] shrink-0" />}
        <span className="text-[12px] text-[var(--fg)] font-medium truncate">
          {note.title || "Untitled"}
        </span>
      </div>
      <p className="text-[11px] text-[var(--fg-dim)] mt-0.5 line-clamp-2 leading-snug">
        {note.content}
      </p>
      {note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {note.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[9px] py-0">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 mt-1 text-[var(--fg-muted)]">
        <Clock size={9} />
        <span className="text-[10px]">{note.updatedAt}</span>
      </div>
    </button>
  );
}

function NoteEditor({
  note,
  onUpdate,
  onPin,
  onDelete,
}: {
  note: Note;
  onUpdate: (updates: Partial<Note>) => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = React.useState(note.title);
  const [content, setContent] = React.useState(note.content);
  const { savedAt, dirty } = useDebouncedAutosave(content, (v) =>
    onUpdate({ content: v })
  );

  React.useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
  }, [note.id]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Title + actions */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--hairline)]">
        <Input
          className="flex-1 bg-transparent border-0 text-[16px] font-semibold focus:ring-0 text-[var(--fg)] placeholder:text-[var(--fg-muted)]"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            onUpdate({ title: e.target.value });
          }}
          placeholder="Note title..."
        />
        <div className="flex items-center gap-1">
          <span
            className="text-[10px] font-medium uppercase tracking-wider"
            style={{ color: dirty ? "var(--accent)" : "var(--green)" }}
          >
            {dirty ? "Saving..." : "Saved"}
          </span>
          {savedAt && !dirty && <Check size={11} className="text-[var(--green)]" />}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8",
            note.pinned && "text-[var(--accent)]"
          )}
          onClick={onPin}
        >
          <Pin size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[var(--red)] hover:text-[var(--red)] hover:bg-[var(--red)]/10"
          onClick={onDelete}
        >
          <Trash2 size={14} />
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-5 py-1.5 border-b border-[var(--hairline)] bg-[var(--surface-2)]">
        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Heading">
          <Type size={12} />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Bold">
          <Bold size={12} />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Italic">
          <Italic size={12} />
        </Button>
        <span className="mx-1 h-4 w-px bg-[var(--hairline)]" />
        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Bullet list">
          <List size={12} />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Numbered list">
          <ListOrdered size={12} />
        </Button>
        <div className="flex-1" />
        <AnimatePresence mode="wait">
          <motion.span
            key={`${wordCount}-${charCount}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[10px] font-medium text-[var(--fg-muted)] tabular-nums"
          >
            {wordCount} words · {charCount} chars
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="flex-1 p-5">
        <TextArea
          className="h-full bg-transparent border-0 text-[14px] leading-relaxed focus:ring-0 text-[var(--fg)] placeholder:text-[var(--fg-muted)] resize-none px-0 py-0 min-h-0"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start typing..."
        />
      </div>
    </div>
  );
}
