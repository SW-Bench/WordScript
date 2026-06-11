import * as React from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "./lib/utils";

export type ButtonVariant =
  | "default"
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "outline"
  | "accent"
  | "glass";

export type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  iconOnly?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-[var(--surface-3)] text-[var(--fg)] hover:bg-[var(--surface-2)] border border-[var(--hairline)] material",
  primary:
    "bg-[var(--accent)] text-[var(--btn-primary-fg)] hover:bg-[var(--accent-hover)] border-none shadow-[0_4px_16px_var(--accent-glow)] hover:shadow-[0_6px_24px_var(--accent-glow-strong)]",
  secondary:
    "bg-[var(--surface-2)] text-[var(--fg-dim)] hover:text-[var(--fg)] hover:bg-[var(--surface-3)] border border-[var(--hairline)] material",
  ghost:
    "bg-transparent text-[var(--fg-dim)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]",
  destructive:
    "bg-[var(--red)] text-white hover:opacity-90 border-none shadow-[0_4px_16px_rgba(255,122,107,0.25)] hover:shadow-[0_6px_24px_rgba(255,122,107,0.40)]",
  outline:
    "bg-transparent border border-[var(--hairline-strong)] text-[var(--fg)] hover:bg-[var(--surface-2)] hover:border-[var(--hairline-strong)]",
  accent:
    "bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[rgba(230,137,0,0.22)] border border-[var(--accent)]/20",
  glass:
    "bg-[var(--surface-glass)] backdrop-blur-xl text-[var(--fg)] border border-[var(--hairline)] shadow-[inset_0_1px_0_var(--specular),0_8px_32px_rgba(0,0,0,0.25)] hover:bg-[rgba(27,36,44,0.80)] hover:border-[var(--hairline-strong)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-9 px-4 text-[13px]",
  sm: "h-7 px-3 text-[12px]",
  lg: "h-10 px-5 text-[14px]",
  icon: "h-9 w-9 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      iconOnly = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        whileTap={!isDisabled ? { scale: 0.98 } : undefined}
        transition={{ duration: 0.12 }}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-1)] disabled:cursor-not-allowed disabled:opacity-40",
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && "w-full",
          iconOnly && "aspect-square",
          className
        )}
        disabled={isDisabled}
        {...(props as React.ComponentPropsWithoutRef<typeof motion.button>)}
      >
        {loading && (
          <Loader2
            className="animate-spin"
            style={{
              width: size === "sm" ? 14 : 16,
              height: size === "sm" ? 14 : 16,
            }}
          />
        )}
        {!loading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {loading && loadingText ? loadingText : children}
        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </motion.button>
    );
  }
);
Button.displayName = "Button";
