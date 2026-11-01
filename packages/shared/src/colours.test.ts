import { expect, it } from "vitest";
import { categoryColour, identityColour, ownerColour } from "./colours.js";
import type { Category } from "./types.js";

it("gives household members visibly separated ownership colours", () => {
  const people = [{ id: "one" }, { id: "two" }];
  const hues = ["household", ...people.map((person) => person.id)].map(
    (owner) => Number(ownerColour(owner, people).match(/hsl\(([\d.]+)/)![1]),
  );
  for (const [i, hue] of hues.entries()) {
    for (const other of hues.slice(i + 1)) {
      const distance = Math.abs(hue - other);
      expect(Math.min(distance, 360 - distance)).toBeGreaterThanOrEqual(90);
    }
  }
});

it("keeps owner colours consistent across reordered rosters and repeated accounts", () => {
  const people = Array.from({ length: 20 }, (_, index) => ({
    id: `person-${index}`,
  }));
  const owners = ["household", ...people.map((person) => person.id)];
  const colours = owners.map((owner) => ownerColour(owner, people));
  expect(new Set(colours).size).toBe(owners.length);
  expect(
    owners.map((owner) => ownerColour(owner, [...people].reverse())),
  ).toEqual(colours);
  expect(ownerColour("household", [])).toBe(colours[0]);
  const first = people[0]!;
  expect(ownerColour(first.id, [...people, first])).toBe(colours[1]);
});

it("keeps identity colours stable and distinguishes people, types and accounts", () => {
  const keys = [
    "person:household",
    "person:one",
    "person:two",
    "account:one",
    "account:two",
    "type:income",
    "type:expense",
    "type:refund",
    "type:transfer",
  ];
  expect(new Set(keys.map(identityColour)).size).toBe(keys.length);
  expect(keys.map(identityColour)).toEqual(
    [...keys].reverse().map(identityColour).reverse(),
  );
});
it("preserves chosen category colours and distinguishes shared default colours", () => {
  const categories = [
    { id: "a", color: "#007aff" },
    { id: "b", color: "#007AFF" },
    { id: "c", color: "#ff00aa" },
  ] as Category[];
  expect(categoryColour(categories[0]!, categories)).not.toBe(
    categoryColour(categories[1]!, categories),
  );
  expect(categoryColour(categories[2]!, categories)).toBe("#ff00aa");
  expect(categoryColour(categories[0]!, categories)).toBe(
    categoryColour(categories[0]!, [...categories].reverse()),
  );
});

it("assigns unique persisted hex colours independently of category order", async () => {
  const { uniqueCategoryColours } = await import("./colours.js");
  const categories = Array.from({ length: 2000 }, (_, i) => ({
    id: String(i).padStart(5, "0"),
  }));
  const colours = uniqueCategoryColours(categories);
  expect(new Set(colours.map((c) => c.color)).size).toBe(2000);
  expect(colours.every((c) => /^#[0-9a-f]{6}$/.test(c.color))).toBe(true);
  expect(uniqueCategoryColours([...categories].reverse())).toEqual(colours);
});
