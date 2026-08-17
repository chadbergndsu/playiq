import { createFileRoute, Link } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { ROLE_LABELS, TEAM_ROLES } from "@/lib/core/roles";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-[calc(100dvh-var(--grok-banner-h,0px))] place-items-center bg-bg p-6 text-fg">
      <div className="panel w-full max-w-sm space-y-5 p-6 sm:p-7">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] bg-fg text-bg">
            <Clapperboard className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
              PlayIQ
            </p>
            <h1 className="text-lg font-semibold tracking-tight">Staff sign in</h1>
          </div>
        </div>
        <p className="text-sm text-fg-muted">
          Continue with Google or X. Your role (admin, head coach, coach) comes from an
          admin invite on your email — you do not pick it here.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TEAM_ROLES.map((r) => (
            <span
              key={r}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-fg-muted"
            >
              {ROLE_LABELS[r]}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-fg-subtle">
          Parents: use the teach-reel share link a coach sends you — no staff login needed.
        </p>
        {authEnabled ? (
          <div className="space-y-2">
            {GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => signIn(p.providerId, { callbackURL: "/app" })}
              >
                Continue with {p.label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-fg-muted">Sign-in is disabled in this environment.</p>
        )}
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Link to="/app" className="text-center text-sm text-fg-muted hover:text-fg">
            Continue to film room without account
          </Link>
          <Link to="/" className="text-center text-sm text-fg-subtle hover:text-fg">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
