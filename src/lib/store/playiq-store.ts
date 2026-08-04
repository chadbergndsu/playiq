import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildCutup } from "@/lib/core/cutups";
import { playToSignal } from "@/lib/core/llm-tagging";
import { seedFilms, seedPlaysForFilm, withTagCounts } from "@/lib/core/seed";
import { applyAiToPlay, mergeTags } from "@/lib/core/tagging";
import { createUploadedFilm, finalizeUploadedFilm } from "@/lib/core/upload";
import { newShareToken } from "@/lib/core/export";
import { mergeOfpIntoLibrary, type OpenFilmPackage } from "@/lib/core/ofp";
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

function initialState() {
  const films = seedFilms();
  const playsByFilm: Record<string, Play[]> = {};
  for (const f of films) {
    playsByFilm[f.id] = seedPlaysForFilm(f);
  }
  const withCounts = withTagCounts(films, playsByFilm);
  const allPlays = Object.values(playsByFilm).flat();
  const cutups: Cutup[] = [
    buildCutup({
      id: "cut_demo_3rd",
      title: "3rd down offense — Week 1–4",
      description: "Quick teach reel for 3rd down call sheet review.",
      plays: allPlays,
      filter: {
        query: "",
        side: "offense",
        concept: "all",
        down: 3,
        source: "all",
      },
    }),
    buildCutup({
      id: "cut_demo_explosive",
      title: "Explosive gains",
      description: "Any play tagged Explosive by AI or coach.",
      plays: allPlays,
      filter: {
        query: "Explosive",
        side: "all",
        concept: "all",
        down: "all",
        source: "all",
      },
    }),
  ];
  return { films: withCounts, playsByFilm, cutups };
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
  }) => string;
  createCutupFromFilter: (title: string, filmId: string | "all", filter: PlayFilter) => string;
  deleteCutup: (id: string) => void;
  renameCutup: (id: string, title: string) => void;
  removePlayFromCutup: (cutupId: string, playId: string) => void;
  ensureCutupShareToken: (cutupId: string) => string | null;
  /** Import Open Film Package (portable coach exchange). */
  importOfp: (pkg: OpenFilmPackage) => { films: number; plays: number };
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
        set((state) => {
          const playsByFilm = { ...state.playsByFilm, [film.id]: plays };
          const films = withTagCounts([film, ...state.films], playsByFilm);
          return { films, playsByFilm };
        });
        // Simulate encode + AI pipeline finishing shortly after upload
        const id = film.id;
        setTimeout(() => {
          set((state) => {
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

      importOfp: (pkg) => {
        const state = get();
        const merged = mergeOfpIntoLibrary(
          { films: state.films, playsByFilm: state.playsByFilm },
          pkg,
        );
        const films = withTagCounts(merged.films, merged.playsByFilm);
        set({ films, playsByFilm: merged.playsByFilm });
        return { films: merged.importedFilms, plays: merged.importedPlays };
      },
    }),
    {
      name: "playiq-demo-v3",
      skipHydration: true,
      partialize: (s) => ({
        films: s.films,
        playsByFilm: s.playsByFilm,
        cutups: s.cutups,
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
