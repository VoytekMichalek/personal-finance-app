import { z } from "zod";
import { id } from "./schemas.js";
const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const categoryColoursSchema = z
  .object({
    changes: z
      .array(z.object({ id, color: colour, expectedColor: colour }).strict())
      .min(1)
      .max(10000)
      .refine(
        (rows) => new Set(rows.map((r) => r.id)).size === rows.length,
        "Each category must appear once.",
      ),
  })
  .strict();
