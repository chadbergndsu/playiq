import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  Clapperboard,
  Download,
  Eye,
  FileJson,
  Film,
  Package,
  ScrollText,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FormationDiagram } from "@/components/film/formation-diagram";
import { Button } from "@/components/ui/button";
import {
  playsToFfmpegConcatList,
  playsToFfmpegFilterComplex,
  playsToSimpleEdl,
} from "@/lib/core/edl";
import {
  buildOpenFilmPackage,
  parseOfp,
  serializeOfp,
} from "@/lib/core/ofp";
import {
  ONTOLOGY_VERSION,
  PLAY_ONTOLOGY,
  countOntologyHits,
  listOntologyFamilies,
  ontologyByFamily,
} from "@/lib/core/ontology";
import { playsToWebVttChapters, playsToWebVttMetadata } from "@/lib/core/webvtt";
import {
  assembleCutupFromSource,
  isWebCodecsAvailable,
} from "@/lib/media/cut-assembly";
import { getFilmMedia, registerFilmMedia } from "@/lib/media/media-registry";
import { runLocalVisionToOfp } from "@/lib/media/vision-client";
import { usePlayiqStore } from "@/lib/store/playiq-store";

export const Route = createFileRoute("/app/exchange")({
  component: ExchangePage,
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

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExchangePage() {
  const films = usePlayiqStore((s) => s.films);
  const playsByFilm = usePlayiqStore((s) => s.playsByFilm);
  const cutups = usePlayiqStore((s) => s.cutups);
  const importOfp = usePlayiqStore((s) => s.importOfp);
  const importWebVtt = usePlayiqStore((s) => s.importWebVtt);
  const allPlays = useMemo(() => Object.values(playsByFilm).flat(), [playsByFilm]);
  const ontologyHits = useMemo(() => countOntologyHits(allPlays).slice(0, 12), [allPlays]);
  const families = listOntologyFamilies();
  const [diagramLabel, setDiagramLabel] = useState("Shotgun");
  const [filmId, setFilmId] = useState(films[0]?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  const webCodecs = typeof window !== "undefined" && isWebCodecsAvailable();

  const selectedPlays = playsByFilm[filmId] ?? allPlays.slice(0, 40);
  const mediaPlaceholder = films.find((f) => f.id === filmId)?.sourceFileName
    ? `./${films.find((f) => f.id === filmId)!.sourceFileName}`
    : `./film_${filmId || "game"}.mp4`;

  function exportOfp() {
    const pkg = buildOpenFilmPackage({
      films,
      plays: allPlays,
      cutups,
    });
    downloadText("playiq-season.ofp.json", serializeOfp(pkg), "application/json");
    toast.success("Open Film Package exported", {
      description: "Portable JSON — import on another machine or program.",
    });
  }

  function exportVtt(kind: "chapters" | "meta") {
    const film = films.find((f) => f.id === filmId);
    const plays = selectedPlays;
    const text =
      kind === "chapters"
        ? playsToWebVttChapters(plays, { title: film?.title })
        : playsToWebVttMetadata(plays);
    const base = (film?.opponent ?? "film").replace(/\s+/g, "_");
    downloadText(
      `${base}.${kind}.vtt`,
      text,
      "text/vtt",
    );
    toast.message(`WebVTT ${kind} exported`);
  }

  function exportEditorial(kind: "concat" | "edl" | "filter") {
    const clips = selectedPlays.map((play) => ({
      play,
      mediaPath: mediaPlaceholder,
    }));
    const film = films.find((f) => f.id === filmId);
    const base = (film?.opponent ?? "cutup").replace(/\s+/g, "_");
    if (kind === "concat") {
      downloadText(
        `${base}.ffmpeg.txt`,
        playsToFfmpegConcatList(clips, { reencodeHint: true }),
        "text/plain",
      );
    } else if (kind === "edl") {
      downloadText(
        `${base}.edl`,
        playsToSimpleEdl(clips, { title: film?.title ?? "PlayIQ Cutup" }),
        "text/plain",
      );
    } else {
      downloadText(
        `${base}.ffmpeg.sh`,
        playsToFfmpegFilterComplex(clips, `${base}_cutup.mp4`),
        "text/x-shellscript",
      );
    }
    toast.message("Editorial export ready", {
      description: "Open standards for FFmpeg / NLE — not a proprietary package.",
    });
  }

  async function onImportFile(file: File) {
    try {
      const text = await file.text();
      const pkg = parseOfp(text);
      const result = importOfp(pkg);
      toast.success("OFP imported", {
        description: `${result.films} films · ${result.plays} plays · ${result.cutups} cutups merged into library.`,
      });
    } catch (err) {
      toast.message("Import failed", {
        description: err instanceof Error ? err.message : "Invalid package",
      });
    }
  }

  async function onImportVtt(file: File) {
    if (!filmId) {
      toast.message("Select a film first");
      return;
    }
    try {
      const text = await file.text();
      const result = importWebVtt(filmId, text, file.name);
      toast.success("WebVTT imported", {
        description: `${result.plays} plays written to selected film.`,
      });
    } catch (err) {
      toast.message("WebVTT import failed", {
        description: err instanceof Error ? err.message : "Invalid VTT",
      });
    }
  }

  async function onLocalVision(file: File) {
    setBusy("vision");
    setProgress("Starting…");
    try {
      const result = await runLocalVisionToOfp(
        file,
        {
          opponent: file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "Vision",
          week: films.length + 1,
          fileName: file.name,
        },
        (msg, r) => setProgress(r != null ? `${msg} ${Math.round(r * 100)}%` : msg),
      );
      const imported = importOfp(result.package);
      const newFilmId = result.package.films[0]?.id;
      if (newFilmId) registerFilmMedia(newFilmId, file, file.name);
      toast.success("Local vision complete", {
        description: `${result.mode} frames · ${result.playCount} plays · ${imported.films} film(s). OFP contract ready.`,
      });
      if (newFilmId) setFilmId(newFilmId);
    } catch (err) {
      toast.message("Vision failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(null);
      setProgress("");
    }
  }

  async function onAssembleCutup() {
    const media = getFilmMedia(filmId);
    if (!media) {
      toast.message("No local media for this film", {
        description: "Upload a video on Library or attach media below first.",
      });
      return;
    }
    if (selectedPlays.length === 0) {
      toast.message("No plays on this film");
      return;
    }
    setBusy("cut");
    setProgress("Assembling…");
    try {
      const film = films.find((f) => f.id === filmId);
      const result = await assembleCutupFromSource(media.blob, selectedPlays, {
        title: film?.title,
        mediaPathHint: media.fileName,
        maxClips: 16,
        onProgress: (done, total) =>
          setProgress(`Clip ${Math.min(total, Math.ceil(done))}/${total}`),
      });
      const base = (film?.opponent ?? "cutup").replace(/\s+/g, "_");
      if (result.singleMp4) {
        downloadBlob(`${base}_play.mp4`, result.singleMp4);
      }
      downloadBlob(`${base}_cutup.zip`, result.zip);
      toast.success("Cut assembly ready", {
        description: `${result.clipCount} clip(s) via Mediabunny/WebCodecs — private, on-device.`,
      });
    } catch (err) {
      toast.message("Assembly failed", {
        description: err instanceof Error ? err.message : "WebCodecs error",
      });
    } finally {
      setBusy(null);
      setProgress("");
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
          Open stack
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Exchange</h1>
        <p className="mt-2 max-w-2xl text-sm text-fg-muted">
          Full open pipeline: ontology · OFP · WebVTT round-trip · FFmpeg/EDL ·{" "}
          <strong className="text-fg">Mediabunny cut assembly</strong> ·{" "}
          <strong className="text-fg">local vision → OFP</strong>
          {webCodecs ? " · WebCodecs ready" : " · WebCodecs unavailable in this browser"}.
        </p>
        {busy && (
          <p className="mt-2 text-xs text-fg-subtle">
            Working: {busy} — {progress}
          </p>
        )}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: Package,
            title: "Open Film Package",
            body: `OFP v1 JSON with ontology IDs · ${films.length} films / ${allPlays.length} plays`,
            action: exportOfp,
            label: "Export season OFP",
          },
          {
            icon: ScrollText,
            title: "WebVTT chapters",
            body: "W3C timed tracks for any player / VLC / OBS",
            action: () => exportVtt("chapters"),
            label: "Export .vtt",
          },
          {
            icon: Film,
            title: "FFmpeg concat",
            body: "Open concat demuxer list with in/out points",
            action: () => exportEditorial("concat"),
            label: "Export concat list",
          },
          {
            icon: FileJson,
            title: "Simple EDL",
            body: "Text edit decision list for NLE pipelines",
            action: () => exportEditorial("edl"),
            label: "Export EDL",
          },
        ].map((c) => (
          <article key={c.title} className="panel flex flex-col p-5">
            <c.icon className="h-4 w-4 text-fg-subtle" />
            <h2 className="mt-3 text-sm font-semibold">{c.title}</h2>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-fg-muted">{c.body}</p>
            <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={c.action}>
              <Download className="h-3.5 w-3.5" />
              {c.label}
            </Button>
          </article>
        ))}
      </section>

      <section className="panel grid gap-6 p-5 lg:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold">Source film</h2>
          <select
            value={filmId}
            onChange={(e) => setFilmId(e.target.value)}
            className="mt-2 h-10 w-full max-w-md rounded-[var(--radius-sm)] border border-border bg-bg px-3 text-sm focus-ring"
          >
            {films.map((f) => (
              <option key={f.id} value={f.id}>
                W{f.week} · {f.title}
                {getFilmMedia(f.id) ? " · media" : ""}
              </option>
            ))}
          </select>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => exportVtt("meta")}>
              WebVTT metadata
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => exportEditorial("filter")}
            >
              FFmpeg filter script
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={Boolean(busy) || !webCodecs}
              onClick={() => void onAssembleCutup()}
            >
              <Clapperboard className="h-3.5 w-3.5" />
              Assemble cut (WebCodecs)
            </Button>
          </div>
          <p className="mt-3 text-xs text-fg-subtle">
            Media path: <code className="text-fg-muted">{mediaPlaceholder}</code>
            {getFilmMedia(filmId)
              ? " · local blob registered"
              : " · attach media to assemble"}
          </p>
          <label className="mt-3 block text-xs text-fg-subtle">
            Attach / replace local media for selected film
            <input
              type="file"
              accept="video/*"
              className="mt-1 block w-full text-sm text-fg-muted file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-bg-subtle file:px-3 file:py-2 file:text-sm file:text-fg"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && filmId) {
                  registerFilmMedia(filmId, f, f.name);
                  toast.message("Media registered for session", {
                    description: f.name,
                  });
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Import OFP</h2>
            <p className="mt-1 text-xs text-fg-muted">
              Merge Open Film Package (ids collide → import wins).
            </p>
            <label className="mt-3 flex cursor-pointer flex-col items-start gap-2 rounded-[var(--radius-md)] border border-dashed border-border bg-bg-subtle/40 px-4 py-4 hover:border-border-strong">
              <Upload className="h-5 w-5 text-fg-subtle" />
              <span className="text-sm font-medium">.ofp.json / .json</span>
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onImportFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Import WebVTT → plays</h2>
            <p className="mt-1 text-xs text-fg-muted">
              Round-trip chapters or PlayIQ metadata tracks onto the selected film.
            </p>
            <label className="mt-3 flex cursor-pointer flex-col items-start gap-2 rounded-[var(--radius-md)] border border-dashed border-border bg-bg-subtle/40 px-4 py-4 hover:border-border-strong">
              <ScrollText className="h-5 w-5 text-fg-subtle" />
              <span className="text-sm font-medium">.vtt file</span>
              <input
                type="file"
                accept=".vtt,text/vtt,text/plain"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onImportVtt(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Eye className="h-4 w-4 text-fg-subtle" />
              Local vision → OFP
            </h2>
            <p className="mt-1 text-xs text-fg-muted">
              Sample frames (Mediabunny), scene-cut segments, heuristic tags, import as OFP.
              Same contract as <code className="text-fg-muted">npx tsx scripts/vision-sidecar.ts</code>.
            </p>
            <label className="mt-3 flex cursor-pointer flex-col items-start gap-2 rounded-[var(--radius-md)] border border-dashed border-border bg-bg-subtle/40 px-4 py-4 hover:border-border-strong">
              <Eye className="h-5 w-5 text-fg-subtle" />
              <span className="text-sm font-medium">
                {busy === "vision" ? progress || "Running…" : "Pick game video"}
              </span>
              <input
                type="file"
                accept="video/*"
                disabled={Boolean(busy)}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onLocalVision(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
              <BookOpen className="h-5 w-5 text-fg-subtle" />
              Open Play Ontology
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              Version {ONTOLOGY_VERSION} · {PLAY_ONTOLOGY.length} entries · aliases normalize
              coach/AI labels for exchange
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="panel overflow-x-auto p-4">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-fg-subtle">
                  <th className="py-2 pr-3 font-medium">ID</th>
                  <th className="py-2 pr-3 font-medium">Label</th>
                  <th className="py-2 pr-3 font-medium">Family</th>
                  <th className="py-2 font-medium">Season hits</th>
                </tr>
              </thead>
              <tbody>
                {ontologyHits.map((h) => (
                  <tr key={h.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-mono text-xs text-fg-subtle">{h.id}</td>
                    <td className="py-2 pr-3">{h.label}</td>
                    <td className="py-2 pr-3 text-fg-muted">{h.family}</td>
                    <td className="py-2 tabular">{h.count}</td>
                  </tr>
                ))}
                {ontologyHits.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-fg-muted">
                      No ontology-mapped tags yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="mt-4 flex flex-wrap gap-2">
              {families.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-border px-2.5 py-1 text-[11px] text-fg-muted"
                >
                  {f} · {ontologyByFamily(f).length}
                </span>
              ))}
            </div>
          </div>

          <div className="panel p-4">
            <h3 className="text-sm font-semibold">Open SVG formation sketch</h3>
            <p className="mt-1 text-xs text-fg-muted">
              Generated client-side — no proprietary play drawer. Print or embed freely.
            </p>
            <select
              value={diagramLabel}
              onChange={(e) => setDiagramLabel(e.target.value)}
              className="mt-3 h-9 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm focus-ring"
            >
              {[
                "Shotgun",
                "Pistol",
                "Trips",
                "Empty",
                "Bunch",
                "Under center",
                "Cover 3",
                "Cover 2",
                "Man coverage",
                "Punt",
              ].map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <div className="mt-3 overflow-hidden rounded-[var(--radius-md)] border border-border">
              <FormationDiagram label={diagramLabel} />
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-5 text-sm text-fg-muted">
        <h2 className="text-sm font-semibold text-fg">Why this stack (vs closed film rooms)</h2>
        <ul className="mt-3 list-inside list-disc space-y-1.5">
          <li>
            <strong className="text-fg">WebVTT</strong> — W3C standard chapter tracks; works
            outside PlayIQ.
          </li>
          <li>
            <strong className="text-fg">FFmpeg concat / filter scripts</strong> — the open
            video Swiss army knife coaches already trust on game day laptops.
          </li>
          <li>
            <strong className="text-fg">OFP JSON</strong> — human-readable film exchange with
            ontology IDs; not a binary vendor package.
          </li>
          <li>
            <strong className="text-fg">Open Play Ontology</strong> — stable concept IDs for
            AI + coach tags (inspired by open coaching vocabulary, not Assist code windows).
          </li>
          <li>
            <strong className="text-fg">SVG diagrams</strong> — open graphics you can fork,
            print, or version in git.
          </li>
          <li>
            <strong className="text-fg">Mediabunny / WebCodecs</strong> — on-device cut
            assembly; film never leaves the laptop.
          </li>
          <li>
            <strong className="text-fg">Local vision sidecar</strong> — open scene-cut → OFP
            (YOLO can plug in later without changing the exchange format).
          </li>
        </ul>
      </section>
    </div>
  );
}
