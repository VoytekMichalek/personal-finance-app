import { expect, it } from "vitest";
import { categoryColour, identityColour } from "./colours.js";
import type { Category } from "./types.js";
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
