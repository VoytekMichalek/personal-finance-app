import * as Menu from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import "./sidebar.css";
import { Building2, Tags, PanelLeftClose, ChartPie } from "lucide-react";
import { Attribution } from "./Attribution";
export { Attribution } from "./Attribution";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  CalendarDays,
  ChartNoAxesCombined,
  Settings,
} from "lucide-react";
import type { Person } from "@finance/shared";
import { cn } from "../ui/button";
import { AccountMenu } from "./AccountMenu";
const items = [
  ["/", "Overview", LayoutDashboard],
  ["/transactions", "Transactions", ArrowLeftRight],
  ["/accounts", "Accounts", Wallet],
  ["/expenses", "Expenses", ChartPie],
  ["/plan", "Plan", CalendarDays],
  ["/assets", "Assets & Liabilities", Building2],
  ["/categories", "Categories", Tags],
  ["/net-worth", "Net Worth", ChartNoAxesCombined],
] as const;
export function Layout({ user }: { user: Person }) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("finance-sidebar-collapsed") === "true",
  );
  return (
    <div className="min-h-dvh">
      <aside
        aria-label="Primary navigation"
        data-collapsed={collapsed}
        className="finance-sidebar fixed inset-y-0 left-0 z-20 hidden flex-col overflow-x-hidden overflow-y-auto border-r bg-[#fbfbfa] py-3 lg:flex"
      >
        <div className="sidebar-header relative mb-4 h-10 shrink-0">
          <NavLink
            to="/"
            tabIndex={collapsed ? -1 : undefined}
            aria-hidden={collapsed}
            className="sidebar-label absolute left-2.5 top-1/2 -translate-y-1/2 whitespace-nowrap text-sm font-semibold"
          >
            Michalek Finance
          </NavLink>
          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() =>
              setCollapsed((value) => {
                localStorage.setItem(
                  "finance-sidebar-collapsed",
                  String(!value),
                );
                return !value;
              })
            }
            className="sidebar-toggle absolute top-0 flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <PanelLeftClose size={20} className="sidebar-toggle-icon" />
          </button>
        </div>
        <nav className="grid gap-0.5">
          {items.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              title={label}
              aria-label={label}
              end={to === "/" || to === "/categories"}
              to={to}
              className={({ isActive }) =>
                cn(
                  "sidebar-control rounded-xl text-[13px] font-medium",
                  isActive
                    ? "bg-[#e9eff8] text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <Icon className="sidebar-icon" size={20} strokeWidth={1.7} />
              <span
                aria-hidden={collapsed}
                className="sidebar-label sidebar-link-label"
              >
                {label}
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto grid gap-0.5">
          <NavLink
            aria-label="Settings"
            title="Settings"
            to="/settings"
            className="sidebar-control rounded-xl text-xs text-muted-foreground hover:bg-muted"
          >
            <Settings className="sidebar-icon" size={20} strokeWidth={1.7} />
            <span
              aria-hidden={collapsed}
              className="sidebar-label sidebar-link-label"
            >
              Settings
            </span>
          </NavLink>
          <div className="my-1 border-t" />
          <AccountMenu user={user} collapsed={collapsed} compact />
          <Attribution collapsed={collapsed} compact />
        </div>
      </aside>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 px-5 py-3 backdrop-blur lg:hidden">
        <NavLink to="/" className="text-sm font-semibold">
          Michalek Finance
        </NavLink>
        <div className="max-w-48">
          <AccountMenu user={user} />
        </div>
      </header>
      <main
        data-sidebar-collapsed={collapsed}
        className="finance-main"
      >
        <div className="mx-auto max-w-[1600px] px-5 py-8 pb-28 sm:px-8 lg:px-12 lg:py-12">
          <Outlet />
        </div>
      </main>
      <nav
        aria-label="Mobile navigation"
        className="fixed right-0 bottom-0 left-0 z-30 grid grid-cols-6 border-t bg-white/95 px-1 py-2 backdrop-blur lg:hidden"
      >
        {[
          ...items.filter(
            ([to]) =>
              to !== "/assets" && to !== "/categories" && to !== "/net-worth",
          ),
        ].map(([to, label, Icon]) => (
          <NavLink
            key={to}
            end={to === "/"}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-medium",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            <Icon size={19} strokeWidth={1.7} />
            {label === "Transactions"
              ? "Activity"
              : label === "Net Worth"
                ? "Wealth"
                : label}
          </NavLink>
        ))}
        <Menu.Root>
          <Menu.Trigger className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-medium text-muted-foreground">
            <Settings size={19} />
            More
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content
              side="top"
              sideOffset={12}
              className="z-50 min-w-52 rounded-2xl border bg-white p-2 shadow-xl"
            >
              {[
                ...items.filter(([to]) =>
                  ["/assets", "/categories", "/net-worth"].includes(to),
                ),
                ["/settings", "Settings", Settings] as const,
              ].map(([to, label, Icon]) => (
                <Menu.Item key={to} asChild>
                  <NavLink
                    to={to}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm outline-none focus:bg-blue-50"
                  >
                    <Icon size={18} />
                    {label}
                  </NavLink>
                </Menu.Item>
              ))}
              <div className="mt-2 border-t pt-2">
                <Attribution />
              </div>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </nav>
    </div>
  );
}
