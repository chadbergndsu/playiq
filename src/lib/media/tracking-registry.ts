/**
 * Tracking artifacts stay on-device in IndexedDB beside local film media.
 * They can be regenerated from the original video and are never sent to PlayIQ.
 */

import type { TrackingArtifact } from "@/lib/core/tracking";

const DB_NAME = "playiq-tracking-v1";
const STORE = "artifacts";
const memory = new Map<string, TrackingArtifact>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "filmId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Tracking DB open failed"));
  });
}

export async function saveTrackingArtifact(artifact: TrackingArtifact): Promise<void> {
  memory.set(artifact.filmId, artifact);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(artifact);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Tracking save failed"));
  });
  db.close();
}

export async function loadTrackingArtifact(filmId: string): Promise<TrackingArtifact | null> {
  const cached = memory.get(filmId);
  if (cached) return cached;
  try {
    const db = await openDb();
    const artifact = await new Promise<TrackingArtifact | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(filmId);
      request.onsuccess = () => resolve((request.result as TrackingArtifact | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Tracking load failed"));
    });
    db.close();
    if (artifact) memory.set(filmId, artifact);
    return artifact;
  } catch {
    return null;
  }
}

export async function deleteTrackingArtifact(filmId: string): Promise<void> {
  memory.delete(filmId);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(filmId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Tracking delete failed"));
  });
  db.close();
}

export async function clearAllTrackingArtifacts(): Promise<void> {
  memory.clear();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Tracking clear failed"));
  });
  db.close();
}
