import type { SchoolProfile } from "@/lib/core/school";

const STORAGE_KEY = "playiq-school-v1";

export type SchoolUnlockState = {
  unlocked: boolean;
  school: SchoolProfile | null;
  unlockedAt: string | null;
};

function readStorage(): SchoolUnlockState {
  if (typeof window === "undefined") {
    return { unlocked: false, school: null, unlockedAt: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { unlocked: false, school: null, unlockedAt: null };
    const parsed = JSON.parse(raw) as SchoolUnlockState;
    if (!parsed?.unlocked || !parsed.school) {
      return { unlocked: false, school: null, unlockedAt: null };
    }
    return parsed;
  } catch {
    return { unlocked: false, school: null, unlockedAt: null };
  }
}

export function getSchoolUnlock(): SchoolUnlockState {
  return readStorage();
}

export function clearSchoolUnlock(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export async function unlockSchool(code: string): Promise<SchoolUnlockState> {
  const res = await fetch("/api/school/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ code }),
  });
  const body = (await res.json()) as {
    ok?: boolean;
    school?: SchoolProfile;
    error?: string;
  };
  if (!res.ok || !body.ok || !body.school) {
    throw new Error(body.error || `School unlock failed (${res.status})`);
  }
  const state: SchoolUnlockState = {
    unlocked: true,
    school: body.school,
    unlockedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}
