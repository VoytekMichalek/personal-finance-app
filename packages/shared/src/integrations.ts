import { z } from "zod";
export const aiSettingsSchema = z.object({
  modelId: z.string().trim().min(1).nullable(),
  apiKey: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .regex(/^[\x21-\x7e]+$/)
    .optional(),
});
export const aiKeyCheckSchema = z.object({
  apiKey: aiSettingsSchema.shape.apiKey,
});
