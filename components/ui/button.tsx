import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-signal disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border border-cyan-signal/30 bg-cyan-signal/10 text-cyan-soft hover:bg-cyan-signal/15",
        secondary: "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
        gold: "border border-gold-mission/30 bg-gold-mission/10 text-gold-mission hover:bg-gold-mission/15",
        destructive: "border border-plasma/30 bg-plasma/10 text-plasma hover:bg-plasma/15"
      },
      size: {
        default: "h-10 px-3",
        sm: "h-9 px-2.5",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
);
Button.displayName = "Button";

export { buttonVariants };
