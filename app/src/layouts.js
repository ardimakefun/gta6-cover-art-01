// Panel geometry for the six cover layouts. Every layout returns panel rects
// (fractions of the canvas) plus the title block rect, for any canvas size.
// Title block sits at the foot; panels fill the space above it.

export const LAYOUTS = [
  { id: 'grid4', name: 'Four Panel', panels: 4 },
  { id: 'hero3', name: 'Hero + Three', panels: 4 },
  { id: 'fullbleed', name: 'Full Bleed', panels: 1 },
  { id: 'grid9', name: 'Nine Panel', panels: 9 },
  { id: 'tilted', name: 'Tilted Snapshots', panels: 4 },
  { id: 'story', name: 'Story', panels: 3 },
];

const GAP = 0.012; // panel gap as a fraction of the short side

/** Panel rects for a layout at canvas size (w, h). Returns { panels, title, frame }.
 *  panels: [{ x, y, w, h, rot }] in pixels. title: the title-block rect.
 *  frame: the outer poster frame rect. */
export function layoutPanels(layoutId, w, h) {
  const short = Math.min(w, h);
  const gap = Math.max(4, Math.round(short * GAP));
  const titleH = Math.round(h * 0.16);
  const bodyH = h - titleH;
  const pad = Math.round(short * 0.02);
  const x0 = pad;
  const y0 = pad;
  const bw = w - pad * 2;
  const bh = bodyH - pad;
  let panels = [];
  let tilted = false;

  if (layoutId === 'grid4') {
    const cw = (bw - gap) / 2;
    const ch = (bh - gap) / 2;
    panels = [
      { x: x0, y: y0, w: cw, h: ch, rot: 0 },
      { x: x0 + cw + gap, y: y0, w: cw, h: ch, rot: 0 },
      { x: x0, y: y0 + ch + gap, w: cw, h: ch, rot: 0 },
      { x: x0 + cw + gap, y: y0 + ch + gap, w: cw, h: ch, rot: 0 },
    ];
  } else if (layoutId === 'hero3') {
    const heroW = Math.round(bw * 0.6);
    const sideW = bw - heroW - gap;
    const sh = (bh - gap * 2) / 3;
    panels = [
      { x: x0, y: y0, w: heroW, h: bh, rot: 0 },
      { x: x0 + heroW + gap, y: y0, w: sideW, h: sh, rot: 0 },
      { x: x0 + heroW + gap, y: y0 + sh + gap, w: sideW, h: sh, rot: 0 },
      { x: x0 + heroW + gap, y: y0 + (sh + gap) * 2, w: sideW, h: sh, rot: 0 },
    ];
  } else if (layoutId === 'fullbleed') {
    panels = [{ x: 0, y: 0, w, h: bodyH, rot: 0 }];
  } else if (layoutId === 'grid9') {
    const cw = (bw - gap * 2) / 3;
    const ch = (bh - gap * 2) / 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        panels.push({ x: x0 + c * (cw + gap), y: y0 + r * (ch + gap), w: cw, h: ch, rot: 0 });
      }
    }
  } else if (layoutId === 'tilted') {
    tilted = true;
    const cw = Math.round(bw * 0.46);
    const ch = Math.round(bh * 0.44);
    const rots = [-0.06, 0.05, -0.04, 0.07];
    const spots = [
      [x0 + bw * 0.02, y0 + bh * 0.02],
      [x0 + bw * 0.52, y0 + bh * 0.04],
      [x0 + bw * 0.05, y0 + bh * 0.5],
      [x0 + bw * 0.5, y0 + bh * 0.52],
    ];
    panels = spots.map(([x, y], i) => ({ x, y, w: cw, h: ch, rot: rots[i] }));
  } else {
    // story: tall hero on top, two panels below (also fine at any aspect)
    const heroH = Math.round(bh * 0.55);
    const lowH = bh - heroH - gap;
    const lw = (bw - gap) / 2;
    panels = [
      { x: x0, y: y0, w: bw, h: heroH, rot: 0 },
      { x: x0, y: y0 + heroH + gap, w: lw, h: lowH, rot: 0 },
      { x: x0 + lw + gap, y: y0 + heroH + gap, w: lw, h: lowH, rot: 0 },
    ];
  }
  return {
    panels,
    tilted,
    title: { x: 0, y: bodyH, w, h: titleH },
    frame: { x: pad / 2, y: pad / 2, w: w - pad, h: h - pad },
  };
}
