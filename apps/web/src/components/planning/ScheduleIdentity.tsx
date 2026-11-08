import {
  categoryIcon,
  categoryColour,
  type Category,
  type Schedule,
} from "@finance/shared";
import { VisualIcon } from "../common/VisualIcon";

type Identity = Pick<Schedule, "name" | "kind"> &
  Partial<Pick<Schedule, "provider" | "categoryId" | "icon" | "color">>;
export function ScheduleIdentity({
  schedule,
  categories,
  small = false,
}: {
  schedule: Identity;
  categories: Category[];
  small?: boolean;
}) {
  const category = categories.find((c) => c.id === schedule.categoryId);
  const icon =
    schedule.icon ??
    (schedule.kind === "transfer"
      ? "arrow-left-right"
      : category
        ? categoryIcon(category, categories)
        : schedule.kind === "income"
          ? "briefcase"
          : "repeat");
  const color =
    schedule.color ??
    (category ? categoryColour(category, categories) : "#738caa");
  return (
    <div className="flex min-w-0 items-center gap-3">
      <VisualIcon name={icon} color={color} small={small} />
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold">{schedule.name}</p>
        {schedule.provider && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {schedule.provider}
          </p>
        )}
      </div>
    </div>
  );
}
