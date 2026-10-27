import { useRef, type ComponentProps } from "react";
import { X } from "lucide-react";
import { Button, cn } from "../ui/button";
import { inputClass } from "./primitives";

type SearchInputProps = Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "type" | "ref" | "defaultValue"
> & {
  value: string;
  onValueChange: (value: string) => void;
  clearLabel?: string;
};

export function SearchInput({
  value,
  onValueChange,
  clearLabel = "Clear search",
  className,
  onKeyDown,
  ...props
}: SearchInputProps) {
  const input = useRef<HTMLInputElement>(null);
  const canClear = value.length > 0 && !props.readOnly;
  const clear = () => {
    onValueChange("");
    input.current?.focus();
  };
  return (
    <div className="relative min-w-0">
      <input
        {...props}
        ref={input}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.key === "Escape" && canClear && !event.defaultPrevented) {
            event.preventDefault();
            clear();
          }
        }}
        className={cn(
          inputClass,
          "pr-12 [&::-webkit-search-cancel-button]:appearance-none",
          className,
        )}
      />
      {canClear && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute inset-y-0 right-0 rounded-l-none"
          aria-label={clearLabel}
          disabled={props.disabled}
          onClick={clear}
        >
          <X size={16} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
