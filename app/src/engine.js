// The cover engine: draws a whole poster cover onto a 2D canvas from the
// app state. Vanilla canvas, no libraries. Deterministic: same state and
// size always draw the same pixels (seeded grain, no timestamps, no random).
import { layoutPanels } from './layouts.js';
import { GRADES, applyGradeToPixels } from './grades.js';

const TITLE_GRADIENTS = {
  sunset: ['#ffe259', '#ffa751', '#ff5e62', '#c026d3'],
  neon: ['#7df9ff', '#ff4fd8', '#ff2e88'],
  dusk: ['#e9d5ff', '#a78bfa', '#6d28d9'],
  mono: ['#ffffff', '#d4d4d4', '#8f8a80'],
  teal: ['#fef08a', '#5eead4', '#0d9488'],
};

const SUBTITLE_COLORS = {
  sunset: '#ffb347',
  neon: '#ff4fd8',
  dusk: '#c9a7ff',
  mono: '#ffffff',
  teal: '#5eead4',
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let grainPattern = null;
function getGrainPattern(ctx) {
  if (grainPattern) return grainPattern;
  const size = 192;
  const noise = document.createElement('canvas');
  noise.width = size;
  noise.height = size;
  const nctx = noise.getContext('2d');
  const img = nctx.createImageData(size, size);
  const rnd = mulberry32(20261119);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  grainPattern = ctx.createPattern(noise, 'repeat');
  return grainPattern;
}

/** Cover-fits a photo into a rect with a pan/zoom transform, drawing it. */
function drawPhotoInPanel(pctx, photo, rect, transform) {
  const { ox = 0, oy = 0, scale = 1 } = transform || {};
  const iw = photo.naturalWidth || photo.width;
  const ih = photo.naturalHeight || photo.height;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const dw = iw * base * scale;
  const dh = ih * base * scale;
  const maxOx = Math.max(0, (dw - rect.w) / 2);
  const maxOy = Math.max(0, (dh - rect.h) / 2);
  const cx = Math.max(-maxOx, Math.min(maxOx, ox));
  const cy = Math.max(-maxOy, Math.min(maxOy, oy));
  pctx.drawImage(photo, (rect.w - dw) / 2 + cx, (rect.h - dh) / 2 + cy, dw, dh);
}

/** Renders one panel (photo + grade + ink) onto its own canvas, returns it. */
function renderPanel(panel, photo, gradeId, quality) {
  const w = Math.max(2, Math.round(panel.w));
  const h = Math.max(2, Math.round(panel.h));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a0b26';
  ctx.fillRect(0, 0, w, h);
  if (photo) {
    drawPhotoInPanel(ctx, photo, { w, h }, panel.transform);
    if (quality === 'full') {
      const img = ctx.getImageData(0, 0, w, h);
      applyGradeToPixels(img, gradeId);
      ctx.putImageData(img, 0, 0);
    } else {
      const grade = GRADES.find((g) => g.id === gradeId) || GRADES[0];
      ctx.fillStyle = grade.tint;
      ctx.fillRect(0, 0, w, h);
    }
  } else {
    ctx.fillStyle = '#241533';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.font = `700 ${Math.round(h * 0.08)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('ADD PHOTO', w / 2, h / 2);
  }
  return c;
}

/** Inked poster border around a panel rect, plus a banded corner strip. */
function drawPanelInk(ctx, rect, short) {
  const lw = Math.max(2, Math.round(short * 0.008));
  ctx.save();
  ctx.strokeStyle = 'rgba(10, 4, 18, 0.9)';
  ctx.lineWidth = lw;
  ctx.strokeRect(rect.x + lw / 2, rect.y + lw / 2, rect.w - lw, rect.h - lw);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = Math.max(1, Math.round(short * 0.002));
  ctx.strokeRect(rect.x + lw + 1, rect.y + lw + 1, rect.w - lw * 2 - 2, rect.h - lw * 2 - 2);
  // banded strip: diagonal stripes across the panel's top-left corner
  const band = Math.round(short * 0.035);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, band * 2.2, band);
  ctx.clip();
  for (let i = -2; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 215, 106, 0.9)' : 'rgba(255, 47, 179, 0.9)';
    ctx.save();
    ctx.translate(rect.x + i * (band / 2), rect.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(0, -band, band / 2, band * 3);
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();
}

function drawStar(ctx, x, y, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(ang) * rad;
    const py = y + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = '#ffd76a';
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.stroke();
  }
}

/** Halftone dot band: dots whose radius fades left to right. */
function drawHalftone(ctx, rect, short) {
  const step = Math.max(6, Math.round(short * 0.014));
  const maxR = step * 0.42;
  for (let y = rect.y + step / 2; y < rect.y + rect.h; y += step) {
    for (let x = rect.x + step / 2; x < rect.x + rect.w; x += step) {
      const f = 1 - (x - rect.x) / rect.w;
      const r = maxR * (0.25 + 0.75 * f * f);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function fitFont(ctx, text, maxWidth, startSize, family, weight) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/** The title block: halftone band, Anton title with gradient, Pacifico
 *  subtitle with neon glow, badge ribbon and heat meter. */
function drawTitleBlock(ctx, rect, state, short) {
  const { title, subtitle, heat, grade } = state;
  ctx.save();
  // band background
  ctx.fillStyle = '#12081d';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  drawHalftone(ctx, { x: rect.x, y: rect.y, w: rect.w, h: rect.h * 0.45 }, short);
  // neon top line
  const grad = ctx.createLinearGradient(rect.x, 0, rect.x + rect.w, 0);
  grad.addColorStop(0, '#ffd76a');
  grad.addColorStop(0.5, '#ff2fb3');
  grad.addColorStop(1, '#7df9ff');
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, Math.max(2, Math.round(short * 0.006)));
  // banded strip under the neon line
  const bandH = Math.max(4, Math.round(short * 0.012));
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y + Math.max(2, Math.round(short * 0.006)), rect.w, bandH);
  ctx.clip();
  for (let i = 0; i < Math.ceil(rect.w / bandH) + 2; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 215, 106, 0.85)' : 'rgba(20, 10, 30, 0.9)';
    ctx.save();
    ctx.translate(rect.x + i * bandH, rect.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(0, -bandH * 2, bandH, bandH * 4);
    ctx.restore();
  }
  ctx.restore();

  const padX = rect.w * 0.04;
  const text = (title || 'UNTITLED').trim().toUpperCase();
  const titleTop = rect.y + rect.h * 0.42;
  const titleSize = fitFont(
    ctx,
    text,
    rect.w * 0.78,
    Math.round(rect.h * 0.44),
    'Anton, sans-serif',
    400,
  );
  const stops = TITLE_GRADIENTS[grade] || TITLE_GRADIENTS.sunset;
  const tgrad = ctx.createLinearGradient(0, titleTop - titleSize, 0, titleTop + titleSize * 0.2);
  stops.forEach((c, i) => tgrad.addColorStop(i / (stops.length - 1), c));
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = Math.max(1, titleSize * 0.045);
  ctx.strokeText(text, rect.x + padX, titleTop);
  ctx.fillStyle = tgrad;
  ctx.fillText(text, rect.x + padX, titleTop);
  ctx.shadowColor = 'rgba(255, 47, 179, 0.8)';
  ctx.shadowBlur = titleSize * 0.25;
  ctx.fillText(text, rect.x + padX, titleTop);
  ctx.shadowBlur = 0;

  // subtitle in neon script
  const sub = (subtitle || '').trim();
  if (sub) {
    const subSize = Math.round(rect.h * 0.2);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = SUBTITLE_COLORS[grade] || SUBTITLE_COLORS.sunset;
    ctx.shadowColor = SUBTITLE_COLORS[grade] || SUBTITLE_COLORS.sunset;
    ctx.shadowBlur = subSize * 0.6;
    ctx.fillText(sub, rect.x + padX, rect.y + rect.h * 0.88);
    ctx.shadowBlur = 0;
  }

  // heat meter: five stars, `heat` of them lit
  const starR = Math.round(rect.h * 0.11);
  const starGap = starR * 2.3;
  const starsW = starGap * 4 + starR * 2;
  const sx = rect.x + rect.w - padX - starsW;
  const sy = rect.y + rect.h * 0.3;
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, sx + starR + i * starGap, sy, starR, i < heat);
  }
  ctx.font = `700 ${Math.round(rect.h * 0.13)}px "Bebas Neue", sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.textAlign = 'right';
  ctx.fillText('HEAT', rect.x + rect.w - padX, rect.y + rect.h * 0.62);

  // badge ribbon: rotated tag at the block's right edge
  const badge = 'NEON COAST';
  ctx.save();
  ctx.translate(rect.x + rect.w - padX - starsW / 2, rect.y + rect.h * 0.82);
  ctx.rotate(-0.03);
  ctx.font = `400 ${Math.round(rect.h * 0.16)}px "Bebas Neue", sans-serif`;
  const bw = ctx.measureText(badge).width + rect.h * 0.22;
  const bh = rect.h * 0.24;
  ctx.fillStyle = '#ff2fb3';
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-bw / 2 + 2, -bh / 2 + 2, bw - 4, bh - 4);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, 0, 1);
  ctx.restore();
  ctx.restore();
}

