import * as React from "react";
import { motion } from "framer-motion";
import { UploadCloud, File, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "completed" | "error";
  error?: string;
}

interface UploadProps {
  files: UploadFile[];
  onUpload: (files: FileList) => void;
  onRemove: (id: string) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function Upload({
  files,
  onUpload,
  onRemove,
  accept,
  multiple = false,
  disabled = false,
  className,
}: UploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files.length) {
      onUpload(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      onUpload(e.target.files);
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed p-8 cursor-pointer transition-all duration-[var(--duration-base)]",
          isDragging
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-[var(--hairline-strong)] bg-[var(--surface-2)] hover:border-[var(--accent)]/50 hover:bg-[var(--surface-3)]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <UploadCloud
          size={32}
          className={cn(
            "transition-colors",
            isDragging ? "text-[var(--accent)]" : "text-[var(--fg-muted)]"
          )}
        />
        <div className="text-center">
          <p className="text-[13px] text-[var(--fg)] font-medium">
            Drop files here or click to upload
          </p>
          <p className="text-[12px] text-[var(--fg-dim)] mt-1">
            {multiple ? "You can upload multiple files" : "Single file upload"}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-[var(--radius-control)] bg-[var(--surface-3)] border border-[var(--hairline)] p-3 material"
            >
              <div className="shrink-0 w-8 h-8 rounded-[var(--radius-control)] bg-[var(--surface-2)] flex items-center justify-center">
                {file.status === "completed" ? (
                  <Check size={14} className="text-[var(--green)]" />
                ) : file.status === "error" ? (
                  <X size={14} className="text-[var(--red)]" />
                ) : (
                  <File size={14} className="text-[var(--fg-dim)]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[var(--fg)] truncate">
                  {file.name}
                </p>
                <p className="text-[11px] text-[var(--fg-muted)]">
                  {formatBytes(file.size)}
                  {file.status === "uploading" && (
                    <span className="ml-2">{file.progress}%</span>
                  )}
                  {file.error && (
                    <span className="ml-2 text-[var(--red)]">{file.error}</span>
                  )}
                </p>
                {file.status === "uploading" && (
                  <div className="mt-1.5 h-1 w-full rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: "var(--accent)",
                        boxShadow: "0 0 8px var(--accent-glow)",
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${file.progress}%` }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(file.id)}
                className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-control)] text-[var(--fg-muted)]/50 hover:text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
                aria-label={`Remove ${file.name}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
