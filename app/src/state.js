// Cover state: layout, grade, caption, photos and per-panel crops, with
// undo/redo over snapshots (photos themselves are not snapshotted, only
// their indices and transforms).
import { LAYOUTS } from './layouts.js';

export const EXPORT_SIZES = [
  { id: '1080x1080', label: '1080 x 1080', w: 1080, h: 1080 },
  { id: '1080x1350', label: '1080 x 1350', w: 1080, h: 1350 },
  { id: '1920x1080', label: '1920 x 1080', w: 1920, h: 1080 },
  { id: '1080x1920', label: '1080 x 1920 story', w: 1080, h: 1920 },
];

export function defaultPanels(layoutId, photoCount) {
  const layout = LAYOUTS.find((l) => l.id === layoutId) || LAYOUTS[0];
  const panels = [];
  for (let i = 0; i < layout.panels; i++) {
    panels.push({
      photo: photoCount > 0 ? i % photoCount : 0,
      transform: { ox: 0, oy: 0, scale: 1 },
    });
  }
  return panels;
}

export function createCoverState() {
  return {
    layout: 'grid4',
    grade: 'sunset',
    title: 'Neon Shore',
    subtitle: 'a golden hour story',
    heat: 4,
    photos: [],
    photoNames: [],
    panels: defaultPanels('grid4', 0),
    selected: 0,
    exportSize: '1080x1080',
  };
}

/** Resizes the panel list for a new layout, keeping assignments where the
 *  slot index still exists. */
export function retargetPanels(state, layoutId) {
  const layout = LAYOUTS.find((l) => l.id === layoutId) || LAYOUTS[0];
  const next = [];
  for (let i = 0; i < layout.panels; i++) {
    next.push(
      state.panels[i] || {
        photo: state.photos.length > 0 ? i % state.photos.length : 0,
        transform: { ox: 0, oy: 0, scale: 1 },
      },
    );
  }
  state.panels = next;
  state.selected = Math.min(state.selected, next.length - 1);
}

export function snapshotState(state) {
  return JSON.stringify({
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    heat: state.heat,
    panels: state.panels,
    selected: state.selected,
    exportSize: state.exportSize,
  });
}

export function restoreSnapshot(state, json) {
  const s = JSON.parse(json);
  state.layout = s.layout;
  state.grade = s.grade;
  state.title = s.title;
  state.subtitle = s.subtitle;
  state.heat = s.heat;
  state.panels = s.panels;
  state.selected = s.selected;
  state.exportSize = s.exportSize;
}

export function createHistory(state) {
  const undoStack = [];
  const redoStack = [];
  return {
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
    push() {
      undoStack.push(snapshotState(state));
      if (undoStack.length > 60) undoStack.shift();
      redoStack.length = 0;
    },
    /** Pushes a snapshot taken BEFORE a change (e.g. before a drag), so
     *  undo restores the pre-change state. */
    pushBefore(json) {
      undoStack.push(json);
      if (undoStack.length > 60) undoStack.shift();
      redoStack.length = 0;
    },
    undo() {
      if (!undoStack.length) return false;
      redoStack.push(snapshotState(state));
      restoreSnapshot(state, undoStack.pop());
      return true;
    },
    redo() {
      if (!redoStack.length) return false;
      undoStack.push(snapshotState(state));
      restoreSnapshot(state, redoStack.pop());
      return true;
    },
  };
}
