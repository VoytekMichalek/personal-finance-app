import { SelectItem, FormSelect } from "../ui/select";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, Copy, Link2, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { userInviteSchema, type Person } from "@finance/shared";
import { api, send } from "../../lib/api";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import {
  Card,
  Field,
  Input,
  Select,
  Pill,
  Loading,
  ErrorState,
} from "../common/primitives";
type Invite = { inviteUrl: string; expiresAt: string };
export function Users() {
  const query = useQuery({
    queryKey: ["users"],
    queryFn: () => api<Person[]>("/access/users"),
  });
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState<Invite>();
  const [busy, setBusy] = useState(false);
  const form = useForm<
    z.input<typeof userInviteSchema>,
    unknown,
    z.output<typeof userInviteSchema>
  >({
    resolver: zodResolver(userInviteSchema),
    defaultValues: { name: "", email: "", role: "member" },
  });
  async function action(user: Person, name: string, body: unknown = {}) {
    if (
      name === "delete" &&
      !window.confirm(
        "Delete " +
          user.name +
          "? Their access will be revoked. Financial history will be preserved.",
      )
    )
      return;
    if (
      name === "reset" &&
      !window.confirm(
        "Reset " +
          user.name +
          "’s access? All their passkeys and sessions will be revoked and a new invitation created.",
      )
    )
      return;
    if (
      name === "reinvite" &&
      !window.confirm(
        "Create a new invitation for " +
          user.name +
          "? Previous links will stop working.",
      )
    )
      return;
    setBusy(true);
    try {
      const result = await send<Invite | { ok: true }>(
        "/access/users/" + user.id + "/" + name,
        body,
      );
      if ("inviteUrl" in result) setInvite(result);
      await query.refetch();
      if (name === "role" || name === "delete")
        await client.invalidateQueries({ queryKey: ["me"] });
      toast.success("User updated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Your people</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Invite your wife and manage household access.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <UserPlus size={15} />
          Add user
        </Button>
      </div>
      <Card className="overflow-hidden p-0!">
        <div className="divide-y">
          {query.data.map((user) => (
            <div
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-4 p-5"
            >
              <div>
                <p className="text-sm font-medium">{user.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {user.email}
                </p>
                <div className="mt-2">
                  <Pill tone={user.state === "active" ? "positive" : "neutral"}>
                    {user.state}
                  </Pill>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <Select
                  aria-label={"Role for " + user.name}
                  className="mr-2 w-28"
                  value={user.role}
                  disabled={busy}
                  onValueChange={(value) =>
                    void action(user, "role", { role: value })
                  }
                >
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </Select>
                {user.state !== "active" ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={"New invite for " + user.name}
                    disabled={busy}
                    onClick={() => void action(user, "reinvite")}
                  >
                    <Link2 size={15} />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={"Reset access for " + user.name}
                    disabled={busy}
                    onClick={() => void action(user, "reset")}
                  >
                    <KeyRound size={15} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={"Delete " + user.name}
                  disabled={busy}
                  onClick={() => void action(user, "delete")}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <p className="mt-5 text-xs leading-6 text-muted-foreground">
        Members can manage all household finances. Administrators also manage
        access and AI model settings. Your last active administrator is
        protected.
      </p>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Add someone to your household"
        description="They’ll create their own passkey using a private invitation link."
      >
        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit(async (body) => {
            setBusy(true);
            try {
              const result = await send<Invite>("/access/users", body);
              setInvite(result);
              setOpen(false);
              form.reset();
              await query.refetch();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          })}
        >
          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} />
          </Field>
          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input type="email" {...form.register("email")} />
          </Field>
          <Field label="Role">
            <FormSelect control={form.control} name={"role"}>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Administrator</SelectItem>
            </FormSelect>
          </Field>
          <Button disabled={busy} type="submit">
            Create invitation
          </Button>
        </form>
      </Dialog>
      <Dialog
        open={Boolean(invite)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setInvite(undefined);
        }}
        title="An invitation, just for them."
        description="Share this link directly. It can be used once and expires in seven days."
      >
        {invite && (
          <div className="grid gap-4">
            <Input
              readOnly
              aria-label="Invitation link"
              value={invite.inviteUrl}
            />
            <p className="text-xs text-muted-foreground">
              Expires{" "}
              {new Date(invite.expiresAt).toLocaleString("en-AU", {
                timeZone: "Australia/Brisbane",
              })}{" "}
              (Brisbane)
            </p>
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(invite.inviteUrl);
                  toast.success("Invite link copied");
                } catch {
                  toast.error(
                    "Could not copy. Select the link and copy it manually.",
                  );
                }
              }}
            >
              <Copy size={14} />
              Copy invite link
            </Button>
          </div>
        )}
      </Dialog>
    </>
  );
}
