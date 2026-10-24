import { cn } from "../ui/button";

export function Attribution({
  collapsed = false,
  compact = false,
}: {
  collapsed?: boolean;
  compact?: boolean;
}) {
  return (
    <a
      aria-label="Produced by Codename"
      className={cn(
        "flex w-full items-center overflow-hidden rounded-md border border-slate-800 bg-slate-950 text-white shadow-sm transition-colors hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D7FA37]/70",
        compact
          ? "sidebar-attribution mt-1"
          : "mt-3 h-10 justify-center gap-2 px-2.5",
      )}
      href="https://codename.au/"
      rel="noopener noreferrer"
      target="_blank"
      title={collapsed ? "Produced by Codename" : undefined}
    >
      <span
        aria-hidden={collapsed}
        className={
          compact
            ? "sidebar-attribution-full sidebar-label"
            : "flex items-center gap-2"
        }
      >
        <span className="whitespace-nowrap text-[0.52rem] font-black uppercase tracking-[0.13em] text-white/50">
          Produced by
        </span>
        <img
          alt="Codename"
          className="h-auto w-[88px] object-contain"
          height={14}
          width={100}
          src="/images/codename-logo-acid-dark.svg"
        />
      </span>
      {compact && (
        <img
          aria-hidden={!collapsed}
          alt="Codename"
          className="sidebar-attribution-icon size-5 object-contain"
          height={20}
          width={20}
          src="/images/codename-icon-acid.svg"
        />
      )}
    </a>
  );
}
