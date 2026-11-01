import { useDialogViewport } from "../../hooks/dialog-viewport";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "./button";
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" />
        <ViewportContent
          onOpenAutoFocus={() => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocus.current?.isConnected) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden rounded-2xl border bg-white p-5 shadow-2xl md:p-6",
            className,
          )}
        >
          <DialogPrimitive.Title className="pr-8 text-2xl font-semibold tracking-tight">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 mb-6 text-sm text-muted-foreground">
            {description ?? "Update the details below."}
          </DialogPrimitive.Description>
          <DialogPrimitive.Close
            className="absolute top-6 right-6 rounded-lg p-2 text-muted-foreground hover:bg-muted"
            aria-label="Close dialog"
          >
            <X size={18} />
          </DialogPrimitive.Close>
          <div className="dialog-body min-h-0 overflow-y-auto overscroll-contain px-1 pb-1">
            {children}
          </div>
        </ViewportContent>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ViewportContent(
  props: ComponentProps<typeof DialogPrimitive.Content>,
) {
  const style = useDialogViewport();
  return <DialogPrimitive.Content {...props} style={style} />;
}
