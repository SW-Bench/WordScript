import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface PreflightStep {
  id: string;
  label: string;
  ready: boolean;
  state: string;
  detail: string;
  action: string;
}

interface PreflightCardProps {
  steps: PreflightStep[];
  title?: string;
  description?: string;
  className?: string;
}

export function PreflightCard({
  steps,
  title = "Preflight checklist",
  description,
  className,
}: PreflightCardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5 backdrop-blur-sm",
        className
      )}
    >
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold text-[var(--fg)]">{title}</h3>
        {description && (
          <p className="text-[12px] text-[var(--fg-dim)] mt-1 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="flex flex-col gap-2.5">
        {steps.map((step, index) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.2 }}
            className={cn(
              "flex items-start gap-3 rounded-[var(--radius-button)] border p-3 transition-colors duration-150",
              step.ready
                ? "border-[var(--green)]/15 bg-[var(--green)]/5"
                : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]"
            )}
          >
            <span
              className={cn(
                "mt-1 w-2 h-2 rounded-full shrink-0",
                step.ready ? "bg-[var(--green)]" : "bg-[var(--orange)]"
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-medium text-[var(--fg)]">
                  {step.label}
                </span>
                <Badge variant={step.ready ? "success" : "warning"}>
                  {step.state}
                </Badge>
              </div>
              <p className="text-[12px] text-[var(--fg-dim)] mt-1 leading-relaxed">
                {step.detail}
              </p>
              <span className="inline-block mt-2 text-[11px] text-[var(--fg-muted)] bg-[rgba(255,255,255,0.05)] rounded-[var(--radius-badge)] px-2 py-0.5 font-mono">
                {step.action}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
