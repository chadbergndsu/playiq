import { Link, createFileRoute } from "@tanstack/react-router";
import { Clapperboard, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CutupShareSnapshot } from "@/lib/core/types";
import { exportCutupCsv, exportCutupJson } from "@/lib/core/export";
import { formatClock, formatYards, plural } from "@/lib/utils";

export const Route = createFileRoute("/share/$token")({
  component: PublicSharePage,
});

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function PublicSharePage() {
  const { token } = Route.useParams();
  const [snap, setSnap] = useState<CutupShareSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/share/cutup?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || `Share not found (${res.status})`);
        }
        const data = (await res.json()) as CutupShareSnapshot;
        if (!cancelled) setSnap(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load share");
          setSnap(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-[calc(100dvh-var(--grok-banner-h,0px))] bg-bg text-fg">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 focus-ring rounded-sm">
            <span className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] bg-fg text-bg">
              <Clapperboard className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-semibold">PlayIQ</span>
          </Link>
          <Link to="/app">
            <Button variant="secondary" size="sm">
              Open film room
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {loading && (
          <p className="text-sm text-fg-muted">Loading shared cutup…</p>
        )}
        {error && (
          <div className="panel p-8 text-center">
            <p className="text-sm text-fg-muted">{error}</p>
            <p className="mt-2 text-xs text-fg-subtle">
              Shares are created from the Cutups page (Share link).
            </p>
          </div>
        )}
        {snap && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                Shared cutup
              </p>
              <h1 className="font-display text-4xl font-semibold tracking-tight">
                {snap.title}
              </h1>
              <p className="mt-2 text-sm text-fg-muted">
                {snap.description || snap.filterSummary} ·{" "}
                {plural(snap.plays.length, "play")}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  downloadText(
                    `${snap.title.replace(/\s+/g, "_").slice(0, 40)}.csv`,
                    exportCutupCsv(snap),
                    "text/csv",
                  )
                }
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  downloadText(
                    `${snap.title.replace(/\s+/g, "_").slice(0, 40)}.json`,
                    exportCutupJson(snap),
                    "application/json",
                  )
                }
              >
                Export JSON
              </Button>
            </div>

            <ul className="panel divide-y divide-border overflow-hidden">
              {snap.plays.map((p) => (
                <li key={p.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {p.filmTitle} · Play {p.index}
                      </p>
                      <p className="mt-0.5 text-xs capitalize text-fg-muted">
                        {p.side}
                        {p.down != null ? ` · ${p.down}&${p.distance}` : ""} · Q
                        {p.quarter} {p.clock}
                        {p.yardLine != null ? ` · ball ${p.yardLine}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-fg-subtle">
                        {p.tags.map((t) => t.label).join(" · ") || "No tags"}
                      </p>
                      {p.notes && (
                        <p className="mt-1 text-xs text-fg-muted">{p.notes}</p>
                      )}
                    </div>
                    <div className="text-right text-xs text-fg-subtle">
                      {p.yardsGained != null && (
                        <p className="tabular text-fg">{formatYards(p.yardsGained)}</p>
                      )}
                      <p className="tabular">
                        {formatClock(p.endSec - p.startSec)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
