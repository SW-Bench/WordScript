import * as React from "react"
import { Slot } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[var(--radius-badge)] border px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--surface-3)] text-[var(--fg-dim)] border-transparent",
        primary:
          "bg-[var(--accent-soft)] text-[var(--accent)] font-semibold border-[var(--accent)]/15",
        secondary:
          "bg-[var(--surface-2)] text-[var(--fg-dim)] border-[var(--hairline)]",
        success:
          "bg-[var(--green)]/15 text-[var(--green)] font-semibold border-[var(--green)]/20",
        warning:
          "bg-[var(--orange)]/15 text-[var(--orange)] font-semibold border-[var(--orange)]/20",
        destructive:
          "bg-[var(--red)]/15 text-[var(--red)] font-semibold border-[var(--red)]/20",
        outline:
          "bg-transparent text-[var(--fg-dim)] border-[var(--hairline-strong)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean
  dot?: boolean
}

function Badge({ className, variant, asChild = false, dot = false, children, ...props }: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span"
  return (
    <Comp
      className={cn(badgeVariants({ variant }), "gap-1.5", className)}
      {...props}
    >
      {dot && (
        <span className={cn(
          "w-1.5 h-1.5 rounded-full",
          variant === "success" && "bg-[var(--green)]",
          variant === "warning" && "bg-[var(--orange)]",
          variant === "destructive" && "bg-[var(--red)]",
          variant === "primary" && "bg-[var(--accent)]",
          (!variant || variant === "default" || variant === "secondary" || variant === "outline") && "bg-[var(--fg-muted)]"
        )} />
      )}
      {children}
    </Comp>
  )
}

export { Badge, badgeVariants }
