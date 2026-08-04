import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildCutup } from "@/lib/core/cutups";
import { seedFilms, seedPlaysForFilm, withTagCounts } from "@/lib/core/seed";
import { applyAiToPlay } from "@/lib/core/tagging";
import type {
  Cutup,
  Film,
  FilmStatus,
  Play,
  PlayFilter,
  PlayTag,
  TagSource,
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
  selectPlay: (playId: string | null) => void;
  setLibraryQuery: (q: string) => void;
  setLibraryStatus: (s: FilmStatus | "all") => void;
  reanalyzeFilm: (filmId: string) => void;
  markFilmReady: (filmId: string) => void;
  createCutupFromFilter: (title: string, filmId: string | "all", filter: PlayFilter) => string;
  deleteCutup: (id: string) => void;
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

      reanalyzeFilm: (filmId) => {
        set((state) => {
          const plays = (state.playsByFilm[filmId] ?? EMPTY_PLAYS).map((p) =>
            applyAiToPlay(p, {
              side: p.side,
              down: p.down,
              distance: p.distance,
              yardLine: p.yardLine,
              yardsGained: p.yardsGained,
              visionHint:
                p.side === "offense"
                  ? "shotgun trips inside zone left"
                  : p.side === "defense"
                    ? "cover 3 sky pressure edge"
                    : "punt formation",
              isExplosive: (p.yardsGained ?? 0) >= 15,
              isScore: p.result === "touchdown",
              isTurnover: p.result === "turnover",
              isSpecial: p.side === "special",
            }),
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

      markFilmReady: (filmId) => {
        set((state) => ({
          films: state.films.map((f) =>
            f.id === filmId ? { ...f, status: "ready", aiProgress: 100 } : f,
          ),
        }));
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
    }),
    {
      name: "playiq-demo-v2",
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
      `week ${f.week}`.includes(q)
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
  const set = new Set(cut.playIds);
  return Object.values(playsByFilm)
    .flat()
    .filter((p) => set.has(p.id));
}

export function filmById(films: Film[], id: string): Film | undefined {
  return films.find((f) => f.id === id);
}
