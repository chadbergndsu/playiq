import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Clapperboard,
  Scissors,
  Sparkles,
  Timer,
} from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { FilmCard } from "@/components/film/film-card";
import { Button } from "@/components/ui/button";
import { averageAiConfidence, countAiTags } from "@/lib/core/tagging";
import { groupPlaysBySide, topConcepts } from "@/lib/core/cutups";
import { formatGameDate, nextGame } from "@/lib/core/schedule";
import { YOUTH_TEAM_LABEL } from "@/lib/core/youth-tags";
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
  const loadProductDemo = usePlayiqStore((s) => s.loadProductDemo);
  const createTeachThisWeekCutup = usePlayiqStore((s) => s.createTeachThisWeekCutup);

  const upcoming = useMemo(() => nextGame(), []);

  const stats = useMemo(() => {
    const allPlays = Object.values(playsByFilm).flat();
    const practice = films.filter((f) => f.id.startsWith("film_train_")).length;
    const games = films.filter((f) => f.id.startsWith("film_sched_")).length;
    const ready = films.filter((f) => f.status === "ready" || f.status === "needs_review").length;
    const sides = groupPlaysBySide(allPlays);
    const concepts = topConcepts(allPlays, 4);
    return {
      films: films.length,
      practice,
      games,
      ready,
      plays: allPlays.length,
      aiTags: countAiTags(allPlays),
      avgConf: averageAiConfidence(allPlays),
      sides,
      concepts,
      cutups: cutups.length,
      starred: allPlays.filter((p) => p.starred).length,
    };
  }, [films, playsByFilm, cutups]);

  const recent = [...films]
    .filter((f) => f.playCount > 0 && f.status !== "processing")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
            {YOUTH_TEAM_LABEL}
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Film room
          </h1>
          <p className="mt-2 max-w-xl text-sm text-fg-muted sm:text-base">
            Phone clips → honest tags → teach reel. Two families: dies in the box vs bounce
            to the bench. White = 4th · Maroon = 3rd.
          </p>
          {upcoming && (
            <p className="mt-3 text-sm text-fg">
              Next up:{" "}
              <Link to="/app/roster" className="font-medium underline-offset-2 hover:underline">
                vs {upcoming.opponent}
              </Link>
              {" · "}
              {formatGameDate(upcoming.date)}
              {upcoming.time ? ` · ${upcoming.time}` : ""}
              {" · "}
              {upcoming.kind === "home" ? "Home" : upcoming.kind === "away" ? "Away" : upcoming.location}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              const id = createTeachThisWeekCutup();
              if (!id) {
                toast.message("Star plays first", {
                  description: "Star teach plays in the film room, then build this week’s reel.",
                });
                return;
              }
              toast.success("Teach reel ready", {
                description: "Open Cutups to share with assistants.",
              });
            }}
          >
            Teach this week
            <Scissors className="h-4 w-4" />
          </Button>
          <Link to="/app/library">
            <Button variant="secondary">
              Open library
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Button type="button" variant="ghost" size="sm" onClick={() => resetDemo()}>
            Reset library data
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              loadProductDemo();
              toast.message("Product demo loaded");
            }}
          >
            Load product demo
          </Button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Clips & games",
            value: String(stats.films),
            meta: `${stats.practice} practice · ${stats.games} schedule shells`,
            icon: Clapperboard,
          },
          {
            label: "Plays tagged",
            value: String(stats.plays),
            meta: `${stats.starred} starred · ${stats.aiTags} AI tags`,
            icon: Sparkles,
          },
          {
            label: "Teach cutups",
            value: String(stats.cutups),
            meta: "Box · bounce · WR unused",
            icon: Scissors,
          },
          {
            label: "Side split",
            value: `${stats.sides.offense}/${stats.sides.defense}`,
            meta: `${stats.sides.special} special · avg AI ${stats.avgConf ?? "—"}`,
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
            <h2 className="text-sm font-semibold">Recent film with plays</h2>
            <Link to="/app/library" className="text-xs text-fg-muted hover:text-fg">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="panel p-6 text-sm text-fg-muted">
              No tagged clips yet — open the library to review practice film.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {recent.map((f) => (
                <FilmCard key={f.id} film={f} />
              ))}
            </div>
          )}
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
