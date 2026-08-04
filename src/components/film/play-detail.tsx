import { useState } from "react";
import { Plus, Star, X } from "lucide-react";
import type { Play } from "@/lib/core/types";
import { confidenceBand } from "@/lib/core/tagging";
import { formatYards } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagSourceBadge } from "./status-badge";

export function PlayDetail({
  play,
  onAddTag,
  onRemoveTag,
  onNote,
  onToggleStar,
}: {
  play: Play;
  onAddTag: (label: string) => void;
  onRemoveTag: (tagId: string) => void;
  onNote: (notes: string) => void;
  onToggleStar?: () => void;
}) {
  const [draft, setDraft] = useState("");

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
            ) : null}
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
          {play.yardsGained != null && (
            <p className="font-display text-3xl font-semibold tabular">
              {formatYards(play.yardsGained)}
            </p>
          )}
          {play.result && (
            <p className="text-xs capitalize text-fg-muted">{play.result.replace("_", " ")}</p>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium">Tags</h3>
          <span className="text-xs text-fg-subtle">{play.tags.length} total</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {play.tags.length === 0 && (
            <p className="text-sm text-fg-muted">No tags yet — add coach notes or re-run AI.</p>
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
          placeholder="Teaching point, assignment error, call sheet note…"
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
    </div>
  );
}
