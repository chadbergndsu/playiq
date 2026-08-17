import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSchoolUnlock, unlockSchool } from "@/lib/school/school-client";

export const Route = createFileRoute("/join")({
  component: JoinSchoolPage,
});

function JoinSchoolPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getSchoolUnlock().unlocked) {
      void navigate({ to: "/app" });
    }
  }, [navigate]);

  return (
    <main className="grid min-h-[calc(100dvh-var(--grok-banner-h,0px))] place-items-center bg-bg p-6 text-fg">
      <div className="panel w-full max-w-sm space-y-5 p-6 sm:p-7">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] bg-fg text-bg">
            <Clapperboard className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
              PlayIQ
            </p>
            <h1 className="text-lg font-semibold tracking-tight">Enter school code</h1>
          </div>
        </div>
        <p className="text-sm text-fg-muted">
          Staff get a school code from their admin. This unlocks the film room for your
          school workspace — it is not a student login.
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            void unlockSchool(code)
              .then(() => navigate({ to: "/app" }))
              .catch((err) => {
                setError(err instanceof Error ? err.message : "Unlock failed");
              })
              .finally(() => setBusy(false));
          }}
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="School code"
            autoComplete="off"
            spellCheck={false}
            aria-label="School code"
            required
            minLength={4}
          />
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy || code.trim().length < 4}>
            {busy ? "Checking…" : "Unlock film room"}
          </Button>
        </form>
      </div>
    </main>
  );
}
