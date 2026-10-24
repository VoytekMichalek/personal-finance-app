import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { type Person } from "@finance/shared";
import { useSnapshot } from "../hooks/data";
import { api } from "../lib/api";
import { cn } from "../components/ui/button";
import {
  Card,
  PageHeading,
  Loading,
  ErrorState,
} from "../components/common/primitives";
import { Users } from "../components/settings/Users";
import { Attribution } from "../components/common/Layout";
import { useAiSettings } from "../hooks/ai-settings";
import { AiSettings } from "../components/settings/AiSettings";
type Metadata = {
  version: string;
  releaseTag: string;
  buildCommit: string;
  buildTime: string;
};
export function SettingsPage({ user }: { user: Person }) {
  const snapshot = useSnapshot();
  const { status: integrations } = useAiSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = location.pathname.split("/")[2] ?? "system";
  const system = useQuery({
    queryKey: ["system"],
    queryFn: () => api<Metadata>("/system"),
  });
  if (snapshot.isPending) return <Loading />;
  if (snapshot.error)
    return (
      <ErrorState
        message={snapshot.error.message}
        retry={() => void snapshot.refetch()}
      />
    );
  const tabs = [
    ...(user.role === "admin" ? [["users", "Users"]] : []),
    ["system", "System"],
    ["ai", "AI"],
  ];
  return (
    <>
      <PageHeading
        eyebrow="Just the essentials"
        title="Make yourself at home."
        description="Your people, preferences and the details behind your app."
      />
      <div className="mb-7 flex flex-wrap gap-1 border-b pb-3">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => navigate("/settings/" + id)}
            className={cn(
              "rounded-lg px-4 py-2.5 text-xs font-medium",
              tab === id ? "bg-white shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "users" && user.role === "admin" ? (
        <Users />
      ) : tab === "ai" ? (
        <AiSettings admin={user.role === "admin"} />
      ) : (
        <Card>
          <h2 className="mb-5 font-semibold">A few useful details</h2>
          {system.isPending ? (
            <Loading />
          ) : system.error ? (
            <ErrorState
              message={system.error.message}
              retry={() => void system.refetch()}
            />
          ) : (
            system.data && (
              <dl className="divide-y">
                {[
                  ["Version", system.data.version],
                  ["Release Tag", system.data.releaseTag],
                  ["Build Commit", system.data.buildCommit],
                  ["Build Time", system.data.buildTime],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[110px_1fr] gap-4 py-4 text-xs sm:grid-cols-[160px_1fr]"
                  >
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="break-all font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            )
          )}
          <p className="mt-5 text-xs text-muted-foreground">
            Private receipts · Cloudflare R2:{" "}
            {integrations.data?.r2Configured
              ? "Configured"
              : integrations.isPending
                ? "Checking…"
                : "Setup needed"}
          </p>
          <p className="mt-5 text-xs text-muted-foreground">
            These details identify the app build when you need support.
          </p>
        </Card>
      )}
      <div className="mt-8 max-w-sm lg:hidden">
        <Link to="/assets" className="mb-4 block text-sm text-primary">
          Assets & Liabilities →
        </Link>
        <Attribution />
      </div>
    </>
  );
}
