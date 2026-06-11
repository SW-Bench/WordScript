import * as React from "react";
import { cn } from "./lib/utils";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: "sm" | "md" | "lg";
  error?: boolean;
  success?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  wrapperClassName?: string;
}

export interface TextAreaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  size?: "sm" | "md" | "lg";
  error?: boolean;
  success?: boolean;
  autoResize?: boolean;
  wrapperClassName?: string;
}

const sizeClasses = {
  sm: "h-8 text-[12px] px-2.5",
  md: "h-9 text-[13px] px-3",
  lg: "h-10 text-[14px] px-4",
};

const baseClasses =
  "flex w-full rounded-[var(--radius-control)] bg-[var(--surface-3)] text-[var(--fg)] transition-all duration-[var(--duration-fast)] placeholder:text-[var(--fg-muted)] outline-none disabled:cursor-not-allowed disabled:opacity-50 border border-[var(--hairline)] hover:border-[var(--hairline-strong)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/40";

function stateClasses(error?: boolean, success?: boolean) {
  if (error) return "border-[var(--red)] ring-2 ring-[var(--red)]/40 focus:ring-[var(--red)] focus:border-[var(--red)]";
  if (success) return "border-[var(--green)] ring-2 ring-[var(--green)]/40 focus:ring-[var(--green)] focus:border-[var(--green)]";
  return "";
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      size = "md",
      error,
      success,
      leftIcon,
      rightIcon,
      wrapperClassName,
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn("relative flex items-center", wrapperClassName, className)}>
        {leftIcon && (
          <span className="absolute left-3 text-[var(--fg-muted)] pointer-events-none opacity-60">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            baseClasses,
            sizeClasses[size],
            stateClasses(error, success),
            leftIcon && "pl-9",
            rightIcon && "pr-9",
            className
          )}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3 text-[var(--fg-muted)] pointer-events-none opacity-60">
            {rightIcon}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      className,
      size = "md",
      error,
      success,
      autoResize = false,
      wrapperClassName,
      onChange,
      ...props
    },
    ref
  ) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    React.useImperativeHandle(ref, () => innerRef.current!);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoResize && innerRef.current) {
        innerRef.current.style.height = "auto";
        innerRef.current.style.height = `${innerRef.current.scrollHeight}px`;
      }
      onChange?.(e);
    };

    const paddingClasses = {
      sm: "text-[12px] px-2.5 py-1.5 min-h-[60px]",
      md: "text-[13px] px-3 py-2 min-h-[80px]",
      lg: "text-[14px] px-4 py-2.5 min-h-[100px]",
    };

    return (
      <div className={cn("relative", wrapperClassName)}>
        <textarea
          ref={innerRef}
          className={cn(
            baseClasses,
            paddingClasses[size],
            stateClasses(error, success),
            "resize-y",
            className
          )}
          onChange={handleChange}
          {...props}
        />
      </div>
    );
  }
);
TextArea.displayName = "TextArea";
