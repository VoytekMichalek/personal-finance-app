import type { Category, Person } from "./types.js";

/** Stable identity colours: sorting/filtering a view never changes an entity's colour. */
export function identityColour(key: string): string {
  let hash = 2166136261;
  for (const character of key)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const hue = ((hash >>> 0) % 360000) / 1000;
  return `hsl(${hue} 62% 40%)`;
}

/** Use the full household roster so filtering, sorting and renaming keep colours. */
export function ownerColour(
  owner: string,
  people: readonly Pick<Person, "id">[],
) {
  const owners = [
    "household",
    ...[...new Set([...people.map((person) => person.id), owner])]
      .filter((id) => id !== "household")
      .sort(),
  ];
  // Split the colour wheel into successive halves: amber, blue, green, purple…
  // Unlike hashed hues, the first owners are widely separated, with no repeats.
  let position = owners.indexOf(owner),
    hue = 38,
    step = 180;
  while (position > 0) {
    hue += (position % 2) * step;
    position = Math.floor(position / 2);
    step /= 2;
  }
  return `hsl(${hue % 360} 62% 40%)`;
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

/** A deliberately separated palette, saved on each category rather than inferred at render time. */
export function uniqueCategoryColours(
  categories: readonly Pick<Category, "id">[],
) {
  const used = new Set<string>();
  return [...categories]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((category, i) => {
      const hue = (220 + i * 137.508) % 360;
      const lightness = [0.44, 0.56, 0.35][Math.floor(i / 12) % 3]!;
      const chroma = (1 - Math.abs(2 * lightness - 1)) * 0.62;
      const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
      const rgb =
        hue < 60
          ? [chroma, x, 0]
          : hue < 120
            ? [x, chroma, 0]
            : hue < 180
              ? [0, chroma, x]
              : hue < 240
                ? [0, x, chroma]
                : hue < 300
                  ? [x, 0, chroma]
                  : [chroma, 0, x];
      let number = parseInt(
        rgb
          .map((v) =>
            Math.round((v + lightness - chroma / 2) * 255)
              .toString(16)
              .padStart(2, "0"),
          )
          .join(""),
        16,
      );
      let color = "#" + number.toString(16).padStart(6, "0");
      while (used.has(color)) {
        number = (number + 1) % 0x1000000;
        color = "#" + number.toString(16).padStart(6, "0");
      }
      used.add(color);
      return { id: category.id, color };
    });
}
