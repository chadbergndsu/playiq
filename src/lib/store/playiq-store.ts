import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  buildCutup,
  buildCutupFromPlayIds,
  starredInstallPlayIds,
} from "@/lib/core/cutups";
import { playToSignal } from "@/lib/core/llm-tagging";
import {
  seedFilms,
  seedPlaysForFilm,
  seedProductDemoFilms,
  withTagCounts,
} from "@/lib/core/seed";
import { nextGame } from "@/lib/core/schedule";
import { applyAiToPlay, mergeTags } from "@/lib/core/tagging";
import { isTrainingClipId } from "@/lib/core/training-clip";
import { createUploadedFilm, finalizeUploadedFilm } from "@/lib/core/upload";
import { newShareToken } from "@/lib/core/export";
import { mergeOfpIntoLibrary, type OpenFilmPackage } from "@/lib/core/ofp";
import { importWebVttToPlays } from "@/lib/core/webvtt";
import { clearAllMedia, registerFilmMedia } from "@/lib/media/media-registry";

/** Per-film upload finalize generation — ignore stale timers. */
const uploadFinalizeGen = new Map<string, number>();
import type {
  Cutup,
  Film,
  FilmStatus,
  Play,
  PlayFilter,
  PlayTag,
  TagSource,
  Venue,
} from "@/lib/core/types";

const EMPTY_PLAYS: Play[] = [];

function buildYouthCutups(allPlays: Play[]): Cutup[] {
  return [
    buildCutup({
      id: "cut_box",
      title: "Dies in the box",
      description: "Inside run / box stops — teach gap integrity.",
      plays: allPlays,
      filter: {
        query: "",
        side: "all",
        concept: "Inside run",
        down: "all",
        source: "all",
      },
    }),
    buildCutup({
      id: "cut_bounce",
      title: "Bounce to the bench",
      description: "Outside bounce plays.",
      plays: allPlays,
      filter: {
        query: "",
        side: "all",
        concept: "Outside run",
        down: "all",
        source: "all",
      },
    }),
    buildCutup({
      id: "cut_wr_unused",
      title: "WR unused",
      description: "Detached WR stays unused.",
      plays: allPlays,
      filter: {
        query: "Unused WR",
        side: "all",
        concept: "all",
        down: "all",
        source: "all",
      },
    }),
  ];
}

function initialState() {
  const films = seedFilms();
  const playsByFilm: Record<string, Play[]> = {};
  for (const f of films) {
    playsByFilm[f.id] = seedPlaysForFilm(f);
  }
  const withCounts = withTagCounts(films, playsByFilm);
  const allPlays = Object.values(playsByFilm).flat();
  return { films: withCounts, playsByFilm, cutups: buildYouthCutups(allPlays) };
}

