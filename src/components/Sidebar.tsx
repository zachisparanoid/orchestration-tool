"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, GitBranch, Activity, Sparkles, Home, Zap } from "lucide-react";
import { cn } from "@/lib/cn";

const links = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/agents", label: "Agents", icon: Boxes },
  { href: "/workflows", label: "Workflows", icon: GitBranch },
  { href: "/quick-run", label: "Quick Run", icon: Zap },
  { href: "/runs", label: "Runs", icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 border-r border-border-subtle bg-bg-surface/60 backdrop-blur">
      <div className="sticky top-0 flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-accent to-status-paused text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-text-primary">Orchestrator</div>
            <div className="text-[10px] uppercase tracking-wide text-text-muted">100+ Agent Fleet</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-accent-subtle text-text-primary"
                    : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border-subtle p-3 text-[11px] text-text-muted">
          <div>v0.1.0 · Local</div>
        </div>
      </div>
    </aside>
  );
}
