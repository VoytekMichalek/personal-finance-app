import {
  accountBrand,
  accountLabel,
  type Account,
  type Institution,
} from "@finance/shared";
import type { ReactNode } from "react";
import { InstitutionLogo } from "./InstitutionLogo";
export function AccountIdentity({
  account,
  institutions = [],
  compact = true,
}: {
  account?: Account;
  institutions?: Institution[];
  compact?: boolean;
}) {
  if (!account) return <span>Choose account</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span aria-hidden="true">
        <InstitutionLogo
          brand={accountBrand(account, institutions)}
          small={compact}
        />
      </span>
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {accountLabel(account)}
      </span>
    </span>
  );
}
export function AccountBanner({
  account,
  institutions = [],
  children,
}: {
  account: Account;
  institutions?: Institution[];
  children?: ReactNode;
}) {
  const brand = accountBrand(account, institutions);
  return (
    <section
      className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/6 bg-white p-5"
      style={{
        backgroundImage: brand.tint
          ? `linear-gradient(120deg, ${brand.color}18, transparent 95%)`
          : undefined,
      }}
    >
      <div>
        <p className="font-semibold">
          <AccountIdentity
            account={account}
            institutions={institutions}
            compact={false}
          />
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {brand.name || "Your account"}
        </p>
      </div>
      {children}
    </section>
  );
}