export type PlayiqState = {
  films: Film[];
  playsByFilm: Record<string, Play[]>;
  cutups: Cutup[];
  selectedPlayId: string | null;
  libraryQuery: string;
  libraryStatus: FilmStatus | "all";
  hydrated: boolean;
  resetDemo: () => void;
  /** Append optional varsity product-demo films (marketing). */
  loadProductDemo: () => void;
  /** Build teach reel: starred plays + matching practice family clips for next/latest game. */
  createTeachThisWeekCutup: (title?: string) => string | null;
  setHydrated: (v: boolean) => void;
  addCoachTag: (playId: string, label: string, category?: PlayTag["category"]) => void;
  removeTag: (playId: string, tagId: string) => void;
  setPlayNote: (playId: string, notes: string) => void;
  toggleStarPlay: (playId: string) => void;
  selectPlay: (playId: string | null) => void;
  setLibraryQuery: (q: string) => void;
  setLibraryStatus: (s: FilmStatus | "all") => void;
  reanalyzeFilm: (filmId: string) => void;
  applyAiTagsForFilm: (filmId: string, playTags: Record<string, PlayTag[]>) => void;
  markFilmReady: (filmId: string) => void;
  uploadFilm: (input: {
    opponent: string;
    week: number;
    venue?: Venue;
    fileName?: string;
    durationSec?: number;
    /** Optional browser File for local cut assembly / vision */
    file?: Blob;
    /** clip = one play; game = shell for auto-split */
    mode?: "clip" | "game";
    title?: string;
  }) => string;
  createCutupFromFilter: (title: string, filmId: string | "all", filter: PlayFilter) => string;
  /** Explicit ordered play ids (install reel, multi-select). */
  createCutupFromPlayIds: (
    title: string,
    playIds: string[],
    description?: string,
  ) => string;
  /** Teach reel from all starred plays across the library. */
  createInstallCutupFromStars: (title?: string) => string | null;
  deleteCutup: (id: string) => void;
  renameCutup: (id: string, title: string) => void;
  removePlayFromCutup: (cutupId: string, playId: string) => void;
  ensureCutupShareToken: (cutupId: string) => string | null;
  /** Persist server-minted share token after successful publish. */
  setCutupShareToken: (cutupId: string, token: string) => void;
  /** Import Open Film Package (portable coach exchange). */
  importOfp: (pkg: OpenFilmPackage) => {
    films: number;
    plays: number;
    cutups: number;
  };
  /** Replace or set plays for a film (WebVTT / vision import). */
  setFilmPlays: (filmId: string, plays: Play[], status?: FilmStatus) => void;
  importWebVtt: (
    filmId: string,
    raw: string,
    sourceLabel?: string,
  ) => { plays: number };
};

function findPlayLocation(
  playsByFilm: Record<string, Play[]>,
  playId: string,
): { filmId: string; index: number } | null {
  for (const [filmId, plays] of Object.entries(playsByFilm)) {
    const index = plays.findIndex((p) => p.id === playId);
    if (index >= 0) return { filmId, index };
  }
  return null;
}

const boot = initialState();

