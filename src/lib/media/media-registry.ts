/**
 * Session-only media blobs keyed by film id (not persisted — browser memory).
 * Enables cut assembly + local vision after upload without cloud storage.
 */

export type RegisteredMedia = {
  filmId: string;
  fileName: string;
  blob: Blob;
  objectUrl: string;
  registeredAt: number;
};

const byFilm = new Map<string, RegisteredMedia>();

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
}
