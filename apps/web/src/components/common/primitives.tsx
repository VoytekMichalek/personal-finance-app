import { ArrowUpRight, LoaderCircle, Plus } from "lucide-react";
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
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-9 flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className="mb-2 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
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
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed bg-white/50 px-6 py-12 text-center">
      <div className="mb-4 rounded-2xl bg-blue-50 p-3 text-primary">
        <Plus size={22} />
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
    <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground">
      <LoaderCircle className="animate-spin" size={18} />
      Loading your finances…
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
        ? cloneElement(children as ReactElement<{ id?: string }>, { id })
        : children}
      {error && (
        <span role="alert" className="text-xs text-destructive">
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
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "warning";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium",
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
    <div className="mb-5 flex items-center justify-between gap-3">
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
