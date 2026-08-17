import { createFileRoute, Link } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/parent")({
  component: ParentStubPage,
});

/**
 * Parent role stub — share links remain the parent surface for this season.
 * Invited parents who sign in land here instead of the film room.
 */
function ParentStubPage() {
  return (
    <main className="grid min-h-[calc(100dvh-var(--grok-banner-h,0px))] place-items-center bg-bg p-6 text-fg">
      <div className="panel w-full max-w-md space-y-5 p-6 sm:p-8">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] bg-fg text-bg">
            <Clapperboard className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
              PlayIQ
            </p>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Parent access
            </h1>
          </div>
        </div>
        <p className="text-sm text-fg-muted">
          The film room is for coaches this season. When a coach publishes a teach reel,
          open the <strong className="font-medium text-fg">share link</strong> they send
          you — no staff login required.
        </p>
        <p className="text-sm text-fg-muted">
          Roster and schedule are available for reference. Tagging and uploads stay with
          the coaching staff.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/roster">
            <Button variant="primary">View roster &amp; schedule</Button>
          </Link>
          <Link to="/">
            <Button variant="ghost">Home</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
