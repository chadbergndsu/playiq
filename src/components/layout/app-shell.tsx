import { Link, useRouterState } from "@tanstack/react-router";
import {
  Clapperboard,
  Film,
  LayoutDashboard,
  Library,
  Scissors,
  Sparkles,
} from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NavItem = {
  to: "/app" | "/app/library" | "/app/cutups" | "/app/insights";
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const nav: NavItem[] = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/app/library", label: "Film library", icon: Library },
  { to: "/app/cutups", label: "Cutups", icon: Scissors },
  { to: "/app/insights", label: "Insights", icon: Sparkles },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();

  return (
    <div className="min-h-[calc(100dvh-var(--grok-banner-h,0px))] bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
          <Link to="/app" className="flex items-center gap-2.5 focus-ring rounded-sm">
            <span className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] bg-fg text-bg">
              <Clapperboard className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">PlayIQ</span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {nav.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-[var(--radius-sm)] px-3 text-sm font-medium transition-colors focus-ring",
                    active
                      ? "bg-bg-subtle text-fg"
                      : "text-fg-muted hover:bg-bg-subtle/70 hover:text-fg",
                  )}
                >
                  <Icon className="h-4 w-4 opacity-80" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link to="/app/library" className="hidden sm:block">
              <Button variant="secondary" size="sm">
                <Film className="h-4 w-4" />
                Open library
              </Button>
            </Link>
            {isPending ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-bg-subtle" />
            ) : user ? (
              <SignedIn>
                <UserButton />
              </SignedIn>
            ) : (
              <SignedOut>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
              </SignedOut>
            )}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 md:hidden">
          {nav.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
                  active ? "bg-bg-subtle text-fg" : "text-fg-muted",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
