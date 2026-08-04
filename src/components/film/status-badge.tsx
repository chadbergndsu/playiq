import type { FilmStatus } from "@/lib/core/types";
import { Badge } from "@/components/ui/badge";

export function FilmStatusBadge({ status }: { status: FilmStatus }) {
  if (status === "ready") return <Badge tone="success">Ready</Badge>;
  if (status === "processing") return <Badge tone="warn">Analyzing</Badge>;
  return <Badge tone="accent">Needs review</Badge>;
}

export function TagSourceBadge({ source }: { source: "coach" | "ai" | "import" }) {
  if (source === "coach") return <Badge tone="coach">Coach</Badge>;
  if (source === "import") return <Badge tone="neutral">Import</Badge>;
  return <Badge tone="ai">AI</Badge>;
}
