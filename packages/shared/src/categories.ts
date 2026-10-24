import type { Category } from "./types.js";
export function categoryLabel(category: Category, categories: Category[]) {
  const parent = categories.find((c) => c.id === category.parentId);
  return parent ? parent.name + " / " + category.name : category.name;
}
