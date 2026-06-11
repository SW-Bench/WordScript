import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  X,
  UploadCloud,
  Check,
  AlertCircle,
} from "lucide-react";
import { cn } from "./ui/lib/utils";
import { Button } from "./ui/Button";
import { Progress } from "./ui/Progress";

export interface FileUploadItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

interface FileUploadProps {
  files: FileUploadItem[];
  onUpload: (files: FileList) => void;
  onRemove: (id: string) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  maxSize?: number;
  className?: string;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext ?? ""))
    return <ImageIcon size={16} className="text-[var(--accent)]" />;
  if (["mp3", "wav", "ogg", "m4a"].includes(ext ?? ""))
    return <Music size={16} className="text-[var(--voice)]" />;
  if (["mp4", "mov", "avi", "mkv"].includes(ext ?? ""))
    return <Video size={16} className="text-[var(--red)]" />;
  return <FileText size={16} className="text-[var(--fg-dim)]" />;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function FileUpload({
  files,
  onUpload,
  onRemove,
  accept,
  multiple = false,
  disabled = false,
  maxSize,
  className,
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragError, setDragError] = React.useState<string | null>(null);

  const validateFiles = (fileList: FileList) => {
    if (maxSize) {
      for (const file of Array.from(fileList)) {
        if (file.size > maxSize) {
          setDragError(`File too large: ${file.name}`);
          return false;
        }
      }
    }
    setDragError(null);
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files.length && validateFiles(e.dataTransfer.files)) {
      onUpload(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length && validateFiles(e.target.files)) {
      onUpload(e.target.files);
    }
  };

  return (
    <div className={cn("w-full flex flex-col gap-4", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => {
          setIsDragging(false);
          setDragError(null);
        }}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed p-8 cursor-pointer transition-all duration-200",
          dragError
            ? "border-[var(--red)]/40 bg-[var(--red)]/4"
            : isDragging
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.14)] hover:bg-[rgba(255,255,255,0.03)]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <UploadCloud
          size={32}
          className={cn(
            "transition-colors",
            dragError
              ? "text-[var(--red)]"
              : isDragging
              ? "text-[var(--accent)]"
              : "text-[var(--fg-muted)]"
          )}
        />
        <div className="text-center">
          <p className="text-[13px] text-[var(--fg)] font-medium">
            Drop files here or click to upload
          </p>
          <p className="text-[12px] text-[var(--fg-dim)] mt-1">
            {multiple ? "Multiple files supported" : "Single file only"}
            {maxSize && ` · Max ${formatBytes(maxSize)}`}
          </p>
        </div>
        {dragError && (
          <p className="text-[12px] text-[var(--red)] mt-1">
            {dragError}
          </p>
        )}
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

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-2"
          >
            {files.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius-button)] border p-3 backdrop-blur-sm transition-colors",
                  item.status === "error"
                    ? "border-[var(--red)]/15 bg-[var(--red)]/4"
                    : item.status === "completed"
                    ? "border-[var(--green)]/15 bg-[var(--green)]/4"
                    : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]"
                )}
              >
                <div className="shrink-0 w-8 h-8 rounded-[var(--radius-button)] bg-[rgba(255,255,255,0.05)] flex items-center justify-center">
                  {item.status === "completed" ? (
                    <Check size={14} className="text-[var(--green)]" />
                  ) : item.status === "error" ? (
                    <AlertCircle size={14} className="text-[var(--red)]" />
                  ) : (
                    getFileIcon(item.file.name)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[var(--fg)] truncate">
                    {item.file.name}
                  </p>
                  <p className="text-[11px] text-[var(--fg-muted)]">
                    {formatBytes(item.file.size)}
                  </p>
                  {item.status === "uploading" && (
                    <Progress
                      value={item.progress}
                      size="sm"
                      className="mt-1.5"
                    />
                  )}
                  {item.error && (
                    <p className="text-[11px] text-[var(--red)] mt-1">
                      {item.error}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-[var(--fg-muted)] hover:text-[var(--red)] hover:bg-[var(--red)]/10"
                  onClick={() => onRemove(item.id)}
                >
                  <X size={14} />
                </Button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
