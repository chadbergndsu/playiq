import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Clapperboard,
  Scissors,
  Sparkles,
  Timer,
} from "lucide-react";
import { useMemo } from "react";
import { FilmCard } from "@/components/film/film-card";
import { Button } from "@/components/ui/button";
import { averageAiConfidence, countAiTags } from "@/lib/core/tagging";
import { groupPlaysBySide, topConcepts } from "@/lib/core/cutups";
import { usePlayiqStore } from "@/lib/store/playiq-store";
import { plural } from "@/lib/utils";

export const Route = createFileRoute("/app/")({
  component: OverviewPage,
});

function OverviewPage() {
  const films = usePlayiqStore((s) => s.films);
  const playsByFilm = usePlayiqStore((s) => s.playsByFilm);
  const cutups = usePlayiqStore((s) => s.cutups);
  const resetDemo = usePlayiqStore((s) => s.resetDemo);

  const stats = useMemo(() => {
    const allPlays = Object.values(playsByFilm).flat();
    const ready = films.filter((f) => f.status === "ready").length;
    const processing = films.filter((f) => f.status === "processing").length;
    const sides = groupPlaysBySide(allPlays);
    const concepts = topConcepts(allPlays, 4);
    return {
      films: films.length,
      ready,
      processing,
      plays: allPlays.length,
      aiTags: countAiTags(allPlays),
      avgConf: averageAiConfidence(allPlays),
      sides,
      concepts,
      cutups: cutups.length,
    };
  }, [films, playsByFilm, cutups]);

  const recent = [...films]
    .filter((f) => f.status !== "processing")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
            Film room
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Overview
          </h1>
          <p className="mt-2 max-w-xl text-sm text-fg-muted sm:text-base">
            AI-first tagging for varsity film. Review auto-tags, build cutups, teach faster.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/library">
            <Button variant="primary">
              Open library
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Button type="button" variant="ghost" size="sm" onClick={() => resetDemo()}>
            Reset demo data
          </Button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Games in library",
            value: String(stats.films),
            meta: `${stats.ready} ready · ${stats.processing} analyzing`,
            icon: Clapperboard,
          },
          {
            label: "Plays tagged",
            value: String(stats.plays),
            meta: `${stats.aiTags} AI tags · avg conf ${stats.avgConf ?? "—"}`,
            icon: Sparkles,
          },
          {
            label: "Cutups",
            value: String(stats.cutups),
            meta: "Teach reels ready to share",
            icon: Scissors,
          },
          {
            label: "Side split",
            value: `${stats.sides.offense}/${stats.sides.defense}`,
            meta: `${stats.sides.special} special teams plays`,
            icon: Timer,
          },
        ].map((card) => (
          <article key={card.label} className="panel p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                {card.label}
              </p>
              <card.icon className="h-4 w-4 text-fg-subtle" />
            </div>
            <p className="mt-3 font-display text-3xl font-semibold tabular">{card.value}</p>
            <p className="mt-1 text-xs text-fg-muted">{card.meta}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent film</h2>
            <Link to="/app/library" className="text-xs text-fg-muted hover:text-fg">
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {recent.map((f) => (
              <FilmCard key={f.id} film={f} />
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-sm font-semibold">Top concepts (AI + coach)</h2>
          <ul className="mt-4 space-y-3">
            {stats.concepts.map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-3 text-sm">
                <span>{c.label}</span>
                <span className="tabular text-fg-muted">{plural(c.count, "play")}</span>
              </li>
            ))}
            {stats.concepts.length === 0 && (
              <li className="text-sm text-fg-muted">No concepts yet.</li>
            )}
          </ul>
          <Link to="/app/insights" className="mt-6 inline-flex text-sm text-fg-muted hover:text-fg">
            Full insights →
          </Link>
        </div>
      </section>
    </div>
  );
}
