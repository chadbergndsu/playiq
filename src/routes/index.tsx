import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Clapperboard,
  Scissors,
  Shield,
  Sparkles,
  Timer,
} from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { user, isPending } = useCurrentUserState();

  return (
    <div className="min-h-[calc(100dvh-var(--grok-banner-h,0px))] bg-bg text-fg">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] bg-fg text-bg">
            <Clapperboard className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">PlayIQ</p>
            <p className="text-xs text-fg-muted">AI film for football coaches</p>
          </div>
        </div>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/app"
            className="hidden text-sm text-fg-muted hover:text-fg sm:inline focus-ring rounded-sm"
          >
            Open app
          </Link>
          {isPending ? (
            <div className="h-9 w-16 animate-pulse rounded-full bg-bg-subtle" />
          ) : user ? (
            <SignedIn>
              <UserButton />
            </SignedIn>
          ) : (
            <SignedOut>
              <Link to="/login">
                <Button variant="secondary" size="sm">
                  Sign in
                </Button>
              </Link>
            </SignedOut>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-8 sm:px-8 sm:pt-14">
        <section className="grid items-end gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-border bg-bg-elevated px-3 py-1 text-xs font-medium text-fg-muted">
              Built for Friday nights · film Monday
            </p>
            <h1 className="font-display max-w-xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Tag film in minutes, not nights.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-fg-muted sm:text-lg">
              PlayIQ is AI-first football film analysis: auto-tag formations, concepts, and
              situations, then correct with coach precision and ship teach cutups — plus an
              open exchange stack (OFP, WebVTT, FFmpeg/EDL) commercial film rooms ignore.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/app">
                <Button variant="primary" size="lg">
                  Enter film room
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/app/library">
                <Button variant="secondary" size="lg">
                  Browse demo season
                </Button>
              </Link>
            </div>
          </div>

          <div className="panel relative overflow-hidden p-5 sm:p-6">
            <div
              className="aspect-[4/3] rounded-[var(--radius-lg)] border border-border"
              style={{
                background:
                  "radial-gradient(ellipse at 40% 30%, hsl(210 12% 22%) 0%, #0a0b0d 70%)",
              }}
            >
              <div className="flex h-full flex-col justify-between p-4">
                <div className="flex justify-between text-xs text-fg-muted">
                  <span>vs Westfield · W1</span>
                  <span className="tabular">Play 18 · 2&7</span>
                </div>
                <div>
                  <p className="font-display text-3xl font-semibold">Inside zone</p>
                  <p className="mt-1 text-sm text-fg-muted">
                    AI 82% · Shotgun · 11 personnel · +6
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {["AI", "Shotgun", "Red zone"].map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-border bg-bg/60 px-2 py-0.5 text-[11px] text-fg-muted"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
              Demo library includes a full varsity season with AI first-pass tags. No upload
              required to explore the workflow.
            </p>
          </div>
        </section>

        <section className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Sparkles,
              title: "AI first pass",
              body: "Formations, concepts, situations, and explosives tagged before you open the cut.",
            },
            {
              icon: Timer,
              title: "Coach-speed review",
              body: "Playback speeds, deep filters, star plays, keyboard shortcuts — film room power tools.",
            },
            {
              icon: Scissors,
              title: "Cutups that teach",
              body: "Shareable install links, CSV/JSON export, rename and trim playlists.",
            },
            {
              icon: Shield,
              title: "Own your stack",
              body: "Solid Systems baseline: private GitHub, CI, TypeScript, Vercel deploy path.",
            },
          ].map((f) => (
            <article key={f.title} className="panel p-5">
              <f.icon className="h-4 w-4 text-fg-subtle" />
              <h2 className="mt-3 text-sm font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{f.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Where we sit vs the market
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-fg-muted">
            Hudl, QwikCut, Sportscode, and VidSwap own capture, exchange, and desktop coding.
            PlayIQ wedges on AI-first tagging and a modern coach web film room you own.
          </p>
          <div className="mt-6 overflow-x-auto rounded-[var(--radius-lg)] border border-border">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-elevated text-xs uppercase tracking-wide text-fg-subtle">
                  <th className="px-4 py-3 font-medium">Capability</th>
                  <th className="px-4 py-3 font-medium">Typical market</th>
                  <th className="px-4 py-3 font-medium">PlayIQ</th>
                </tr>
              </thead>
              <tbody className="text-fg-muted">
                {[
                  ["AI first-pass tags", "Assist add-on / slow", "Built-in (heuristics + SpaceXAI)"],
                  ["Coach tags preserved", "Varies", "Never clobbered by re-run"],
                  ["Shareable cutups", "Playlist links", "Public /share links + export"],
                  ["Tendency reports", "Assist / Sportscode", "Formations + down×distance"],
                  [
                    "Open exchange",
                    "Proprietary packages",
                    "OFP JSON · WebVTT · FFmpeg/EDL · ontology",
                  ],
                  ["Upload → analyze", "Encode pipelines", "Intake + first-pass (encode next)"],
                  ["Ownership / price", "Platform lock-in", "Your repo, Vercel, CI gates"],
                ].map(([cap, market, us]) => (
                  <tr key={cap} className="border-b border-border/70">
                    <td className="px-4 py-3 font-medium text-fg">{cap}</td>
                    <td className="px-4 py-3">{market}</td>
                    <td className="px-4 py-3 text-fg">{us}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-16 panel flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready for install meeting?
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              Jump into the demo film room — library, review, cutups, insights.
            </p>
          </div>
          <Link to="/app">
            <Button variant="primary" size="lg">
              Launch PlayIQ
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </section>
      </main>
    </div>
  );
}
