import { useEffect, useMemo, useRef, useState } from "react";
import {
  trackingFrameAt,
  type TrackingArtifact,
  type TrackingDetection,
} from "@/lib/core/tracking";

type DisplayRect = { left: number; top: number; width: number; height: number };

function fittedRect(
  containerWidth: number,
  containerHeight: number,
  mediaWidth: number,
  mediaHeight: number,
): DisplayRect {
  if (containerWidth <= 0 || containerHeight <= 0 || mediaWidth <= 0 || mediaHeight <= 0) {
    return { left: 0, top: 0, width: containerWidth, height: containerHeight };
  }
  const containerAspect = containerWidth / containerHeight;
  const mediaAspect = mediaWidth / mediaHeight;
  if (containerAspect > mediaAspect) {
    const height = containerHeight;
    const width = height * mediaAspect;
    return { left: (containerWidth - width) / 2, top: 0, width, height };
  }
  const width = containerWidth;
  const height = width / mediaAspect;
  return { left: 0, top: (containerHeight - height) / 2, width, height };
}

function labelFor(detection: TrackingDetection, confirmedJerseys: ReadonlySet<number>): string {
  if (detection.kind === "ball") return "BALL";
  if (detection.jerseyNumber != null) {
    return confirmedJerseys.has(detection.jerseyNumber)
      ? `#${detection.jerseyNumber}`
      : `#${detection.jerseyNumber}?`;
  }
  return detection.trackId.replace("player-", "P");
}

export function TrackingOverlay({
  artifact,
  currentSec,
  displayWidth,
  displayHeight,
  confirmedJerseys = [],
  onConfirmJersey,
}: {
  artifact: TrackingArtifact;
  currentSec: number;
  displayWidth?: number;
  displayHeight?: number;
  confirmedJerseys?: number[];
  onConfirmJersey?: (number: number, confidence: number) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<DisplayRect>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  const frame = trackingFrameAt(artifact, currentSec);
  const confirmed = useMemo(() => new Set(confirmedJerseys), [confirmedJerseys]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const update = () => {
      setRect(
        fittedRect(
          root.clientWidth,
          root.clientHeight,
          displayWidth ?? artifact.width,
          displayHeight ?? artifact.height,
        ),
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, [artifact.width, artifact.height, displayWidth, displayHeight]);

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-10"
      aria-label="Computer vision tracking overlay"
    >
      <div
        className="absolute"
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        }}
      >
        {frame?.detections.map((detection, detectionIndex) => {
          const isBall = detection.kind === "ball";
          const suggested =
            detection.jerseyNumber != null &&
            detection.jerseyConfidence != null &&
            !confirmed.has(detection.jerseyNumber);
          const style = {
            left: `${detection.box.x * 100}%`,
            top: `${detection.box.y * 100}%`,
            width: `${detection.box.width * 100}%`,
            height: `${detection.box.height * 100}%`,
          };
          const className = isBall
            ? "absolute rounded-full border-2 border-amber-300 bg-amber-300/10 shadow-[0_0_0_1px_rgba(0,0,0,.7)]"
            : suggested
              ? "absolute border-2 border-cyan-300 bg-cyan-300/5 shadow-[0_0_0_1px_rgba(0,0,0,.7)]"
              : "absolute border-2 border-emerald-300 bg-emerald-300/5 shadow-[0_0_0_1px_rgba(0,0,0,.7)]";

          if (suggested && onConfirmJersey) {
            return (
              <button
                key={`${detection.trackId}-${frame.t}-${detectionIndex}`}
                type="button"
                className={`${className} pointer-events-auto cursor-pointer`}
                style={style}
                title={`Confirm #${detection.jerseyNumber} (${Math.round((detection.jerseyConfidence ?? 0) * 100)}%)`}
                onClick={() =>
                  onConfirmJersey(
                    detection.jerseyNumber as number,
                    detection.jerseyConfidence as number,
                  )
                }
              >
                <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-black/80 px-1 py-0.5 text-[10px] font-semibold text-white">
                  {labelFor(detection, confirmed)}
                </span>
              </button>
            );
          }

          return (
            <div
              key={`${detection.trackId}-${frame.t}-${detectionIndex}`}
              className={className}
              style={style}
            >
              <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-black/80 px-1 py-0.5 text-[10px] font-semibold text-white">
                {labelFor(detection, confirmed)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
