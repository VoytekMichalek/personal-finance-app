import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: Parameters<typeof clsx>) =>
  twMerge(clsx(...inputs));
const variants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-11 px-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-blue-600 shadow-sm",
        secondary: "bg-white border border-border hover:bg-muted",
        ghost: "hover:bg-muted text-muted-foreground",
        destructive: "bg-destructive text-white hover:bg-red-700",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-11 md:h-9 px-3",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof variants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(variants({ variant, size }), className)}
      {...props}
    />
  );
}
