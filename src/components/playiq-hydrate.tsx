import { useEffect } from "react";
import { usePlayiqStore } from "@/lib/store/playiq-store";

/** Client-only rehydrate for zustand persist (SSR-safe). */
export function PlayiqHydrate() {
  useEffect(() => {
    const result = usePlayiqStore.persist.rehydrate();
    void Promise.resolve(result).then(() => {
      usePlayiqStore.getState().setHydrated(true);
    });
  }, []);
  return null;
}
