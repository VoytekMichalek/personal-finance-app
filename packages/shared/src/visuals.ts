import type { Category } from "./types.js";

export const visualIcons = [
  "tag",
  "basket",
  "utensils",
  "home",
  "car",
  "bolt",
  "heart",
  "repeat",
  "plane",
  "shopping-bag",
  "briefcase",
  "gift",
  "graduation-cap",
  "paw-print",
  "music",
  "tv",
  "wifi",
  "phone",
  "cloud",
  "landmark",
  "wallet",
  "piggy-bank",
  "trending-up",
  "shield",
  "arrow-left-right",
] as const;
export type VisualIcon = (typeof visualIcons)[number];
export function categoryIcon(
  category?: Pick<Category, "name" | "icon" | "parentId">,
  categories: Category[] = [],
): VisualIcon {
  if (!category) return "tag";
  if (category.icon) return category.icon;
  const name = category.name.toLowerCase();
  const matches: [RegExp, VisualIcon][] = [
    [/grocer|food|supermarket/, "basket"],
    [/dining|restaurant|cafe|coffee/, "utensils"],
    [/home|rent|mortgage|property/, "home"],
    [/transport|fuel|\bcar\b|parking/, "car"],
    [/utilit|electric|gas|water/, "bolt"],
    [/health|medical|fitness/, "heart"],
    [/subscription/, "repeat"],
    [/travel|holiday/, "plane"],
    [/shopping|clothing/, "shopping-bag"],
    [/salary|work|income/, "briefcase"],
    [/gift|donation/, "gift"],
    [/education|school/, "graduation-cap"],
    [/pet/, "paw-print"],
    [/music/, "music"],
    [/internet|broadband/, "wifi"],
    [/phone|mobile/, "phone"],
    [/insurance/, "shield"],
    [/saving/, "piggy-bank"],
    [/invest|superannuation/, "trending-up"],
  ];
  const match = matches.find(([pattern]) => pattern.test(name));
  if (match) return match[1];
  const parent = categories.find((c) => c.id === category.parentId);
  return parent ? categoryIcon({ ...parent, parentId: null }) : "tag";
}
