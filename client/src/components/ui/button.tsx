/* Retargeted onto the NUMU design system.

   Radii, control heights and hover behaviour come from the design system
   rather than shadcn's defaults: the admin register sits at a 10px radius,
   controls are 40px (32px small), and hover darkens the fill by one ramp
   step — the system forbids hovers that work by lowering opacity. */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]",
        destructive:
          "bg-destructive text-white hover:bg-[var(--terracotta-2)] focus-visible:ring-destructive/20",
        outline:
          "border border-[var(--accent)] bg-transparent text-[var(--accent)] hover:bg-[var(--accent-tint)]",
        secondary:
          "bg-secondary text-secondary-foreground border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
        ghost: "hover:bg-[var(--surface-hover)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-[18px] py-2 has-[>svg]:px-4",
        sm: "h-8 gap-1.5 px-3.5 has-[>svg]:px-3",
        lg: "h-[46px] px-6 has-[>svg]:px-5",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
