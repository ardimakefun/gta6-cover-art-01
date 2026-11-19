// Colour grades: each grade is a gradient map (luminance -> colour) plus a
// tint and a mix strength. The map is a 256-entry lookup built once per grade.

export const GRADES = [
  {
    id: 'sunset',
    name: 'Sunset',
    // deep violet shadows -> orange mid -> warm cream highlights
    stops: [[0, '#1c1033'], [0.35, '#7a2d5e'], [0.65, '#e2603a'], [0.85, '#ffb347'], [1, '#fff3c4']],
    mix: 0.72,
    tint: 'rgba(255, 110, 60, 0.10)',
  },
  {
    id: 'neon',
    name: 'Neon Vice',
    // teal shadows -> magenta mid -> hot pink highlights
    stops: [[0, '#04121f'], [0.35, '#0e4d5c'], [0.65, '#b3127f'], [0.85, '#ff4fd8'], [1, '#ffe3f6']],
    mix: 0.78,
    tint: 'rgba(255, 40, 180, 0.10)',
  },
  {
    id: 'dusk',
    name: 'Dusk',
    // near-black violet -> indigo -> lavender
    stops: [[0, '#0b0618'], [0.4, '#2d1b4e'], [0.7, '#6d4bb0'], [0.9, '#c9a7ff'], [1, '#f2e9ff']],
    mix: 0.7,
    tint: 'rgba(120, 80, 255, 0.10)',
  },
  {
    id: 'mono',
    name: 'Mono Noir',
    // pure black and white with a warm silver mid
    stops: [[0, '#000000'], [0.5, '#8f8a80'], [1, '#ffffff']],
    mix: 0.85,
    tint: 'rgba(255, 255, 255, 0.05)',
  },
  {
    id: 'teal',
    name: 'Teal Coast',
    // deep sea -> teal -> aqua -> sand
    stops: [[0, '#03181c'], [0.35, '#0b5e5e'], [0.65, '#1fae8f'], [0.85, '#ffd98a'], [1, '#fff7dd']],
    mix: 0.72,
    tint: 'rgba(20, 200, 170, 0.10)',
  },
];

const lutCache = new Map();

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 256-entry RGB lookup for a grade: lut[i] = [r, g, b] for luminance i. */
export function gradeLookup(gradeId) {
  if (lutCache.has(gradeId)) return lutCache.get(gradeId);
  const grade = GRADES.find((g) => g.id === gradeId) || GRADES[0];
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = grade.stops[0];
    let b = grade.stops[grade.stops.length - 1];
    for (let s = 0; s < grade.stops.length - 1; s++) {
      if (t >= grade.stops[s][0] && t <= grade.stops[s + 1][0]) {
        a = grade.stops[s];
        b = grade.stops[s + 1];
        break;
      }
    }
    const span = b[0] - a[0] || 1;
    const f = Math.max(0, Math.min(1, (t - a[0]) / span));
    const ca = hexRgb(a[1]);
    const cb = hexRgb(b[1]);
    lut[i * 3] = Math.round(ca[0] + (cb[0] - ca[0]) * f);
    lut[i * 3 + 1] = Math.round(ca[1] + (cb[1] - ca[1]) * f);
    lut[i * 3 + 2] = Math.round(ca[2] + (cb[2] - ca[2]) * f);
  }
  lutCache.set(gradeId, lut);
  return lut;
}

/** Applies a grade's gradient map to an ImageData in place (mix with original). */
export function applyGradeToPixels(imageData, gradeId) {
  const grade = GRADES.find((g) => g.id === gradeId) || GRADES[0];
  const lut = gradeLookup(gradeId);
  const d = imageData.data;
  const mix = grade.mix;
  for (let i = 0; i < d.length; i += 4) {
    const lum = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    const o = lum * 3;
    d[i] = Math.round(d[i] + (lut[o] - d[i]) * mix);
    d[i + 1] = Math.round(d[i + 1] + (lut[o + 1] - d[i + 1]) * mix);
    d[i + 2] = Math.round(d[i + 2] + (lut[o + 2] - d[i + 2]) * mix);
  }
}
