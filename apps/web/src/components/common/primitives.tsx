import { VisualIcon } from "./VisualIcon";
import { type VisualIcon as IconName } from "@finance/shared";
import { ArrowUpRight } from "lucide-react";
import {
  cloneElement,
  isValidElement,
  useId,
  type ReactNode,
  type ComponentProps,
  type ReactElement,
} from "react";
import { Button, cn } from "../ui/button";
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-wrap justify-between gap-4",
        description ? "items-end" : "items-center",
      )}
    >
      <div>
        {eyebrow && (
          <p className="mb-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-white p-5 shadow-[0_2px_8px_#20242a03] md:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}
export function Empty({
  icon = "wallet",
  title,
  description,
  action,
}: {
  title: string;
  icon?: IconName;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed bg-white/50 px-6 py-12 text-center">
      <div className="mb-4 rounded-2xl bg-blue-50 p-3 text-primary">
        <VisualIcon name={icon} bare />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 mb-5 max-w-sm text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div role="status" aria-label="Loading your finances" className="space-y-6">
      <span className="sr-only">Loading your finances…</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse space-y-6">
        <div className="h-9 w-48 rounded-lg bg-slate-200/70" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-36 rounded-2xl border bg-white p-5">
              <div className="h-3 w-24 rounded bg-slate-100" />
              <div className="mt-6 h-7 w-32 rounded bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="h-64 rounded-2xl border bg-white p-6 space-y-5">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-6 rounded bg-slate-100/70" />
          ))}
        </div>
      </div>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <Card>
      <p role="alert" className="mb-4 text-sm text-destructive">
        {message}
      </p>
      <Button variant="secondary" onClick={retry}>
        Try again
      </Button>
    </Card>
  );
}
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="grid min-w-0 gap-2 text-sm font-medium">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(
            children as ReactElement<{
              id?: string;
              "aria-invalid"?: boolean;
              "aria-describedby"?: string;
            }>,
            {
              id,
              ...(error
                ? { "aria-invalid": true, "aria-describedby": id + "-error" }
                : {}),
            },
          )
        : children}
      {error && (
        <span
          id={id + "-error"}
          role="alert"
          className="text-xs text-destructive"
        >
          {error}
        </span>
      )}
    </div>
  );
}
export const inputClass =
  "h-11 w-full rounded-xl border bg-white px-3 text-base md:text-sm font-normal placeholder:text-gray-400";
export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}
export { Select } from "../ui/select";
export function Pill({
  children,
  tone = "neutral",
  colour,
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "warning";
  colour?: string;
}) {
  return (
    <span
      style={
        colour
          ? {
              backgroundColor: `color-mix(in srgb, ${colour} 13%, white)`,
              color: `color-mix(in srgb, ${colour} 55%, black)`,
              borderColor: `color-mix(in srgb, ${colour} 28%, white)`,
            }
          : undefined
      }
      className={cn(
        "inline-flex max-w-full items-center justify-center rounded-full border border-transparent px-2.5 py-1 text-center text-xs font-medium",
        tone === "positive"
          ? "bg-emerald-50 text-emerald-700"
          : tone === "warning"
            ? "bg-amber-50 text-amber-700"
            : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs font-medium text-primary"
    >
      {children}
      <ArrowUpRight size={13} />
    </button>
  );
}
