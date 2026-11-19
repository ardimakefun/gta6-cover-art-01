// Wires the editor: photos, layout and grade pickers, caption editing,
// panel selection and crop (drag to pan, wheel to zoom), undo/redo and PNG
// export. A `?shot=` query sets up a fixed scene for a screenshot instead.
import { drawCover, renderCoverToCanvas } from './engine.js';
import { LAYOUTS, layoutPanels } from './layouts.js';
import { GRADES } from './grades.js';
import {
  EXPORT_SIZES,
  createCoverState,
  createHistory,
  defaultPanels,
  retargetPanels,
  snapshotState,
} from './state.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const state = createCoverState();
const history = createHistory(state);
let redrawQueued = false;

const SAMPLES = [
  { file: 'boulevard.jpg', name: 'Boulevard' },
  { file: 'pier.jpg', name: 'Pier' },
  { file: 'scooter.jpg', name: 'Scooter' },
  { file: 'boardwalk.jpg', name: 'Boardwalk' },
  { file: 'convertible.jpg', name: 'Convertible' },
];

function setStatus(text) {
  statusEl.textContent = text;
}

/** Redraws the preview at the selected export aspect. In a cover shot the
 *  canvas is drawn at the viewport size (up to the 1280 px gate) so the
 *  screenshot is crisp; in the editor it is capped at 900 px. */
function redraw(quality = 'full') {
  const size = EXPORT_SIZES.find((s) => s.id === state.exportSize) || EXPORT_SIZES[0];
  const coverMode = document.body.classList.contains('shot-cover');
  const cap = coverMode ? 1280 : 900;
  const scale = Math.min(1, cap / Math.max(size.w, size.h));
  canvas.width = Math.round(size.w * scale);
  canvas.height = Math.round(size.h * scale);
  drawCover(canvas, state, { quality, selected: state.selected });
}

function queueRedraw(quality = 'full') {
  if (redrawQueued) return;
  redrawQueued = true;
  requestAnimationFrame(() => {
    redrawQueued = false;
    redraw(quality);
  });
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadSample(file) {
  const img = await loadImage(`samples/${file}`);
  state.photos.push(img);
  state.photoNames.push(file);
  return img;
}

async function addUploadedPhoto(file) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  state.photos.push(img);
  state.photoNames.push(file.name);
  return img;
}

function syncPanels() {
  const count = state.photos.length;
  state.panels = state.panels.map((p) => ({
    ...p,
    photo: count > 0 ? p.photo % count : 0,
  }));
}

// ---- control builders ------------------------------------------------

function buildPickers() {
  const layoutBox = document.getElementById('layouts');
  LAYOUTS.forEach((l) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.textContent = l.name;
    b.dataset.layout = l.id;
    b.addEventListener('click', () => {
      if (state.layout === l.id) return;
      history.push();
      state.layout = l.id;
      retargetPanels(state, l.id);
      syncControls();
      redraw();
    });
    layoutBox.appendChild(b);
  });

  const gradeBox = document.getElementById('grades');
  GRADES.forEach((g) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick swatch';
    b.dataset.grade = g.id;
    b.title = g.name;
    const stops = g.stops.map(([at, c]) => `${c} ${Math.round(at * 100)}%`).join(', ');
    b.style.background = `linear-gradient(135deg, ${stops})`;
    b.textContent = g.name;
    b.addEventListener('click', () => {
      if (state.grade === g.id) return;
      history.push();
      state.grade = g.id;
      syncControls();
      redraw();
    });
    gradeBox.appendChild(b);
  });

  const sizeBox = document.getElementById('sizes');
  EXPORT_SIZES.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset.size = s.id;
    b.textContent = s.label;
    b.addEventListener('click', () => {
      if (state.exportSize === s.id) return;
      history.push();
      state.exportSize = s.id;
      syncControls();
      redraw();
    });
    sizeBox.appendChild(b);
  });

  const heatBox = document.getElementById('heat');
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick heat-star';
    b.textContent = '★'.repeat(i);
    b.dataset.heat = String(i);
    b.addEventListener('click', () => {
      if (state.heat === i) return;
      history.push();
      state.heat = i;
      syncControls();
      redraw();
    });
    heatBox.appendChild(b);
  }
}

