// Fixed scenes for screenshots: ?shot=editor shows the page with photos
// loaded; ?shot=cover shows the cover alone. Query params:
//   photo   sample file stem (boulevard, pier, scooter, boardwalk) or a
//           comma list to fill panels round-robin (default: all four)
//   caption title text (default: Neon Shore)
//   subtitle subtitle text
//   layout  grid4 | hero3 | fullbleed | grid9 | tilted | story
//   grade   sunset | neon | dusk | mono | teal
//   size    export size id (1080x1080, 1080x1350, 1920x1080, 1080x1920)
//   heat    1..5
// window.__shotReady is set once painted.
import { defaultPanels, retargetPanels } from './state.js';

const SAMPLE_FILES = ['boulevard.jpg', 'pier.jpg', 'scooter.jpg', 'boardwalk.jpg', 'convertible.jpg', 'neon.jpg', 'palms.jpg', 'bonfire.jpg', 'marina.jpg'];

export async function runShot(shot, query, ctx) {
  const { state, loadSample, redraw, syncControls } = ctx;
  if (shot === 'cover') document.body.classList.add('shot-cover');

  const wanted = (query.get('photo') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const files = wanted.length
    ? wanted.map((stem) => (stem.includes('.') ? stem : `${stem}.jpg`))
    : SAMPLE_FILES;
  for (const f of files) await loadSample(f);

  state.title = query.get('caption') || 'Neon Shore';
  state.subtitle = query.get('subtitle') || 'a golden hour story';
  const layout = query.get('layout');
  if (layout) state.layout = layout;
  const grade = query.get('grade');
  if (grade) state.grade = grade;
  const size = query.get('size');
  if (size) state.exportSize = size;
  const heat = Number(query.get('heat'));
  if (heat >= 1 && heat <= 5) state.heat = heat;

  state.panels = defaultPanels(state.layout, state.photos.length);
  retargetPanels(state, state.layout);
  syncControls();
  redraw();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