function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0.30)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawGrain(ctx, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = getGrainPattern(ctx);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Draws the whole cover. state: { layout, grade, title, subtitle, heat,
 *  photos: [Image], panels: [{ photo, transform }] }.
 *  opts: { quality: 'full' | 'fast', selected: panelIndex | -1 } */
export function drawCover(canvas, state, opts = {}) {
  const { quality = 'full', selected = -1 } = opts;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const short = Math.min(w, h);
  ctx.fillStyle = '#14091f';
  ctx.fillRect(0, 0, w, h);

  const geo = layoutPanels(state.layout, w, h);
  geo.panels.forEach((panel, i) => {
    const slot = state.panels[i] || { photo: 0, transform: { ox: 0, oy: 0, scale: 1 } };
    const photo = state.photos[slot.photo] || null;
    const rendered = renderPanel(
      { ...panel, transform: slot.transform },
      photo,
      state.grade,
      quality,
    );
    ctx.save();
    if (panel.rot) {
      ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
      ctx.rotate(panel.rot);
      ctx.translate(-panel.w / 2, -panel.h / 2);
      // polaroid frame: white border, thicker at the foot
      const frame = Math.round(short * 0.02);
      ctx.fillStyle = '#f8f4ec';
      ctx.fillRect(-frame, -frame, panel.w + frame * 2, panel.h + frame * 2 + frame * 2.2);
      ctx.drawImage(rendered, 0, 0);
      ctx.restore();
      drawPanelInk(ctx, { x: panel.x, y: panel.y, w: panel.w, h: panel.h }, short);
    } else {
      ctx.drawImage(rendered, panel.x, panel.y);
      ctx.restore();
      drawPanelInk(ctx, panel, short);
    }
    if (i === selected) {
      ctx.save();
      ctx.strokeStyle = '#7df9ff';
      ctx.lineWidth = Math.max(3, Math.round(short * 0.006));
      ctx.setLineDash([Math.round(short * 0.02), Math.round(short * 0.01)]);
      ctx.strokeRect(panel.x - 3, panel.y - 3, panel.w + 6, panel.h + 6);
      ctx.restore();
    }
  });

  // outer poster frame
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = Math.max(2, Math.round(short * 0.004));
  ctx.strokeRect(geo.frame.x, geo.frame.y, geo.frame.w, geo.frame.h);
  ctx.restore();

  drawTitleBlock(ctx, geo.title, state, short);
  drawVignette(ctx, w, h);
  drawGrain(ctx, w, h);
  return geo;
}

/** Renders the cover at (w, h) onto a fresh canvas and returns it. */
export function renderCoverToCanvas(w, h, state) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas, state, { quality: 'full' });
  return canvas;
}
