/**
 * Open SVG formation diagrams — no proprietary play-drawer lock-in.
 * Generates accessible, print-friendly field sketches from ontology labels.
 */

export type FormationSvgInput = {
  /** Ontology or free label e.g. Shotgun, Trips, Cover 3 */
  label: string;
  width?: number;
  height?: number;
};

type Dot = { x: number; y: number; role: string };

function offenseDots(label: string): Dot[] {
  const l = label.toLowerCase();
  // OL + QB always
  const ol: Dot[] = [
    { x: 38, y: 52, role: "LT" },
    { x: 44, y: 52, role: "LG" },
    { x: 50, y: 52, role: "C" },
    { x: 56, y: 52, role: "RG" },
    { x: 62, y: 52, role: "RT" },
  ];
  if (/empty/.test(l)) {
    return [
      ...ol,
      { x: 50, y: 62, role: "QB" },
      { x: 18, y: 48, role: "WR" },
      { x: 28, y: 46, role: "WR" },
      { x: 72, y: 46, role: "WR" },
      { x: 82, y: 48, role: "WR" },
      { x: 68, y: 52, role: "TE" },
    ];
  }
  if (/trips|3x1|trey/.test(l)) {
    return [
      ...ol,
      { x: 50, y: 68, role: "QB" },
      { x: 50, y: 78, role: "RB" },
      { x: 18, y: 48, role: "X" },
      { x: 72, y: 46, role: "Z" },
      { x: 78, y: 50, role: "H" },
      { x: 84, y: 48, role: "Y" },
    ];
  }
  if (/bunch|stack/.test(l)) {
    return [
      ...ol,
      { x: 50, y: 68, role: "QB" },
      { x: 50, y: 78, role: "RB" },
      { x: 70, y: 48, role: "A" },
      { x: 74, y: 52, role: "B" },
      { x: 78, y: 48, role: "C" },
      { x: 22, y: 48, role: "X" },
    ];
  }
  if (/pistol/.test(l)) {
    return [
      ...ol,
      { x: 50, y: 64, role: "QB" },
      { x: 50, y: 76, role: "RB" },
      { x: 20, y: 48, role: "WR" },
      { x: 80, y: 48, role: "WR" },
      { x: 68, y: 52, role: "TE" },
    ];
  }
  if (/under|i-form|pro|goal|heavy|jumbo/.test(l)) {
    return [
      ...ol,
      { x: 50, y: 56, role: "QB" },
      { x: 50, y: 72, role: "FB" },
      { x: 50, y: 82, role: "TB" },
      { x: 68, y: 52, role: "TE" },
      { x: 20, y: 48, role: "WR" },
    ];
  }
  // Default shotgun 11
  return [
    ...ol,
    { x: 50, y: 68, role: "QB" },
    { x: 44, y: 76, role: "RB" },
    { x: 18, y: 48, role: "X" },
    { x: 82, y: 48, role: "Z" },
    { x: 68, y: 52, role: "Y" },
  ];
}

function defenseDots(label: string): Dot[] {
  const l = label.toLowerCase();
  const front: Dot[] = [
    { x: 38, y: 48, role: "DE" },
    { x: 46, y: 46, role: "DT" },
    { x: 54, y: 46, role: "DT" },
    { x: 62, y: 48, role: "DE" },
  ];
  const lbs: Dot[] = [
    { x: 42, y: 38, role: "LB" },
    { x: 50, y: 36, role: "LB" },
    { x: 58, y: 38, role: "LB" },
  ];
  if (/cover\s*2|tampa/.test(l)) {
    return [
      ...front,
      ...lbs,
      { x: 28, y: 22, role: "S" },
      { x: 72, y: 22, role: "S" },
      { x: 18, y: 40, role: "CB" },
      { x: 82, y: 40, role: "CB" },
    ];
  }
  if (/man|press|cover\s*1|cover\s*0/.test(l)) {
    return [
      ...front,
      { x: 50, y: 34, role: "LB" },
      { x: 40, y: 36, role: "LB" },
      { x: 50, y: 18, role: "S" },
      { x: 22, y: 38, role: "CB" },
      { x: 78, y: 38, role: "CB" },
      { x: 32, y: 28, role: "NB" },
      { x: 68, y: 28, role: "S" },
    ];
  }
  // Cover 3 default
  return [
    ...front,
    ...lbs,
    { x: 50, y: 18, role: "FS" },
    { x: 22, y: 28, role: "CB" },
    { x: 78, y: 28, role: "CB" },
    { x: 18, y: 42, role: "NB" },
  ];
}

function specialDots(): Dot[] {
  return [
    { x: 50, y: 70, role: "P" },
    { x: 50, y: 55, role: "LS" },
    { x: 40, y: 55, role: "G" },
    { x: 60, y: 55, role: "G" },
    { x: 30, y: 58, role: "W" },
    { x: 70, y: 58, role: "W" },
    { x: 50, y: 25, role: "R" },
  ];
}

export function dotsForLabel(label: string): Dot[] {
  const l = label.toLowerCase();
  if (/cover|man|press|tampa|blitz|pressure|defense/.test(l)) {
    return defenseDots(label);
  }
  if (/punt|field goal|fg|kick|special/.test(l)) {
    return specialDots();
  }
  return offenseDots(label);
}

/** Pure SVG markup — embed in React via dangerouslySetInnerHTML or img srcdoc. */
export function renderFormationSvg(input: FormationSvgInput): string {
  const w = input.width ?? 320;
  const h = input.height ?? 200;
  const dots = dotsForLabel(input.label);
  const title = input.label.trim() || "Formation";

  const circles = dots
    .map(
      (d) =>
        `<g transform="translate(${(d.x / 100) * w},${(d.y / 100) * h})">` +
        `<circle r="8" fill="#eceef2" stroke="#2a2f3a" stroke-width="1.5"/>` +
        `<text y="3" text-anchor="middle" font-size="7" font-family="system-ui,sans-serif" fill="#0a0b0d">${escapeXml(d.role)}</text>` +
        `</g>`,
    )
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${escapeXml(title)} formation diagram">` +
    `<rect width="100%" height="100%" fill="#0a0b0d"/>` +
    `<rect x="8" y="8" width="${w - 16}" height="${h - 16}" rx="8" fill="none" stroke="#2a2f3a" stroke-width="1"/>` +
    // yard lines
    Array.from({ length: 5 })
      .map((_, i) => {
        const y = 8 + ((h - 16) * (i + 1)) / 6;
        return `<line x1="12" y1="${y}" x2="${w - 12}" y2="${y}" stroke="#1a1d26" stroke-width="1"/>`;
      })
      .join("") +
    `<text x="16" y="24" fill="#6b7382" font-size="11" font-family="system-ui,sans-serif">${escapeXml(title)}</text>` +
    circles +
    `</svg>`
  );
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
