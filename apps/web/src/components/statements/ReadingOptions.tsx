import { Link } from "react-router-dom";
import type { StatementReadingOptions } from "../../hooks/statements";
import { Field, Input, Select } from "../common/primitives";
import { SelectItem } from "../ui/select";

export function ReadingOptions({
  value,
  onChange,
  disabled,
}: {
  value: StatementReadingOptions;
  onChange: (value: StatementReadingOptions) => void;
  disabled?: boolean;
}) {
  return (
    <details className="my-4 text-sm">
      <summary className="cursor-pointer font-medium">
        Change reading options
      </summary>
      <div className="mt-3 grid gap-3">
        <Field label="Year for dates without a year">
          <Input
            type="number"
            min={1900}
            max={2200}
            placeholder="Original year / auto-detect"
            value={value.year ?? ""}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...value,
                year: event.target.value ? Number(event.target.value) : null,
              })
            }
          />
        </Field>
        <Field label="AI reading">
          <Select
            value={
              value.useAi === undefined ? "keep" : value.useAi ? "yes" : "no"
            }
            disabled={disabled}
            onValueChange={(choice) =>
              onChange({
                ...value,
                useAi: choice === "keep" ? undefined : choice === "yes",
              })
            }
          >
            <SelectItem value="keep">Keep original setting</SelectItem>
            <SelectItem value="no">Read without AI</SelectItem>
            <SelectItem value="yes">Use selected AI model</SelectItem>
          </Select>
        </Field>
        <p className="text-xs text-muted-foreground">
          AI shares redacted statement text, including merchants and financial
          details, with your selected OpenRouter model.{" "}
          <Link
            className="text-primary underline"
            to="/settings/ai"
            target="_blank"
            rel="noreferrer"
          >
            AI settings (new tab)
          </Link>
        </p>
      </div>
    </details>
  );
}
