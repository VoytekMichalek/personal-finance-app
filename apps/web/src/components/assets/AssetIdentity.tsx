import { type Asset, type VisualIcon as IconName } from "@finance/shared";
import { VisualIcon } from "../common/VisualIcon";
const styles: Record<string, [IconName, string]> = {
  property: ["home", "#b18a5e"],
  investment: ["trending-up", "#538b80"],
  superannuation: ["piggy-bank", "#8c7bab"],
  vehicle: ["car", "#658db2"],
  mortgage: ["home", "#a5756c"],
  loan: ["landmark", "#a5756c"],
};
export function AssetIdentity({
  asset,
  small = false,
}: {
  asset: Pick<Asset, "name" | "classification" | "kind">;
  small?: boolean;
}) {
  const [icon, color] = styles[asset.classification] ?? [
    asset.kind === "liability" ? "landmark" : "wallet",
    "#71859c",
  ];
  return (
    <span className="flex min-w-0 items-center gap-3">
      <VisualIcon name={icon} color={color} small={small} />
      <span className="min-w-0">
        <span className="block break-words text-sm font-semibold">
          {asset.name}
        </span>
        <span className="mt-1 block text-xs capitalize text-muted-foreground">
          {asset.classification}
        </span>
      </span>
    </span>
  );
}
