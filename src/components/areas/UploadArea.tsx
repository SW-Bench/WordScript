import { useState } from "react";
import { Copy, RotateCcw, Trash2 } from "lucide-react";
import { FormCard, FormRow, StatTiles, StatusBadge } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Upload, type UploadFile } from "@/components/ui/upload";

interface QueueItem extends UploadFile {
  transcript?: string;
}

const SAMPLE_QUEUE: QueueItem[] = [
  {
    id: "demo-1",
    name: "standup-2026-06-21.wav",
    size: 4_200_000,
    progress: 100,
    status: "completed",
    transcript: "Okay let's ship the settings restructure today and review the overlay tab.",
  },
  {
    id: "demo-2",
    name: "interview-recording.mp3",
    size: 18_400_000,
    progress: 100,
    status: "error",
    error: "413 request_too_large — file exceeds the 100 MiB dev upload limit",
  },
];

export function UploadArea() {
  const [queue, setQueue] = useState<QueueItem[]>(SAMPLE_QUEUE);

  const handleUpload = (files: FileList) => {
    const next: QueueItem[] = Array.from(files).map((file) => ({
      id: `up-${Date.now()}-${file.name}`,
      name: file.name,
      size: file.size,
      progress: 0,
      status: "uploading",
    }));
    setQueue((prev) => [...prev, ...next]);
    // Placeholder progress; real transcription wiring is a V2 task.
    next.forEach((item) => {
      window.setTimeout(() => {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, progress: 100, status: "completed", transcript: "Transcript preview is not wired yet." }
              : q,
          ),
        );
      }, 1200);
    });
  };

  const handleRemove = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const completed = queue.filter((q) => q.status === "completed").length;
  const failed = queue.filter((q) => q.status === "error").length;
  const pending = queue.filter((q) => q.status === "uploading").length;

  return (
    <div className="flex flex-col gap-8">
      <StatTiles
        items={[
          { label: "Completed", value: String(completed), hint: "Ready to copy or insert" },
          { label: "Processing", value: String(pending), hint: "Uploading or transcribing" },
          { label: "Failed", value: String(failed), hint: "Check size and provider limits" },
        ]}
      />

      <FormCard
        title="Audio upload"
        description="Drop audio files here to transcribe them in batch. Results appear in the queue below with copy, insert and retry actions. Transcription is not wired to the runtime yet."
        action={
          <StatusBadge tone="warning" dot>
            Preview layout
          </StatusBadge>
        }
        bodyClassName="py-4"
      >
        <Upload
          files={queue}
          onUpload={handleUpload}
          onRemove={handleRemove}
          accept="audio/*,video/*"
          multiple
        />
      </FormCard>

      {queue.length > 0 && (
        <FormCard
          title={`Queue (${queue.length})`}
          description="Files are processed in upload order. Completed transcripts can be copied or inserted at the cursor."
        >
          <ul className="flex flex-col">
            {queue.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 border-b border-border py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <StatusBadge
                      tone={
                        item.status === "completed" ? "success" : item.status === "error" ? "error" : "warning"
                      }
                      dot
                    >
                      {item.status}
                    </StatusBadge>
                    <span className="truncate text-[13px] font-medium text-foreground">{item.name}</span>
                  </div>
                  {item.transcript && (
                    <p className="text-[12px] leading-snug text-fg-dim">{item.transcript}</p>
                  )}
                  {item.error && (
                    <p className="text-[12px] leading-snug text-[var(--red)]">{item.error}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {item.status === "completed" && (
                    <Button size="icon-xs" variant="ghost" aria-label="Copy transcript">
                      <Copy className="size-3.5" />
                    </Button>
                  )}
                  {item.status === "error" && (
                    <Button size="icon-xs" variant="ghost" aria-label="Retry">
                      <RotateCcw className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => handleRemove(item.id)}
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </FormCard>
      )}

      <FormRow
        label="Upload limits"
        hint="Cloud uploads are bounded by provider request size (Free ~25 MiB, Dev ~100 MiB). Local lane has no hard limit but is constrained by available memory and model context."
        divider={false}
        align="start"
        control={<StatusBadge tone="neutral">Provider-bounded</StatusBadge>}
      />
    </div>
  );
}