import {
  Tag,
  ShoppingBasket,
  Utensils,
  House,
  Car,
  Zap,
  Heart,
  Repeat,
  Plane,
  ShoppingBag,
  BriefcaseBusiness,
  Gift,
  GraduationCap,
  PawPrint,
  Music,
  Tv,
  Wifi,
  Smartphone,
  Cloud,
  Landmark,
  Wallet,
  PiggyBank,
  TrendingUp,
  Shield,
  ArrowLeftRight,
} from "lucide-react";
import {
  categoryColour,
  categoryIcon,
  type Category,
  type VisualIcon as IconName,
} from "@finance/shared";
import { cn } from "../ui/button";
const icons = {
  tag: Tag,
  basket: ShoppingBasket,
  utensils: Utensils,
  home: House,
  car: Car,
  bolt: Zap,
  heart: Heart,
  repeat: Repeat,
  plane: Plane,
  "shopping-bag": ShoppingBag,
  briefcase: BriefcaseBusiness,
  gift: Gift,
  "graduation-cap": GraduationCap,
  "paw-print": PawPrint,
  music: Music,
  tv: Tv,
  wifi: Wifi,
  phone: Smartphone,
  cloud: Cloud,
  landmark: Landmark,
  wallet: Wallet,
  "piggy-bank": PiggyBank,
  "trending-up": TrendingUp,
  shield: Shield,
  "arrow-left-right": ArrowLeftRight,
};
export function VisualIcon({
  name,
  color = "#61758b",
  small = false,
  bare = false,
}: {
  name: IconName;
  color?: string;
  small?: boolean;
  bare?: boolean;
}) {
  const Icon = icons[name] ?? Tag;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl",
        small ? "size-7 rounded-lg" : "size-11",
        bare && "size-auto!",
      )}
      style={{
        backgroundColor: bare
          ? undefined
          : `color-mix(in srgb, ${color} 9%, white)`,
        color: `color-mix(in srgb, ${color} 70%, #26313b)`,
      }}
    >
      <Icon size={small ? 15 : 21} strokeWidth={1.7} />
    </span>
  );
}
export function CategoryIcon({
  category,
  categories,
  small = false,
  bare = false,
}: {
  category?: Category;
  categories: Category[];
  small?: boolean;
  bare?: boolean;
}) {
  return (
    <VisualIcon
      name={categoryIcon(category, categories)}
      color={category ? categoryColour(category, categories) : "#748093"}
      small={small}
      bare={bare}
    />
  );
}
