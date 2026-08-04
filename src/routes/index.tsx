import { createFileRoute, Link } from "@tanstack/react-router";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();

  return (
    <div className="min-h-[calc(100dvh-var(--grok-banner-h,0px))]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            PI
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">PlayIQ</p>
            <p className="text-xs text-muted">Film · tags · teach</p>
          </div>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <a href="/api/health" className="text-muted hover:text-ink">
            Health
          </a>
          {isPending ? (
            <div className="h-8 w-20 animate-pulse rounded-full bg-black/10" />
          ) : user ? (
            <SignedIn>
              <UserButton />
            </SignedIn>
          ) : (
            <SignedOut>
              <Link
                to="/login"
                className="rounded-full bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
              >
                Sign in
              </Link>
            </SignedOut>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-16 pt-8">
        <section className="rounded-3xl border border-line bg-card/90 p-8 shadow-sm backdrop-blur md:p-12">
          <p className="mb-3 inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
            Solid Systems baseline · ready for product work
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            AI-first football film analysis for coaches who want speed, not busywork.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
            PlayIQ is scaffolding under Solid Systems Standards: private repo, CI, TypeScript,
            tests, and Git-connected Vercel deploys. Product features come next.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-black"
            >
              Open sign-in
            </Link>
            <a
              href="/api/health"
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-medium text-ink hover:bg-surface"
            >
              Check health endpoint
            </a>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Baseline", "README, CI, lint, typecheck, tests, env example, Dependabot."],
            ["Auth", "Real Better Auth (Google / X) via Grok broker — no mock users."],
            ["Deploy", "Vercel default. Push to main → build from Git."],
          ].map(([title, body]) => (
            <article
              key={title}
              className="rounded-2xl border border-line bg-card p-5 shadow-sm"
            >
              <h2 className="text-sm font-semibold text-ink">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
