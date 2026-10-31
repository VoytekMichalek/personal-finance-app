import { useState } from "react";
import { type Integrations, useAiSettings } from "../../hooks/ai-settings";
import { Button } from "../ui/button";
import { SelectItem } from "../ui/select";
import {
  Card,
  Field,
  Input,
  Select,
  Pill,
  Loading,
  ErrorState,
} from "../common/primitives";
export function AiSettings({ admin }: { admin: boolean }) {
  const settings = useAiSettings();
  if (settings.status.isPending) return <Loading />;
  if (settings.status.error)
    return (
      <ErrorState
        message={settings.status.error.message}
        retry={() => void settings.status.refetch()}
      />
    );
  return (
    <AiSettingsForm
      admin={admin}
      data={settings.status.data}
      settings={settings}
    />
  );
}
function AiSettingsForm({
  admin,
  data,
  settings,
}: {
  admin: boolean;
  data: Integrations;
  settings: ReturnType<typeof useAiSettings>;
}) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<string | undefined>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const modelId = model ?? data.modelId ?? "";
  const busy =
    settings.save.isPending ||
    settings.remove.isPending ||
    settings.check.isPending;
  async function perform(action: () => Promise<unknown>, success: string) {
    setMessage("");
    setError("");
    try {
      await action();
      setMessage(success);
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Please try again.",
      );
    } finally {
      settings.save.reset();
      settings.check.reset();
    }
  }
  return (
    <div className="grid max-w-2xl gap-5">
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">AI assistance</h2>
          <Pill
            tone={
              data.openrouterConfigured && data.modelId ? "positive" : "warning"
            }
          >
            {data.openrouterConfigured && data.modelId
              ? "Configured"
              : "Setup needed"}
          </Pill>
        </div>
        <p className="mb-6 text-sm leading-6 text-muted-foreground">
          OpenRouter helps read statements and suggest categories. You choose
          when to use AI and review suggestions before saving transactions.
        </p>
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void perform(async () => {
              await settings.save.mutateAsync({
                modelId: modelId || null,
                ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
              });
              setApiKey("");
              setModel(undefined);
            }, "AI settings saved.");
          }}
        >
          {admin ? (
            <div>
              <Field label="OpenRouter API key">
                <Input
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  value={apiKey}
                  disabled={busy}
                  maxLength={512}
                  placeholder={
                    data.openrouterConfigured
                      ? "Key saved — leave blank to keep it"
                      : "Paste your OpenRouter API key"
                  }
                  onChange={(event) => {
                    setApiKey(event.target.value);
                    setMessage("");
                    setError("");
                  }}
                />
              </Field>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Stored encrypted and never displayed after saving. Get a key
                from{" "}
                <a
                  className="text-primary underline"
                  href="https://openrouter.ai/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  OpenRouter
                </a>
                .
                {data.keySource === "environment" &&
                  " Currently using the key configured on the server."}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              An administrator can update the API key and model.
            </p>
          )}
          <Field label="AI model">
            <Select
              scrollButtons={false}
              value={modelId}
              disabled={!admin || busy}
              onValueChange={(value) => {
                setModel(value);
                setMessage("");
              }}
            >
              <SelectItem value="">Choose a model</SelectItem>
              {data.models.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.provider} · {item.displayName}
                </SelectItem>
              ))}
            </Select>
          </Field>
          {admin && (
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>
                {settings.save.isPending ? "Saving…" : "Save AI settings"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={
                  busy || (!apiKey.trim() && !data.openrouterConfigured)
                }
                onClick={() =>
                  void perform(
                    () =>
                      settings.check.mutateAsync(apiKey.trim() || undefined),
                    "Key accepted by OpenRouter. This check does not send financial data or test the selected model.",
                  )
                }
              >
                {settings.check.isPending ? "Checking…" : "Check key"}
              </Button>
              {data.keySource === "settings" && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await settings.remove.mutateAsync();
                      setApiKey("");
                    }, "Saved key removed. Any server-configured key will now be used.")
                  }
                >
                  Remove saved key
                </Button>
              )}
            </div>
          )}
          {message && (
            <p role="status" className="text-sm text-primary">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      </Card>
      <p className="text-xs leading-5 text-muted-foreground">
        OpenRouter usage is billed to your OpenRouter account. Statement uploads
        ask for your permission before sending text to AI. Local statement
        reading remains available without a key.
      </p>
    </div>
  );
}
