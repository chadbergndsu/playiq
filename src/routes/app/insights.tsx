import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { averageAiConfidence, countAiTags } from "@/lib/core/tagging";
import { groupPlaysBySide, topConcepts } from "@/lib/core/cutups";
import {
  countByTagCategory,
  downDistanceMatrix,
  explosiveRate,
  thirdDownConversion,
} from "@/lib/core/tendencies";
import { usePlayiqStore } from "@/lib/store/playiq-store";

export const Route = createFileRoute("/app/insights")({
  component: InsightsPage,
});

function InsightsPage() {
  const films = usePlayiqStore((s) => s.films);
  const playsByFilm = usePlayiqStore((s) => s.playsByFilm);

  const data = useMemo(() => {
    const all = Object.values(playsByFilm).flat();
    const byWeek = films
      .slice()
      .sort((a, b) => a.week - b.week)
      .map((f) => {
        const plays = playsByFilm[f.id] ?? [];
        const explosive = plays.filter((p) =>
          p.tags.some((t) => t.label.toLowerCase() === "explosive"),
        ).length;
        const third = plays.filter((p) => p.down === 3).length;
        return {
          name: `W${f.week}`,
          plays: plays.length,
          explosive,
          thirdDown: third,
          tags: plays.reduce((n, p) => n + p.tags.length, 0),
        };
      });

    const third = thirdDownConversion(all);
    const explosive = explosiveRate(all);
    return {
      all,
      byWeek,
      sides: groupPlaysBySide(all),
      concepts: topConcepts(all, 8),
      formations: countByTagCategory(all, "formation", 8),
      personnel: countByTagCategory(all, "personnel", 6),
      matrix: downDistanceMatrix(all, "offense"),
      third,
      explosive,
      aiTags: countAiTags(all),
      avgConf: averageAiConfidence(all),
      redZone: all.filter((p) => p.tags.some((t) => t.label === "Red zone")).length,
      thirdLong: all.filter((p) => p.tags.some((t) => t.label === "3rd & long")).length,
      starred: all.filter((p) => p.starred).length,
    };
  }, [films, playsByFilm]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Analytics</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Insights</h1>
        <p className="mt-2 max-w-lg text-sm text-fg-muted">
          Tendency reports from tagged film — formations, 3rd-down conversion proxy, and
          down-distance matrix (Hudl Assist–style snapshot). Updates as you correct AI tags.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "AI tags", value: data.aiTags, meta: `Avg confidence ${data.avgConf ?? "—"}` },
          {
            label: "3rd down conv.",
            value:
              data.third.rate == null ? "—" : `${data.third.rate}%`,
            meta: `${data.third.conversions}/${data.third.attempts} offense`,
          },
          {
            label: "Explosive rate",
            value: data.explosive.rate == null ? "—" : `${data.explosive.rate}%`,
            meta: `${data.explosive.explosive} of ${data.explosive.total} off plays`,
          },
          {
            label: "Starred plays",
            value: data.starred,
            meta: "Install bookmarks",
          },
        ].map((c) => (
          <article key={c.label} className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-fg-subtle">{c.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold tabular">{c.value}</p>
            <p className="mt-1 text-xs text-fg-muted">{c.meta}</p>
          </article>
        ))}
      </section>

      <section className="panel p-4 sm:p-6">
        <h2 className="text-sm font-semibold">Plays & explosives by week</h2>
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.byWeek} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--color-fg-subtle)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--color-fg-subtle)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  color: "var(--color-fg)",
                }}
              />
              <Bar dataKey="plays" fill="var(--color-fg-muted)" radius={[4, 4, 0, 0]} name="Plays" />
              <Bar
                dataKey="explosive"
                fill="var(--color-accent)"
                radius={[4, 4, 0, 0]}
                name="Explosive"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-sm font-semibold">Concept frequency</h2>
          <ul className="mt-4 space-y-2">
            {data.concepts.map((c) => {
              const max = data.concepts[0]?.count ?? 1;
              const pct = Math.round((c.count / max) * 100);
              return (
                <li key={c.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{c.label}</span>
                    <span className="tabular text-fg-muted">{c.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-bg-subtle">
                    <div className="h-full rounded-full bg-fg/40" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel p-5">
          <h2 className="text-sm font-semibold">Formation tendencies</h2>
          <ul className="mt-4 space-y-2">
            {data.formations.length === 0 && (
              <li className="text-sm text-fg-muted">No formation tags yet.</li>
            )}
            {data.formations.map((c) => {
              const max = data.formations[0]?.count ?? 1;
              const pct = Math.round((c.count / max) * 100);
              return (
                <li key={c.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{c.label}</span>
                    <span className="tabular text-fg-muted">{c.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-bg-subtle">
                    <div className="h-full rounded-full bg-fg/30" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="panel overflow-x-auto p-5">
        <h2 className="text-sm font-semibold">Offense down × distance</h2>
        <p className="mt-1 text-xs text-fg-muted">
          Short ≤3 · medium 4–6 · long 7+ yards to go. Avg yards gained per bucket.
        </p>
        <table className="mt-4 w-full min-w-[28rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-fg-subtle">
              <th className="py-2 pr-3 font-medium">Down</th>
              <th className="py-2 pr-3 font-medium">Distance</th>
              <th className="py-2 pr-3 font-medium">Plays</th>
              <th className="py-2 font-medium">Avg yards</th>
            </tr>
          </thead>
          <tbody>
            {data.matrix.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-fg-muted">
                  No down/distance data.
                </td>
              </tr>
            )}
            {data.matrix.map((row) => (
              <tr
                key={`${row.down}-${row.distanceBand}`}
                className="border-b border-border/60"
              >
                <td className="py-2 pr-3 tabular">{row.down}</td>
                <td className="py-2 pr-3 capitalize text-fg-muted">{row.distanceBand}</td>
                <td className="py-2 pr-3 tabular">{row.count}</td>
                <td className="py-2 tabular">{row.avgYards ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
