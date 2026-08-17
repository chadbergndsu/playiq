import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ROSTER_LABEL, searchRoster } from "@/lib/core/roster";
import {
  SCHEDULE_LABEL,
  TEAM_SCHEDULE,
  formatGameDate,
  nextGame,
} from "@/lib/core/schedule";
import { getSchoolUnlock } from "@/lib/school/school-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/roster")({
  component: RosterPage,
});

const kindLabel: Record<string, string> = {
  home: "Home",
  away: "Away",
  neutral: "Neutral",
  bye: "Bye",
  playoff: "Playoff",
};

function RosterPage() {
  const [q, setQ] = useState("");
  const players = useMemo(() => searchRoster(q), [q]);
  const upcoming = nextGame();
  const schoolName =
    (typeof window !== "undefined" && getSchoolUnlock().school?.name) || "Your school";

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-fg-subtle">
        School workspace
      </p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
        {schoolName}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-fg-muted">
        Roster and schedule stay empty in the public product. Add players and games in your
        private deploy, or tag jersey numbers directly in the film room.
      </p>

      {upcoming ? (
        <div className="mt-6 rounded-[var(--radius-md)] border border-border bg-bg-elevated px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Next game
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight">
            {upcoming.opponent}
            <span className="ml-2 text-base font-medium text-fg-muted">
              {formatGameDate(upcoming.date)}
              {upcoming.time ? ` · ${upcoming.time}` : ""}
            </span>
          </p>
          <p className="text-sm text-fg-muted">{upcoming.location}</p>
        </div>
      ) : null}

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Schedule</h2>
        <div className="mt-4 overflow-hidden rounded-[var(--radius-md)] border border-border bg-bg-elevated">
          {TEAM_SCHEDULE.length === 0 ? (
            <p className="px-4 py-8 text-sm text-fg-muted">
              No schedule loaded. Upload film from the{" "}
              <Link to="/app/library" className="underline hover:text-fg">
                library
              </Link>{" "}
              when you are ready.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-bg-subtle text-xs uppercase tracking-wider text-fg-subtle">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Opponent</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Where</th>
                  <th className="px-4 py-2.5 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {TEAM_SCHEDULE.map((g) => {
                  const isNext = upcoming?.id === g.id;
                  return (
                    <tr
                      key={g.id}
                      className={cn(
                        "border-b border-border/70 last:border-0",
                        isNext && "bg-bg-subtle",
                        g.kind === "bye" && "text-fg-subtle",
                      )}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                        {formatGameDate(g.date)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{g.opponent}</span>
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-fg-subtle">
                          {kindLabel[g.kind]}
                        </span>
                      </td>
                      <td className="hidden px-4 py-2.5 text-fg-muted sm:table-cell">
                        {g.location}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-fg-muted">
                        {g.time ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-2 text-xs text-fg-subtle">{SCHEDULE_LABEL}</p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Roster</h2>
        <div className="mt-4">
          <label className="relative block max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search number…"
              className="pl-9"
              aria-label="Search roster"
            />
          </label>

          <div className="mt-4 overflow-hidden rounded-[var(--radius-md)] border border-border bg-bg-elevated">
            {players.length === 0 ? (
              <p className="px-4 py-8 text-sm text-fg-muted">
                {ROSTER_LABEL} is empty in this build. Tag jersey numbers on plays when you
                know them — no student names are stored in the public repository.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-bg-subtle text-xs uppercase tracking-wider text-fg-subtle">
                  <tr>
                    <th className="w-16 px-4 py-2.5 font-medium">#</th>
                    <th className="px-4 py-2.5 font-medium">Player</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => (
                    <tr key={p.number} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-2.5 tabular-nums font-medium">{p.number}</td>
                      <td className="px-4 py-2.5">
                        {p.first} {p.last}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
