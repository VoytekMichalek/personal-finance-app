import type { ComponentProps } from "react";
import {
  useController,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { DatePicker } from "./date-picker";
import { MonthPicker } from "./month-picker";

type FormProps<T extends FieldValues, TOutput extends FieldValues> = {
  control: Control<T, unknown, TOutput>;
  name: FieldPath<T>;
};
export function FormDatePicker<
  T extends FieldValues,
  TOutput extends FieldValues,
>({
  control,
  name,
  nullable = false,
  ...props
}: Omit<ComponentProps<typeof DatePicker>, "value" | "onChange" | "ref"> &
  FormProps<T, TOutput> & { nullable?: boolean }) {
  const { field, fieldState } = useController({ control, name });
  return (
    <DatePicker
      {...props}
      value={String(field.value ?? "")}
      onChange={(value) => field.onChange(nullable && !value ? null : value)}
      onBlur={field.onBlur}
      ref={field.ref}
      aria-invalid={!!fieldState.error}
    />
  );
}
export function FormMonthPicker<
  T extends FieldValues,
  TOutput extends FieldValues,
>({
  control,
  name,
  ...props
}: Omit<ComponentProps<typeof MonthPicker>, "value" | "onChange" | "ref"> &
  FormProps<T, TOutput>) {
  const { field, fieldState } = useController({ control, name });
  return (
    <MonthPicker
      {...props}
      value={String(field.value ?? "")}
      onChange={field.onChange}
      onBlur={field.onBlur}
      ref={field.ref}
      aria-invalid={!!fieldState.error}
    />
  );
}
