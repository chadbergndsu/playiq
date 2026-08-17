import { Navigate, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isParent } from "@/lib/core/roles";
import { getSchoolUnlock } from "@/lib/school/school-client";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onRoster = pathname === "/app/roster" || pathname.startsWith("/app/roster/");
  const [schoolReady, setSchoolReady] = useState<boolean | null>(null);

  useEffect(() => {
    setSchoolReady(getSchoolUnlock().unlocked);
  }, []);

  if (schoolReady === false) {
    return <Navigate to="/join" />;
  }

  // Parents may view roster/schedule; other /app routes go to the stub.
  if (!isPending && user && isParent(user.role) && !onRoster) {
    return <Navigate to="/parent" />;
  }

  if (schoolReady === null) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-sm text-fg-muted">
        Loading school workspace…
      </div>
    );
  }

  return (
    <AppShell>
      {!isPending && user && user.role === null ? (
        <div className="mb-4 rounded-[var(--radius-md)] border border-border bg-bg-subtle px-4 py-3 text-sm text-fg-muted">
          Signed in as <span className="text-fg">{user.primaryEmail ?? user.id}</span> — no
          team role yet. Ask an admin to invite this email on the Team page.
        </div>
      ) : null}
      <Outlet />
    </AppShell>
  );
}
