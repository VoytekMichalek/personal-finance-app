import { useState } from "react";
import {
  Banknote,
  CreditCard,
  Landmark,
  PiggyBank,
  Wallet,
} from "lucide-react";
import type { accountBrand } from "@finance/shared";

const icons = {
  landmark: Landmark,
  wallet: Wallet,
  banknote: Banknote,
  "piggy-bank": PiggyBank,
  "credit-card": CreditCard,
};
export function InstitutionLogo({
  brand,
  small = false,
}: {
  brand: ReturnType<typeof accountBrand>;
  small?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const Icon = icons[brand.icon];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-white text-slate-600 ${small ? "size-6 rounded-md" : "size-11 rounded-xl shadow-sm"}`}
    >
      {brand.logo && brand.logo !== failed ? (
        <img
          src={brand.logo}
          alt={`${brand.name || "Custom"} logo`}
          className={
            small ? "max-h-5 w-5 object-contain" : "max-h-8 w-9 object-contain"
          }
          onError={() => setFailed(brand.logo)}
        />
      ) : (
        <Icon size={small ? 15 : 22} aria-hidden="true" />
      )}
    </span>
  );
}