function syncControls() {
  document.querySelectorAll('#layouts .pick').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#grades .pick').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  document.querySelectorAll('#sizes .pick').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === state.exportSize);
  });
  document.querySelectorAll('#heat .pick').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.heat) === state.heat);
  });
  document.getElementById('title').value = state.title;
  document.getElementById('subtitle').value = state.subtitle;
  renderPhotoTray();
  renderPanelTray();
  updateUndoButtons();
}

function renderPhotoTray() {
  const tray = document.getElementById('photos');
  tray.innerHTML = '';
  state.photos.forEach((img, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = state.photoNames[i] || `Photo ${i + 1}`;
    const thumb = document.createElement('canvas');
    thumb.width = 72;
    thumb.height = 72;
    const tctx = thumb.getContext('2d');
    const s = Math.max(72 / img.naturalWidth, 72 / img.naturalHeight);
    tctx.drawImage(img, (72 - img.naturalWidth * s) / 2, (72 - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    b.appendChild(thumb);
    b.addEventListener('click', () => {
      const slot = state.panels[state.selected];
      if (!slot || slot.photo === i) return;
      history.push();
      slot.photo = i;
      redraw();
    });
    tray.appendChild(b);
  });
  const add = document.createElement('label');
  add.className = 'thumb add';
  add.textContent = '+ photo';
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.hidden = true;
  input.addEventListener('change', async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    history.push();
    for (const f of files) await addUploadedPhoto(f);
    syncPanels();
    syncControls();
    redraw();
    setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} added. Click a photo, then a panel, to place it.`);
  });
  add.appendChild(input);
  tray.appendChild(add);
}

function renderPanelTray() {
  const tray = document.getElementById('panels');
  tray.innerHTML = '';
  state.panels.forEach((slot, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `panel-chip${i === state.selected ? ' active' : ''}`;
    b.textContent = `Panel ${i + 1} · ${(state.photoNames[slot.photo] || '—').replace(/\.[^.]+$/, '')}`;
    b.addEventListener('click', () => {
      state.selected = i;
      syncControls();
      redraw();
    });
    tray.appendChild(b);
  });
  const zoom = document.getElementById('zoom');
  const slot = state.panels[state.selected];
  zoom.value = slot ? String(Math.round(slot.transform.scale * 100)) : '100';
  document.getElementById('zoomLabel').textContent = `Zoom ${zoom.value}%`;
}

function updateUndoButtons() {
  document.getElementById('undo').disabled = !history.canUndo;
  document.getElementById('redo').disabled = !history.canRedo;
}

// ---- canvas interaction: select, drag to pan, wheel to zoom ----------

function panelAtPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const y = ((clientY - rect.top) / rect.height) * canvas.height;
  const geo = layoutPanels(state.layout, canvas.width, canvas.height);
  for (let i = geo.panels.length - 1; i >= 0; i--) {
    const p = geo.panels[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
  }
  return -1;
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const i = panelAtPoint(e.clientX, e.clientY);
  if (i < 0) return;
  state.selected = i;
  syncControls();
  redraw();
  const slot = state.panels[i];
  drag = {
    startX: e.clientX,
    startY: e.clientY,
    ox: slot.transform.ox,
    oy: slot.transform.oy,
    moved: false,
    before: snapshotState(state),
  };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const kx = canvas.width / rect.width;
  const ky = canvas.height / rect.height;
  const slot = state.panels[state.selected];
  const dx = (e.clientX - drag.startX) * kx;
  const dy = (e.clientY - drag.startY) * ky;
  if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
  slot.transform.ox = drag.ox + dx;
  slot.transform.oy = drag.oy + dy;
  queueRedraw('fast');
});
canvas.addEventListener('pointerup', () => {
  if (drag && drag.moved) {
    history.pushBefore(drag.before);
    redraw();
  }
  drag = null;
});

let wheelBefore = null;
let wheelTimer = null;
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const slot = state.panels[state.selected];
  if (!slot) return;
  if (!wheelBefore) wheelBefore = snapshotState(state);
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  slot.transform.scale = Math.max(0.5, Math.min(4, slot.transform.scale * factor));
  renderPanelTray();
  queueRedraw('fast');
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => {
    if (wheelBefore) {
      history.pushBefore(wheelBefore);
      wheelBefore = null;
      updateUndoButtons();
      redraw();
    }
  }, 700);
}, { passive: false });

// drag and drop photos onto the canvas
canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', async (e) => {
  e.preventDefault();
  const files = [...(e.dataTransfer.files || [])].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  history.push();
  for (const f of files) await addUploadedPhoto(f);
  syncPanels();
  syncControls();
  redraw();
  setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} dropped in.`);
});

