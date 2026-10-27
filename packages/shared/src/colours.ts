import type { Category } from "./types.js";

/** Stable identity colours: sorting/filtering a view never changes an entity's colour. */
export function identityColour(key: string): string {
  let hash = 2166136261;
  for (const character of key)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const hue = ((hash >>> 0) % 360000) / 1000;
  return `hsl(${hue} 62% 40%)`;
}
export function categoryColour(category: Category, categories: Category[]) {
  return categories.some(
    (other) =>
      other.id !== category.id &&
      other.color.toLowerCase() === category.color.toLowerCase(),
  )
    ? identityColour("category:" + category.id)
    : category.color;
}
