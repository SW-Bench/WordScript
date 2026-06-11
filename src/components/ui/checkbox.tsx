import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, indeterminate = false, ...props }, ref) => {
    const id = React.useId();
    const isControlled = props.checked !== undefined;
    const [uncontrolledChecked, setUncontrolledChecked] = React.useState(Boolean(props.defaultChecked));
    const isActive = (isControlled ? Boolean(props.checked) : uncontrolledChecked) || indeterminate;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) setUncontrolledChecked(e.target.checked);
      props.onChange?.(e);
    };

    return (
      <label
        className={cn(
          "inline-flex items-start gap-3",
          props.disabled ? "opacity-50 cursor-default" : "cursor-pointer",
          className
        )}
        htmlFor={id}
      >
        <span className="relative flex h-[18px] w-[18px] items-center justify-center mt-0.5">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={handleChange}
            {...props}
          />
          <span
            className={cn(
              "flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-colors duration-[var(--duration-fast)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)]/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--surface-1)]",
              isActive
                ? "bg-[var(--accent)] border-[var(--accent)]"
                : "bg-[var(--surface-3)] border-[var(--hairline-strong)] hover:border-[rgba(255,255,255,0.18)]"
            )}
          >
            {indeterminate ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="w-2 h-0.5 bg-[var(--btn-primary-fg)] rounded"
              />
            ) : (
              <motion.svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                className="h-[11px] w-[11px] text-[var(--btn-primary-fg)]"
                initial={false}
                animate={{
                  opacity: isActive ? 1 : 0,
                  scale: isActive ? 1 : 0.5,
                }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
              >
                <motion.polyline
                  points="3.5 8.5 6.5 11.5 12.5 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: isActive ? 1 : 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                />
              </motion.svg>
            )}
          </span>
        </span>
        {(label || description) && (
          <div className="flex flex-col gap-0.5">
            {label && (
              <span className="text-[13px] text-[var(--fg)] leading-tight">{label}</span>
            )}
            {description && (
              <span className="text-[12px] text-[var(--fg-dim)] leading-relaxed">
                {description}
              </span>
            )}
          </div>
        )}
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";
