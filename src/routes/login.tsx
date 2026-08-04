import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-[calc(100dvh-var(--grok-banner-h,0px))] place-items-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">PlayIQ</p>
          <h1 className="mt-1 text-xl font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Coaches and staff — use your Google or X account.</p>
        </div>
        {authEnabled ? (
          <div className="space-y-2">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                className="w-full rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface"
              >
                Continue with {p.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
        <Link to="/" className="block text-center text-sm text-muted hover:text-ink">
          Back home
        </Link>
      </div>
    </main>
  );
}
