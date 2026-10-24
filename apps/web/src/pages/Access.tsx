import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Fingerprint,
  ArrowRight,
  ArrowUpRight,
  LockKeyhole,
} from "lucide-react";
import { api, send } from "../lib/api";
import { authClient } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Attribution } from "../components/common/Attribution";
import { Field, Input } from "../components/common/primitives";
const setupSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  token: z.string().min(1),
});
type Setup = z.infer<typeof setupSchema>;
type Enrolment = { context: string; name: string; email: string };
export function Access() {
  const client = useQueryClient();
  const status = useQuery({
    queryKey: ["access-status"],
    queryFn: () =>
      api<{ bootstrapAvailable: boolean; bootstrapConfigured: boolean }>(
        "/access/status",
      ),
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(false);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [token] = useState(() =>
    window.location.pathname === "/enrol" ? window.location.hash.slice(1) : "",
  );
  const started = useRef(false);
  const form = useForm<Setup>({
    resolver: zodResolver(setupSchema),
    defaultValues: { name: "", email: "", token: "" },
  });
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    window.history.replaceState(null, "", "/enrol");
    setBusy(true);
    void send<Enrolment>("/access/exchange", { token })
      .then(setEnrolment)
      .catch((e) => setError((e as Error).message))
      .finally(() => setBusy(false));
  }, [token]);
  async function registered(data: Enrolment) {
    setBusy(true);
    setError("");
    try {
      const result = await authClient.passkey.addPasskey({
        name: "Primary passkey",
        context: data.context,
        createSession: true,
      });
      if (result.error)
        throw new Error(
          result.error.message ?? "Passkey creation failed. Please try again.",
        );
      window.history.replaceState(null, "", "/");
      await client.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      setError((e as Error).message);
      setEnrolment(data);
    } finally {
      setBusy(false);
    }
  }
  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.passkey();
      if (result.error)
        throw new Error(result.error.message ?? "Could not sign in.");
      await client.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#eef1ee] p-14 lg:flex">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="flex size-8 items-center justify-center rounded-xl bg-foreground text-white">
            <ArrowUpRight size={18} />
          </span>
          Personal Finance
        </div>
        <div className="relative z-10 max-w-lg">
          <p className="mb-5 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            A little more clarity.
          </p>
          <h1 className="text-[64px] leading-[1.04] font-semibold tracking-[-0.055em]">
            Your money.
            <br />
            Your life.
            <br />
            <span className="text-[#8a9b8c]">In balance.</span>
          </h1>
          <p className="mt-7 max-w-sm text-base leading-7 text-muted-foreground">
            One calm place for the finances you share. Less admin. More room for
            what matters.
          </p>
          <div className="mt-12 flex items-center gap-2 text-xs text-muted-foreground">
            <LockKeyhole size={14} />
            Private to your household
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Made for the two of you.
        </p>
        <div className="absolute -right-36 -bottom-36 size-[500px] rounded-full border-[90px] border-white/30" />
      </section>
      <main className="flex min-h-dvh flex-col items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <p className="mb-10 text-sm font-semibold lg:hidden">
            Personal Finance
          </p>
          <div className="mb-7 flex size-14 items-center justify-center rounded-2xl border bg-white text-primary shadow-sm">
            <Fingerprint size={28} />
          </div>
          <h2 className="text-3xl font-semibold tracking-tight">
            {enrolment
              ? "Make yourself at home."
              : setup
                ? "Your first step."
                : "Welcome home."}
          </h2>
          <p className="mt-3 mb-8 text-sm leading-6 text-muted-foreground">
            {enrolment
              ? "Create a passkey for " +
                enrolment.name +
                ". Use your device’s fingerprint, face or screen lock."
              : setup
                ? "Create the first administrator for your household."
                : "A clearer picture of your finances is one touch away."}
          </p>
          {error && (
            <p
              role="alert"
              className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {enrolment ? (
            <div>
              <p className="mb-4 text-sm text-muted-foreground">
                {enrolment.email}
              </p>
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => void registered(enrolment)}
              >
                <Fingerprint size={17} />
                {busy ? "Creating passkey…" : "Create passkey"}
              </Button>
            </div>
          ) : setup ? (
            <form
              className="grid gap-4"
              onSubmit={form.handleSubmit(async (data) => {
                setBusy(true);
                setError("");
                try {
                  const grant = await send<Enrolment>(
                    "/access/bootstrap",
                    data,
                  );
                  setEnrolment(grant);
                  await registered(grant);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              })}
            >
              <Field
                label="Your name"
                error={form.formState.errors.name?.message}
              >
                <Input autoComplete="name" {...form.register("name")} />
              </Field>
              <Field label="Email" error={form.formState.errors.email?.message}>
                <Input
                  type="email"
                  autoComplete="email"
                  {...form.register("email")}
                />
              </Field>
              <Field
                label="First-user token"
                error={form.formState.errors.token?.message}
              >
                <Input
                  type="password"
                  autoComplete="off"
                  {...form.register("token")}
                />
              </Field>
              <Button disabled={busy} type="submit">
                Create first admin <ArrowRight size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSetup(false)}
              >
                Back to sign in
              </Button>
            </form>
          ) : (
            <>
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => void signIn()}
              >
                <Fingerprint size={17} />
                {busy ? "Signing in…" : "Sign in with a passkey"}
              </Button>
              <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
                Secure sign-in. No password to remember.
              </p>
              {status.data?.bootstrapAvailable && (
                <Button
                  variant="ghost"
                  className="mt-6 w-full"
                  onClick={() => setSetup(true)}
                >
                  Create first admin <ArrowRight size={14} />
                </Button>
              )}
              {status.isError && (
                <p role="alert" className="mt-5 text-sm text-destructive">
                  The server is unavailable. Refresh to try again.
                </p>
              )}
            </>
          )}
        </div>
        <div className="mt-12 w-56">
          <Attribution />
        </div>
      </main>
    </div>
  );
}
