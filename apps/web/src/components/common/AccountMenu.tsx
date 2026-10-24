import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Fingerprint, LogOut, MoreHorizontal, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { Person } from "@finance/shared";
import { authClient } from "../../lib/auth";
import { Button, cn } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Input, Field } from "./primitives";
export function AccountMenu({
  user,
  collapsed = false,
  compact = false,
}: {
  user: Person;
  collapsed?: boolean;
  compact?: boolean;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const keys = useQuery({
    queryKey: ["passkeys"],
    queryFn: async () => {
      const result = await authClient.passkey.listUserPasskeys();
      if (result.error) throw new Error(result.error.message);
      return result.data ?? [];
    },
    enabled: open,
  });
  async function logout() {
    const result = await authClient.signOut();
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    client.clear();
    window.location.assign("/");
  }
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className={cn(
            "rounded-xl text-left hover:bg-muted",
            compact
              ? "sidebar-control"
              : "flex w-full items-center gap-3 px-3 py-3",
          )}
          aria-label="Account menu"
        >
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full bg-[#e7ebef] font-semibold",
              compact ? "sidebar-icon size-5 text-[9px]" : "size-8 text-xs",
            )}
          >
            {user.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </span>
          <span
            aria-hidden={collapsed}
            className={
              compact
                ? "sidebar-label sidebar-link-label sidebar-account-label"
                : "min-w-0 flex-1"
            }
          >
            <span className="block truncate text-xs font-semibold">
              {user.name}
            </span>
            {!compact && (
              <span className="block text-[10px] text-muted-foreground">
                Your household
              </span>
            )}
          </span>
          <MoreHorizontal
            size={16}
            aria-hidden="true"
            className={cn(
              "text-muted-foreground",
              compact && "sidebar-label absolute right-3",
            )}
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={8}
            className="z-50 min-w-48 rounded-xl border bg-white p-1.5 shadow-lg"
          >
            <DropdownMenu.Item
              onSelect={() => setOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none focus:bg-muted"
            >
              <Fingerprint size={16} />
              Manage passkeys
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => void logout()}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none focus:bg-muted"
            >
              <LogOut size={16} />
              Log out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Your passkeys"
        description="Add another device before removing your last passkey."
      >
        <div className="grid gap-3">
          {keys.data?.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-xl border p-3"
            >
              <div className="flex items-center gap-3 text-sm">
                <Fingerprint size={18} />
                {key.name || "Passkey"}
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={"Remove " + (key.name || "passkey")}
                onClick={async () => {
                  if (!window.confirm("Remove this passkey?")) return;
                  const result = await authClient.passkey.deletePasskey({
                    id: key.id,
                  });
                  if (result.error) toast.error(result.error.message);
                  else {
                    toast.success("Passkey removed");
                    await keys.refetch();
                  }
                }}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
          {keys.error && (
            <p role="alert" className="text-sm text-destructive">
              {keys.error.message}
            </p>
          )}
          <Field label="New passkey name">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. MacBook"
            />
          </Field>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await authClient.passkey.addPasskey({
                  name: label || "Additional passkey",
                });
                if (result.error) throw new Error(result.error.message);
                await keys.refetch();
                setLabel("");
                toast.success("Passkey added");
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Creating…" : "Add passkey"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