export const usePlayiqStore = create<PlayiqState>()(
  persist(
    (set, get) => ({
      films: boot.films,
      playsByFilm: boot.playsByFilm,
      cutups: boot.cutups,
      selectedPlayId: null,
      libraryQuery: "",
      libraryStatus: "all",
      hydrated: false,

      setHydrated: (v) => set({ hydrated: v }),

      resetDemo: () => {
        uploadFinalizeGen.clear();
        clearAllMedia();
        const next = initialState();
        set({
          films: next.films,
          playsByFilm: next.playsByFilm,
          cutups: next.cutups,
          selectedPlayId: null,
          libraryQuery: "",
          libraryStatus: "all",
        });
      },

      loadProductDemo: () => {
        set((state) => {
          const existing = new Set(state.films.map((f) => f.id));
          const demos = seedProductDemoFilms().filter((f) => !existing.has(f.id));
          if (demos.length === 0) return state;
          const playsByFilm = { ...state.playsByFilm };
          for (const f of demos) {
            playsByFilm[f.id] = seedPlaysForFilm(f);
          }
          const films = withTagCounts([...state.films, ...demos], playsByFilm);
          return { films, playsByFilm };
        });
      },

      createTeachThisWeekCutup: (title) => {
        const state = get();
        const upcoming = nextGame();
        const scheduleFilms = state.films.filter((f) => f.id.startsWith("film_sched_"));
        const focus =
          scheduleFilms.find((f) => upcoming && f.opponent === upcoming.opponent) ??
          [...scheduleFilms].sort((a, b) => b.date.localeCompare(a.date))[0];
        const opponent = focus?.opponent ?? upcoming?.opponent ?? "This week";

        const all = Object.values(state.playsByFilm).flat();
        const starred = all.filter((p) => p.starred);
        const practiceFamily = all.filter((p) => {
          if (!isTrainingClipId(p.filmId)) return false;
          return p.tags.some(
            (t) =>
              /inside run|outside run|unused wr|dies in box|bounce to bench/i.test(t.label),
          );
        });

        const starredIds = starred.map((p) => p.id);
        const practiceIds = practiceFamily
          .map((p) => p.id)
          .filter((id) => !starredIds.includes(id));
        const ordered = [...starredIds, ...practiceIds].slice(0, 10);
        if (ordered.length === 0) return null;
        return get().createCutupFromPlayIds(
          title?.trim() || `${opponent} — teach this week`,
          ordered,
          "Starred game/practice plays plus matching bounce-vs-box practice family.",
        );
      },

      selectPlay: (playId) => set({ selectedPlayId: playId }),
      setLibraryQuery: (q) => set({ libraryQuery: q }),
      setLibraryStatus: (s) => set({ libraryStatus: s }),

      addCoachTag: (playId, label, category = "coach_note") => {
        const trimmed = label.trim();
        if (!trimmed) return;
        const loc = findPlayLocation(get().playsByFilm, playId);
        if (!loc) return;
        set((state) => {
          const plays = [...(state.playsByFilm[loc.filmId] ?? EMPTY_PLAYS)];
          const play = plays[loc.index];
          if (!play) return state;
          if (play.tags.some((t) => t.label.toLowerCase() === trimmed.toLowerCase())) {
            return state;
          }
          const tag: PlayTag = {
            id: `coach:${category}:${trimmed.toLowerCase().replace(/\s+/g, "_")}:${Date.now()}`,
            category,
            label: trimmed,
            source: "coach" satisfies TagSource,
          };
          plays[loc.index] = { ...play, tags: [...play.tags, tag] };
          const playsByFilm = { ...state.playsByFilm, [loc.filmId]: plays };
          return { playsByFilm, films: withTagCounts(state.films, playsByFilm) };
        });
      },

      removeTag: (playId, tagId) => {
        const loc = findPlayLocation(get().playsByFilm, playId);
        if (!loc) return;
        set((state) => {
          const plays = [...(state.playsByFilm[loc.filmId] ?? EMPTY_PLAYS)];
          const play = plays[loc.index];
          if (!play) return state;
          plays[loc.index] = {
            ...play,
            tags: play.tags.filter((t) => t.id !== tagId),
          };
          const playsByFilm = { ...state.playsByFilm, [loc.filmId]: plays };
          return { playsByFilm, films: withTagCounts(state.films, playsByFilm) };
        });
      },

      setPlayNote: (playId, notes) => {
        const loc = findPlayLocation(get().playsByFilm, playId);
        if (!loc) return;
        set((state) => {
          const plays = [...(state.playsByFilm[loc.filmId] ?? EMPTY_PLAYS)];
          const play = plays[loc.index];
          if (!play) return state;
          plays[loc.index] = { ...play, notes };
          return {
            playsByFilm: { ...state.playsByFilm, [loc.filmId]: plays },
          };
        });
      },

      toggleStarPlay: (playId) => {
        const loc = findPlayLocation(get().playsByFilm, playId);
        if (!loc) return;
        set((state) => {
          const plays = [...(state.playsByFilm[loc.filmId] ?? EMPTY_PLAYS)];
          const play = plays[loc.index];
          if (!play) return state;
          plays[loc.index] = { ...play, starred: !play.starred };
          return {
            playsByFilm: { ...state.playsByFilm, [loc.filmId]: plays },
          };
        });
      },

      reanalyzeFilm: (filmId) => {
        set((state) => {
          const plays = (state.playsByFilm[filmId] ?? EMPTY_PLAYS).map((p) =>
            applyAiToPlay(p, playToSignal(p)),
          );
          const playsByFilm = { ...state.playsByFilm, [filmId]: plays };
          const films = state.films.map((f) =>
            f.id === filmId
              ? {
                  ...f,
                  status: "ready" as const,
                  aiProgress: 100,
                }
              : f,
          );
          return { playsByFilm, films: withTagCounts(films, playsByFilm) };
        });
      },

      applyAiTagsForFilm: (filmId, playTags) => {
        set((state) => {
          const plays = (state.playsByFilm[filmId] ?? EMPTY_PLAYS).map((p) => {
            const ai = playTags[p.id];
            if (!ai || ai.length === 0) return p;
            return { ...p, tags: mergeTags(p.tags, ai) };
          });
          const playsByFilm = { ...state.playsByFilm, [filmId]: plays };
          const films = state.films.map((f) =>
            f.id === filmId
              ? {
                  ...f,
                  status: "ready" as const,
                  aiProgress: 100,
                }
              : f,
          );
          return { playsByFilm, films: withTagCounts(films, playsByFilm) };
        });
      },

      markFilmReady: (filmId) => {
        set((state) => ({
          films: state.films.map((f) =>
            f.id === filmId ? { ...f, status: "ready", aiProgress: 100 } : f,
          ),
        }));
      },

      uploadFilm: (input) => {
        const { film, plays } = createUploadedFilm(input);
        if (input.file) {
          registerFilmMedia(film.id, input.file, input.fileName ?? "upload.mp4");
        }
        set((state) => {
          const playsByFilm = { ...state.playsByFilm, [film.id]: plays };
          const films = withTagCounts([film, ...state.films], playsByFilm);
          return { films, playsByFilm };
        });
        const id = film.id;
        // Game uploads stay "processing" until local vision fills plays.
        if (input.mode === "game") {
          return id;
        }
        const gen = (uploadFinalizeGen.get(id) ?? 0) + 1;
        uploadFinalizeGen.set(id, gen);
        setTimeout(() => {
          if (uploadFinalizeGen.get(id) !== gen) return;
          set((state) => {
            const current = state.films.find((f) => f.id === id);
            if (!current || current.status !== "processing") return state;
            const films = state.films.map((f) =>
              f.id === id ? finalizeUploadedFilm(f) : f,
            );
            return { films: withTagCounts(films, state.playsByFilm) };
          });
        }, 1800);
        return id;
      },

      createCutupFromFilter: (title, filmId, filter) => {
        const id = `cut_${Date.now()}`;
        const plays =
          filmId === "all"
            ? Object.values(get().playsByFilm).flat()
            : (get().playsByFilm[filmId] ?? EMPTY_PLAYS);
        const cut = buildCutup({ id, title, plays, filter });
        set((s) => ({ cutups: [cut, ...s.cutups] }));
        return id;
      },

      createCutupFromPlayIds: (title, playIds, description) => {
        const id = `cut_${Date.now()}`;
        const cut = buildCutupFromPlayIds({
          id,
          title: title.trim() || "Untitled cutup",
          description: description ?? "",
          playIds,
          filterSummary: `${playIds.length} plays`,
        });
        set((s) => ({ cutups: [cut, ...s.cutups] }));
        return id;
      },

      createInstallCutupFromStars: (title) => {
        const all = Object.values(get().playsByFilm).flat();
        const playIds = starredInstallPlayIds(all);
        if (playIds.length === 0) return null;
        return get().createCutupFromPlayIds(
          title?.trim() || "Install — starred plays",
          playIds,
          "Auto-built from coach star bookmarks.",
        );
      },

      deleteCutup: (id) => set((s) => ({ cutups: s.cutups.filter((c) => c.id !== id) })),

      renameCutup: (id, title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((s) => ({
          cutups: s.cutups.map((c) =>
            c.id === id
              ? { ...c, title: trimmed, updatedAt: new Date().toISOString() }
              : c,
          ),
        }));
      },

      removePlayFromCutup: (cutupId, playId) => {
        set((s) => ({
          cutups: s.cutups.map((c) =>
            c.id === cutupId
              ? {
                  ...c,
                  playIds: c.playIds.filter((id) => id !== playId),
                  updatedAt: new Date().toISOString(),
                }
              : c,
          ),
        }));
      },

      ensureCutupShareToken: (cutupId) => {
        const cut = get().cutups.find((c) => c.id === cutupId);
        if (!cut) return null;
        if (cut.shareToken) return cut.shareToken;
        // Local placeholder only — server mints the real capability token on publish.
        const token = newShareToken();
        set((s) => ({
          cutups: s.cutups.map((c) =>
            c.id === cutupId
              ? { ...c, shareToken: token, updatedAt: new Date().toISOString() }
              : c,
          ),
        }));
        return token;
      },

      setCutupShareToken: (cutupId, token) => {
        const trimmed = token.trim();
        if (!trimmed) return;
        set((s) => ({
          cutups: s.cutups.map((c) =>
            c.id === cutupId
              ? { ...c, shareToken: trimmed, updatedAt: new Date().toISOString() }
              : c,
          ),
        }));
      },

      importOfp: (pkg) => {
        const state = get();
        const merged = mergeOfpIntoLibrary(
          {
            films: state.films,
            playsByFilm: state.playsByFilm,
            cutups: state.cutups,
          },
          pkg,
        );
        const films = withTagCounts(merged.films, merged.playsByFilm);
        set({
          films,
          playsByFilm: merged.playsByFilm,
          cutups: merged.cutups,
        });
        return {
          films: merged.importedFilms,
          plays: merged.importedPlays,
          cutups: merged.importedCutups,
        };
      },

      setFilmPlays: (filmId, plays, status) => {
        set((state) => {
          const playsByFilm = { ...state.playsByFilm, [filmId]: plays };
          const films = state.films.map((f) => {
            if (f.id !== filmId) return f;
            return {
              ...f,
              status: status ?? f.status,
              playCount: plays.length,
              tagCount: plays.reduce((n, p) => n + p.tags.length, 0),
              aiProgress: status === "ready" || status === "needs_review" ? 100 : f.aiProgress,
            };
          });
          return { playsByFilm, films: withTagCounts(films, playsByFilm) };
        });
      },

      importWebVtt: (filmId, raw, sourceLabel) => {
        const plays = importWebVttToPlays(filmId, raw, { sourceLabel });
        get().setFilmPlays(filmId, plays, "needs_review");
        return { plays: plays.length };
      },
    }),
    {
      name: "playiq-demo-v17",
      skipHydration: true,
      partialize: (s) => ({
        films: s.films,
        playsByFilm: s.playsByFilm,
        // Do not persist share tokens — capability secrets should not live in localStorage.
        cutups: s.cutups.map(({ shareToken: _t, ...c }) => c),
      }),
    },
  ),
);

export function libraryFilmList(
  films: Film[],
  query: string,
  status: FilmStatus | "all",
): Film[] {
  const q = query.trim().toLowerCase();
  return films.filter((f) => {
    if (status !== "all" && f.status !== status) return false;
    if (!q) return true;
    return (
      f.title.toLowerCase().includes(q) ||
      f.opponent.toLowerCase().includes(q) ||
      `week ${f.week}`.includes(q) ||
      (f.sourceFileName?.toLowerCase().includes(q) ?? false)
    );
  });
}

export function playsForFilm(
  playsByFilm: Record<string, Play[]>,
  filmId: string,
): Play[] {
  return playsByFilm[filmId] ?? EMPTY_PLAYS;
}

export function cutupPlays(
  playsByFilm: Record<string, Play[]>,
  cutups: Cutup[],
  cutupId: string,
): Play[] {
  const cut = cutups.find((c) => c.id === cutupId);
  if (!cut) return EMPTY_PLAYS;
  const order = new Map(cut.playIds.map((id, i) => [id, i]));
  return Object.values(playsByFilm)
    .flat()
    .filter((p) => order.has(p.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export function filmById(films: Film[], id: string): Film | undefined {
  return films.find((f) => f.id === id);
}
