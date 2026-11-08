import { z } from "zod";
import type { UseFormReturn } from "react-hook-form";
import { accountSchema } from "@finance/shared";
import { moneyField } from "../common/form";

export const accountFormSchema = accountSchema.extend({
  openingBalanceCents: moneyField,
});
export type AccountFormInput = z.input<typeof accountFormSchema>;
export type AccountFormOutput = z.output<typeof accountFormSchema>;
export type AccountFormControl = UseFormReturn<
  AccountFormInput,
  unknown,
  AccountFormOutput
>;