// ---- export ----------------------------------------------------------

function downloadPNG(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function exportSize(size) {
  const off = renderCoverToCanvas(size.w, size.h, state);
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      downloadPNG(blob, `neon-coast-${size.w}x${size.h}.png`);
      resolve(blob);
    }, 'image/png');
  });
}

document.getElementById('export').addEventListener('click', async () => {
  const size = EXPORT_SIZES.find((s) => s.id === state.exportSize) || EXPORT_SIZES[0];
  await exportSize(size);
  setStatus(`Saved neon-coast-${size.w}x${size.h}.png`);
});
document.getElementById('exportAll').addEventListener('click', async () => {
  for (const size of EXPORT_SIZES) await exportSize(size);
  setStatus('Saved all four sizes.');
});
document.getElementById('undo').addEventListener('click', () => {
  if (history.undo()) {
    syncControls();
    redraw();
  }
});
document.getElementById('redo').addEventListener('click', () => {
  if (history.redo()) {
    syncControls();
    redraw();
  }
});
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) {
      if (history.redo()) {
        syncControls();
        redraw();
      }
    } else if (history.undo()) {
      syncControls();
      redraw();
    }
  }
});
document.getElementById('title').addEventListener('input', (e) => {
  state.title = e.target.value;
  queueRedraw();
});
document.getElementById('subtitle').addEventListener('input', (e) => {
  state.subtitle = e.target.value;
  queueRedraw();
});
let zoomBefore = null;
document.getElementById('zoom').addEventListener('input', (e) => {
  const slot = state.panels[state.selected];
  if (!slot) return;
  if (!zoomBefore) zoomBefore = snapshotState(state);
  slot.transform.scale = Number(e.target.value) / 100;
  document.getElementById('zoomLabel').textContent = `Zoom ${e.target.value}%`;
  queueRedraw('fast');
});
document.getElementById('zoom').addEventListener('change', () => {
  if (zoomBefore) {
    history.pushBefore(zoomBefore);
    zoomBefore = null;
  }
  updateUndoButtons();
  redraw();
});
document.getElementById('resetCrop').addEventListener('click', () => {
  const slot = state.panels[state.selected];
  if (!slot) return;
  history.push();
  slot.transform = { ox: 0, oy: 0, scale: 1 };
  syncControls();
  redraw();
});

// ---- boot ------------------------------------------------------------

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load('400 100px Anton'),
      document.fonts.load('400 100px Pacifico'),
      document.fonts.load('400 100px "Bebas Neue"'),
    ]);
    await document.fonts.ready;
  } catch {
    // fall back to system fonts; the cover still draws
  }
}

async function boot() {
  buildPickers();
  await ensureFonts();
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), {
      state,
      loadSample,
      redraw: () => redraw(),
      syncControls,
      history,
    });
  } else {
    for (const s of SAMPLES) await loadSample(s.file);
    state.panels = defaultPanels(state.layout, state.photos.length);
    syncControls();
    redraw();
  }
}

boot();
