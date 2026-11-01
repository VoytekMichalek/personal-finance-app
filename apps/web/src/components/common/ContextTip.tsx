import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

export function ContextTip({
  label,
  children,
}: {
  label: string;
  children: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>();
  const show = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (rect)
      setPosition({
        left: Math.max(12, Math.min(rect.left, innerWidth - 332)),
        top: Math.max(12, Math.min(rect.bottom + 8, innerHeight - 210)),
      });
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={position ? id : undefined}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        onMouseEnter={show}
        onMouseLeave={() => {
          if (document.activeElement !== trigger.current)
            setPosition(undefined);
        }}
        onFocus={show}
        onBlur={() => setPosition(undefined)}
        onClick={show}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setPosition(undefined);
          }
        }}
      >
        <Info size={14} />
      </button>
      {position &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={position}
            className="fixed z-[100] max-h-[60vh] w-[min(320px,calc(100vw-24px))] overflow-auto rounded-xl border bg-white p-3 text-xs leading-5 text-foreground shadow-lg"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
