/**
 * Film media registry — session map + IndexedDB persistence.
 * Blobs stay on-device (no cloud upload) so cut assembly / real playback
 * survive refresh within the same browser profile.
 */

export type RegisteredMedia = {
  filmId: string;
  fileName: string;
  blob: Blob;
  objectUrl: string;
  registeredAt: number;
};

const DB_NAME = "playiq-media-v1";
const STORE = "films";
const byFilm = new Map<string, RegisteredMedia>();
let hydratePromise: Promise<number> | null = null;
let hydrated = false;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "filmId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
  });
}

type StoredRow = {
  filmId: string;
  fileName: string;
  blob: Blob;
  registeredAt: number;
};

async function idbPut(row: StoredRow): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB put failed"));
  });
  db.close();
}

async function idbDelete(filmId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(filmId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB delete failed"));
  });
  db.close();
}

async function idbClear(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB clear failed"));
  });
  db.close();
}

async function idbGetAll(): Promise<StoredRow[]> {
  const db = await openDb();
  const rows = await new Promise<StoredRow[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as StoredRow[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error("IDB getAll failed"));
  });
  db.close();
  return rows;
}

export function registerFilmMedia(filmId: string, file: Blob, fileName: string): RegisteredMedia {
  const prev = byFilm.get(filmId);
  if (prev) URL.revokeObjectURL(prev.objectUrl);
  const objectUrl = URL.createObjectURL(file);
  const rec: RegisteredMedia = {
    filmId,
    fileName,
    blob: file,
    objectUrl,
    registeredAt: Date.now(),
  };
  byFilm.set(filmId, rec);
  void idbPut({
    filmId,
    fileName,
    blob: file,
    registeredAt: rec.registeredAt,
  }).catch(() => {
    // Persistence optional — memory still works
  });
  return rec;
}

export function getFilmMedia(filmId: string): RegisteredMedia | undefined {
  return byFilm.get(filmId);
}

export function listRegisteredMedia(): RegisteredMedia[] {
  return Array.from(byFilm.values());
}

export function unregisterFilmMedia(filmId: string): void {
  const prev = byFilm.get(filmId);
  if (prev) URL.revokeObjectURL(prev.objectUrl);
  byFilm.delete(filmId);
  void idbDelete(filmId).catch(() => undefined);
  void import("./tracking-registry")
    .then(({ deleteTrackingArtifact }) => deleteTrackingArtifact(filmId))
    .catch(() => undefined);
}

/** Revoke all object URLs, clear memory + IDB (demo reset). */
export function clearAllMedia(): void {
  for (const rec of byFilm.values()) {
    URL.revokeObjectURL(rec.objectUrl);
  }
  byFilm.clear();
  void idbClear().catch(() => undefined);
  void import("./tracking-registry")
    .then(({ clearAllTrackingArtifacts }) => clearAllTrackingArtifacts())
    .catch(() => undefined);
}

/**
 * Load persisted media into memory (call once on app hydrate).
 * Never overwrites a newer in-memory registration (race-safe with late upload).
 */
export async function hydrateMediaRegistry(): Promise<number> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const rows = await idbGetAll();
      let n = 0;
      for (const row of rows) {
        if (!row?.filmId || !row.blob) continue;
        const prev = byFilm.get(row.filmId);
        const rowAt = row.registeredAt || 0;
        // Keep memory if it is newer or equal (upload won the race).
        if (prev && prev.registeredAt >= rowAt) {
          continue;
        }
        if (prev) URL.revokeObjectURL(prev.objectUrl);
        byFilm.set(row.filmId, {
          filmId: row.filmId,
          fileName: row.fileName || "film.mp4",
          blob: row.blob,
          objectUrl: URL.createObjectURL(row.blob),
          registeredAt: rowAt || Date.now(),
        });
        n += 1;
      }
      hydrated = true;
      return n;
    } catch {
      hydrated = true;
      return 0;
    }
  })();
  return hydratePromise;
}

export function isMediaRegistryHydrated(): boolean {
  return hydrated;
}

export function hasFilmMedia(filmId: string): boolean {
  return byFilm.has(filmId);
}
