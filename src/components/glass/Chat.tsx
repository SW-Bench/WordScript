import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, Copy, Check, Sparkles } from "lucide-react";
import { cn } from "./ui/lib/utils";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Avatar } from "./ui/Avatar";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  status?: "sending" | "sent" | "error";
}

interface ChatProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex gap-2.5 items-end", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <Avatar
        fallback={isUser ? "You" : "AI"}
        size="sm"
        className="shrink-0"
      />
      <div
        className={cn(
          "relative group max-w-[80%] rounded-[var(--radius-card)] px-3.5 py-2.5",
          isUser
            ? "bg-[var(--accent-soft)]/40 border border-[var(--accent)]/20"
            : "bg-[var(--surface-2)] border border-[var(--hairline)] material"
        )}
      >
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="text-[10px] font-semibold text-[var(--fg-muted)] uppercase tracking-wider flex items-center gap-1">
            {!isUser && <Sparkles size={9} className="text-[var(--accent)]" />}
            {isUser ? "You" : "Assistant"}
          </span>
          <span className="text-[10px] text-[var(--fg-muted)] tabular-nums">
            {message.timestamp}
          </span>
        </div>
        <p className="text-[13px] whitespace-pre-wrap text-[var(--fg)] leading-relaxed">
          {message.content}
        </p>
        {message.status === "error" && (
          <p className="mt-1 text-[11px] text-[var(--red)]">Failed to send</p>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-1.5 right-1.5 inline-flex h-5 w-5 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-[4px] text-[var(--fg-muted)]/50 hover:text-[var(--fg)] hover:bg-[var(--surface-3)]"
          aria-label="Copy message"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
      </div>
    </motion.div>
  );
}

export function Chat({
  messages,
  onSend,
  isLoading = false,
  placeholder = "Type a message...",
  className,
}: ChatProps) {
  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full rounded-[var(--radius-lg)] overflow-hidden",
        "bg-[var(--surface-1)] border border-[var(--hairline)] material",
        className
      )}
    >
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--hairline)]">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-[8px] material"
          style={{
            background: "var(--surface-3)",
            border: "1px solid var(--hairline)",
            color: "var(--accent)",
          }}
        >
          <Bot size={14} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold text-[var(--fg)]">Chat</span>
          <span className="text-[10px] font-medium text-[var(--fg-muted)] uppercase tracking-wider">
            Local mode
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-end gap-2.5"
          >
            <Avatar fallback="AI" size="sm" className="shrink-0" />
            <div className="rounded-[var(--radius-card)] px-3.5 py-3 bg-[var(--surface-2)] border border-[var(--hairline)] material">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--fg-muted)] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--fg-muted)] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--fg-muted)] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </motion.div>
        )}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles size={28} className="text-[var(--accent)] opacity-50 mb-2" />
            <p className="text-[13px] text-[var(--fg-dim)]">Ask anything.</p>
            <p className="text-[11px] text-[var(--fg-muted)] mt-1 max-w-[40ch]">
              Try a quick question about your transcription context, dictionary,
              or any of your text profiles.
            </p>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-3 border-t border-[var(--hairline)]"
      >
        <Input
          className="flex-1"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        />
        <Button
          type="submit"
          variant="primary"
          size="icon"
          loading={isLoading}
          disabled={!input.trim() || isLoading}
        >
          <Send size={16} />
        </Button>
      </form>
    </div>
  );
}
