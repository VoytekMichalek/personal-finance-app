import { money, type VisualIcon as IconName } from "@finance/shared";
import { VisualIcon } from "./VisualIcon";
import { cn } from "../ui/button";
export function SummaryCard({
  label,
  amount,
  detail,
  icon = "wallet",
  color = "#6187ae",
  featured = false,
  onClick,
}: {
  label: string;
  amount: number;
  detail?: string;
  icon?: IconName;
  color?: string;
  featured?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "section";
  const [whole, cents] = money(amount).split(".");
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "min-w-0 rounded-2xl border border-black/6 bg-white p-5 text-left shadow-[0_2px_8px_#20242a03]",
        onClick && "transition-shadow hover:shadow-md",
        featured && "sm:col-span-2 xl:col-span-1",
      )}
      style={{
        backgroundImage: `linear-gradient(120deg, ${color}${featured ? "20" : "10"}, transparent 95%)`,
      }}
    >
      <div className="mb-5 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        <VisualIcon name={icon} color={color} small={!featured} />
      </div>
      <p
        className={cn(
          "font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere]",
          featured ? "text-3xl lg:text-4xl" : "text-2xl lg:text-3xl",
        )}
      >
        {whole}
        <span className="text-[0.72em]">.{cents}</span>
      </p>
      {detail && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {detail}
        </p>
      )}
    </Tag>
  );
}
