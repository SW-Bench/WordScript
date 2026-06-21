import { useRef, useState, useEffect, type FormEvent } from "react";
import { Bot, Copy, Check, Send, Sparkles } from "lucide-react";
import { FormCard, StatusBadge } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  status?: "sending" | "sent" | "error";
}

const SAMPLE_MESSAGES: ChatMessage[] = [
  {
    id: "demo-1",
    role: "user",
    content: "What does my Support profile dictionary contain?",
    timestamp: "09:41",
  },
  {
    id: "demo-2",
    role: "assistant",
    content:
      "Your active Support profile has 3 dictionary terms: SEV-1 -> Severity 1, ETA -> estimated time of arrival, and WordScript -> WordScript. There are also 2 snippets for follow-up notes and status updates.",
    timestamp: "09:41",
    status: "sent",
  },
];

export function ChatArea() {
  const [messages, setMessages] = useState<ChatMessage[]>(SAMPLE_MESSAGES);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sending",
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    // Placeholder: real AI reply wiring is a V2 task.
    window.setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === userMsg.id ? { ...m, status: "sent" } : m)),
      );
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content:
            "Chat replies are not connected to the runtime yet. This screen previews the layout for the upcoming AI-chat-on-transcription feature.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "sent",
        },
      ]);
      setIsLoading(false);
    }, 700);
  };

  return (
    <div className="flex flex-col gap-8">
      <FormCard
        title="AI chat on transcription"
        description="Ask questions about your transcripts, dictionary, snippets and profiles. Voice input will reuse the same hotkey logic as dictation. Replies are not wired to the runtime yet."
        action={
          <StatusBadge tone="warning" dot>
            Preview layout
          </StatusBadge>
        }
        bodyClassName="py-0"
      >
        <div className="flex h-[520px] flex-col overflow-hidden rounded-md border border-border bg-surface">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <div className="flex size-7 items-center justify-center rounded-md bg-surface-strong text-fg-dim">
              <Bot className="size-3.5" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-foreground">Chat</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-fg-muted">
                Local context
              </span>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && !isLoading && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Sparkles className="mb-2 size-7 text-[var(--accent)] opacity-50" />
                <p className="text-[13px] text-fg-dim">Ask anything.</p>
                <p className="mt-1 max-w-[40ch] text-[11px] text-fg-muted">
                  Try a quick question about your transcription context, dictionary, or any of your
                  text profiles.
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && (
              <div className="flex items-end gap-2.5">
                <div className="rounded-md border border-border bg-surface-strong px-3.5 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 animate-bounce rounded-full bg-fg-muted" style={{ animationDelay: "0ms" }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-fg-muted" style={{ animationDelay: "150ms" }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-fg-muted" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border p-3">
            <Input
              className="flex-1"
              placeholder="Type a message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </FormCard>

      <p className="px-1 text-[12px] leading-snug text-fg-muted">
        This is a layout preview. Chat history, voice-input wiring and runtime-backed replies ship in
        a future version. Your messages here are local and not persisted.
      </p>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn("flex items-end gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "group relative max-w-[80%] rounded-md px-3.5 py-2.5",
          isUser
            ? "border border-[var(--accent)]/20 bg-[var(--accent-soft)]"
            : "border border-border bg-surface-strong",
        )}
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
            {!isUser && <Sparkles className="size-2.5 text-[var(--accent)]" />}
            {isUser ? "You" : "Assistant"}
          </span>
          <span className="text-[10px] tabular-nums text-fg-muted">{message.timestamp}</span>
        </div>
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
          {message.content}
        </p>
        {message.status === "error" && (
          <p className="mt-1 text-[11px] text-[var(--red)]">Failed to send</p>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="absolute right-1.5 top-1.5 inline-flex size-5 items-center justify-center rounded text-fg-muted opacity-0 transition-opacity hover:bg-surface hover:text-foreground group-hover:opacity-100"
          aria-label="Copy message"
        >
          {copied ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
        </button>
      </div>
    </div>
  );
}