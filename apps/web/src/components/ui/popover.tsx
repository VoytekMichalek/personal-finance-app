import * as Radix from "@radix-ui/react-popover";
import type { ReactElement, ReactNode } from "react";
import { cn } from "./button";

export function Popover({
  open,
  onOpenChange,
  trigger,
  label,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Radix.Root open={open} onOpenChange={onOpenChange}>
      <Radix.Trigger asChild>{trigger}</Radix.Trigger>
      <Radix.Portal>
        <Radix.Content
          aria-label={label}
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            "z-[80] max-h-[var(--radix-popover-content-available-height)] w-80 max-w-[calc(100vw-24px)] overflow-y-auto rounded-2xl border bg-white p-4 shadow-xl outline-none",
            className,
          )}
        >
          {children}
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}
