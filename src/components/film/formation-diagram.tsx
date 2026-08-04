import { useMemo } from "react";
import { renderFormationSvg } from "@/lib/core/formation-svg";

export function FormationDiagram({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const svg = useMemo(() => renderFormationSvg({ label, width: 360, height: 200 }), [label]);
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: svg }}
      // SVG is generated from trusted pure function (no user HTML)
    />
  );
}
