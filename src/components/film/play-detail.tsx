import { useMemo, useState } from "react";
import { Plus, Star, X } from "lucide-react";
import type { Play, TagCategory } from "@/lib/core/types";
import { mapPlayTagsToOntology } from "@/lib/core/ontology";
import { formatJersey, rosterSortedByNumber } from "@/lib/core/roster";
import { confidenceBand } from "@/lib/core/tagging";
import { YOUTH_QUICK_TAGS } from "@/lib/core/youth-tags";
import { formatYards } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormationDiagram } from "./formation-diagram";
import { TagSourceBadge } from "./status-badge";

export function PlayDetail({
  play,
  onAddTag,
  onRemoveTag,
  onNote,
  onToggleStar,
  youthMode = true,
}: {
  play: Play;
  onAddTag: (label: string, category?: TagCategory) => void;
  onRemoveTag: (tagId: string) => void;
  onNote: (notes: string) => void;
  onToggleStar?: () => void;
  /** Show 3rd-grade quick tags + roster jersey picker */
  youthMode?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [jerseyQuery, setJerseyQuery] = useState("");
  const ontology = useMemo(() => mapPlayTagsToOntology(play.tags), [play.tags]);
  const roster = useMemo(() => rosterSortedByNumber(), []);
  const jerseyMatches = useMemo(() => {
    const q = jerseyQuery.trim().toLowerCase().replace(/^#/, "");
    if (!q) return roster.slice(0, 8);
    return roster
      .filter(
        (p) =>
          String(p.number) === q ||
          p.first.toLowerCase().includes(q) ||
          p.last.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [jerseyQuery, roster]);
  const diagramLabel =
    play.tags.find((t) => t.category === "formation")?.label ??
    play.tags.find((t) => t.category === "concept")?.label ??
    play.side;

  return (
    <div className="panel flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
            Play {play.index}
          </p>
          <h2 className="font-display text-2xl font-semibold capitalize">
            {play.side}
            {play.down != null ? (
              <span className="text-fg-muted">
                {" "}
                · {play.down}&{play.distance}
              </span>
            ) : (
              <span className="text-fg-muted"> · confirm down</span>
            )}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            Q{play.quarter} · {play.clock}
            {play.yardLine != null ? ` · Ball on ${play.yardLine}` : ""}
            {play.hash ? ` · Hash ${play.hash}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {onToggleStar && (
            <Button
              type="button"
              variant={play.starred ? "primary" : "secondary"}
              size="sm"
              onClick={onToggleStar}
              aria-pressed={Boolean(play.starred)}
              aria-label={play.starred ? "Unstar play" : "Star play"}
            >
              <Star className={`h-4 w-4 ${play.starred ? "fill-current" : ""}`} />
              {play.starred ? "Starred" : "Star"}
            </Button>
          )}
          {play.yardsGained != null ? (
            <p className="font-display text-3xl font-semibold tabular">
              {formatYards(play.yardsGained)}
            </p>
          ) : (
            <p className="text-xs text-fg-subtle">Yards unconfirmed</p>
          )}
          {play.result && (
            <p className="text-xs capitalize text-fg-muted">{play.result.replace("_", " ")}</p>
          )}
        </div>
      </div>

      {youthMode && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Quick tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {YOUTH_QUICK_TAGS.map((t) => {
              const active = play.tags.some(
                (pt) => pt.label.toLowerCase() === t.label.toLowerCase(),
              );
              return (
                <button
                  key={t.label}
                  type="button"
                  disabled={active}
                  onClick={() => onAddTag(t.label, t.category)}
                  className={
                    active
                      ? "h-8 rounded-full bg-fg/15 px-3 text-xs font-medium text-fg-muted"
                      : "h-8 rounded-full border border-border px-3 text-xs font-medium text-fg-muted hover:border-fg hover:text-fg"
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs text-fg-subtle" htmlFor="jersey-pick">
              Roster jersey
            </label>
            <Input
              id="jersey-pick"
              value={jerseyQuery}
              onChange={(e) => setJerseyQuery(e.target.value)}
              placeholder="Search # or name…"
              aria-label="Search roster for jersey tag"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {jerseyMatches.map((p) => {
                const label = formatJersey(p.number)!;
                const active = play.tags.some(
                  (pt) => pt.label.toLowerCase() === label.toLowerCase(),
                );
                return (
                  <button
                    key={p.number}
                    type="button"
                    disabled={active}
                    onClick={() => {
                      onAddTag(label, "personnel");
                      setJerseyQuery("");
                    }}
                    className={
                      active
                        ? "h-8 rounded-full bg-fg/15 px-2.5 text-[11px] font-medium text-fg-muted"
                        : "h-8 rounded-full border border-border px-2.5 text-[11px] font-medium text-fg-muted hover:border-fg hover:text-fg"
                    }
                  >
                    #{p.number} {p.first}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium">Tags</h3>
          <span className="text-xs text-fg-subtle">{play.tags.length} total</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {play.tags.length === 0 && (
            <p className="text-sm text-fg-muted">
              No tags yet — use quick tags or add a coach note.
            </p>
          )}
          {play.tags.map((t) => {
            const band = confidenceBand(t.confidence);
            return (
              <span
                key={t.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-1 text-xs"
              >
                <TagSourceBadge source={t.source} />
                <span>{t.label}</span>
                {t.confidence != null && (
                  <span className="tabular text-fg-subtle">
                    {Math.round(t.confidence * 100)}%
                    {band !== "n/a" ? ` · ${band}` : ""}
                  </span>
                )}
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0.5 text-fg-subtle hover:bg-bg-subtle hover:text-fg focus-ring"
                  aria-label={`Remove ${t.label}`}
                  onClick={() => onRemoveTag(t.id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onAddTag(draft);
            setDraft("");
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add coach tag…"
            aria-label="Add coach tag"
          />
          <Button type="submit" variant="secondary" size="md" disabled={!draft.trim()}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </form>
      </div>

      <div>
        <label htmlFor="play-notes" className="mb-2 block text-sm font-medium">
          Coach notes
        </label>
        <textarea
          id="play-notes"
          value={play.notes ?? ""}
          onChange={(e) => onNote(e.target.value)}
          rows={3}
          placeholder="Teaching point — do not invent shotgun, down, or yards…"
          className="w-full resize-y rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-ring"
        />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {play.tags
          .filter((t) => t.category === "situation")
          .map((t) => (
            <Badge key={t.id} tone="neutral">
              {t.label}
            </Badge>
          ))}
      </div>

      {ontology.length > 0 && (
        <div className="border-t border-border pt-3">
          <h3 className="text-sm font-medium">Open Play Ontology</h3>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {ontology.map(({ entry }) => (
              <li
                key={entry.id}
                className="rounded-full border border-border bg-bg-subtle/50 px-2.5 py-1 font-mono text-[11px] text-fg-muted"
                title={entry.blurb}
              >
                {entry.id}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-[var(--radius-md)] border border-border">
        <FormationDiagram label={diagramLabel} />
      </div>
    </div>
  );
}
