import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, Link2, Scissors, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cutupDurationSec } from "@/lib/core/cutups";
import {
  buildCutupShareSnapshot,
  exportCutupCsv,
  exportCutupJson,
} from "@/lib/core/export";
import { usePlayiqStore } from "@/lib/store/playiq-store";
import { formatClock, plural } from "@/lib/utils";

export const Route = createFileRoute("/app/cutups")({
  component: CutupsPage,
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

function CutupsPage() {
  const navigate = useNavigate();
  const cutups = usePlayiqStore((s) => s.cutups);
  const playsByFilm = usePlayiqStore((s) => s.playsByFilm);
  const films = usePlayiqStore((s) => s.films);
  const deleteCutup = usePlayiqStore((s) => s.deleteCutup);
  const ensureCutupShareToken = usePlayiqStore((s) => s.ensureCutupShareToken);
  const createInstallCutupFromStars = usePlayiqStore((s) => s.createInstallCutupFromStars);
  const allPlays = Object.values(playsByFilm).flat();
  const starredCount = allPlays.filter((p) => p.starred).length;

  async function shareCutup(cutupId: string) {
    const cut = cutups.find((c) => c.id === cutupId);
    if (!cut) return;
    const token = ensureCutupShareToken(cutupId);
    if (!token) return;
    const latest = usePlayiqStore.getState().cutups.find((c) => c.id === cutupId) ?? {
      ...cut,
      shareToken: token,
    };
    const snapshot = buildCutupShareSnapshot({
      token,
      cutup: latest,
      plays: allPlays,
      films,
    });
    try {
      const res = await fetch("/api/share/cutup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Share failed (${res.status})`);
      }
      const url = `${window.location.origin}/share/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied", { description: url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Share failed";
      toast.message("Could not publish share", { description: msg });
    }
  }

  function exportOne(cutupId: string, format: "csv" | "json") {
    const cut = cutups.find((c) => c.id === cutupId);
    if (!cut) return;
    const token = cut.shareToken ?? ensureCutupShareToken(cutupId) ?? "export";
    const snapshot = buildCutupShareSnapshot({
      token,
      cutup: cut,
      plays: allPlays,
      films,
    });
    const base = cut.title.replace(/\s+/g, "_").slice(0, 40);
    if (format === "csv") {
      downloadText(`${base}.csv`, exportCutupCsv(snapshot), "text/csv");
    } else {
      downloadText(`${base}.json`, exportCutupJson(snapshot), "application/json");
    }
    toast.message(`Exported ${format.toUpperCase()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Teach</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Cutups</h1>
          <p className="mt-2 max-w-lg text-sm text-fg-muted">
            Teach reels with auto-advance playback, share links, and export. Open a cutup for
            the film-room player (Space · J/K · auto-advance · loop).
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={starredCount === 0}
          onClick={() => {
            const id = createInstallCutupFromStars();
            if (!id) {
              toast.message("No starred plays", {
                description: "Star plays in film review (S key), then build install.",
              });
              return;
            }
            toast.success("Install cutup created", {
              description: `${starredCount} starred play(s) — open teach reel`,
            });
            void navigate({ to: "/app/cutups/$cutupId", params: { cutupId: id } });
          }}
        >
          <Star className="h-4 w-4" />
          Install from stars{starredCount > 0 ? ` (${starredCount})` : ""}
        </Button>
      </div>

      {cutups.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 p-12 text-center">
          <Scissors className="h-8 w-8 text-fg-subtle" />
          <p className="text-sm text-fg-muted">No cutups yet. Save one from a film review.</p>
          <Link to="/app/library">
            <Button variant="secondary">Browse film</Button>
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {cutups.map((c) => {
            const dur = cutupDurationSec(allPlays, c.playIds);
            return (
              <li key={c.id} className="panel flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">{c.title}</h2>
                    <p className="mt-1 text-sm text-fg-muted">
                      {c.description || c.filterSummary}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-[var(--radius-sm)] p-2 text-fg-subtle hover:bg-bg-subtle hover:text-fg focus-ring"
                    aria-label={`Delete ${c.title}`}
                    onClick={() => {
                      deleteCutup(c.id);
                      toast.message("Cutup removed");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-fg-subtle">
                  <span>{plural(c.playIds.length, "play")}</span>
                  <span>{formatClock(dur)} runtime</span>
                  <span>{c.filterSummary}</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link to="/app/cutups/$cutupId" params={{ cutupId: c.id }}>
                    <Button variant="secondary" size="sm">
                      Open cutup
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void shareCutup(c.id)}
                  >
                    <Link2 className="h-4 w-4" />
                    Share link
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => exportOne(c.id, "csv")}
                  >
                    <Download className="h-4 w-4" />
                    CSV
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
