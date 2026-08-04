import { useEffect } from "react";
import { hydrateMediaRegistry } from "@/lib/media/media-registry";
import { usePlayiqStore } from "@/lib/store/playiq-store";

/** Client-only rehydrate for zustand persist + local media IDB (SSR-safe). */
export function PlayiqHydrate() {
  useEffect(() => {
    const result = usePlayiqStore.persist.rehydrate();
    void Promise.resolve(result)
      .then(() => hydrateMediaRegistry())
      .then(() => {
        usePlayiqStore.getState().setHydrated(true);
      })
      .catch(() => {
        usePlayiqStore.getState().setHydrated(true);
      });
  }, []);
  return null;
}
