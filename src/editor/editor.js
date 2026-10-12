// The editor: owns the track, camera, tools, playback clock and rendering.
// React components read its state through subscribe()/getState().
import { LineType, PHYSICS_RATE } from '../engine/constants.js';
import { EnergySeries, PX_PER_M, centre, energyAt, lowestY } from '../engine/energy.js';
import { RedLine, SceneryLine, StandardLine } from '../engine/lines.js';
import { SAMPLE_FLOOR_Y, buildSampleTrack } from '../engine/sample.js';
import { Track } from '../engine/track.js';
import { loadTrackJson, saveTrackJson } from '../engine/trackio.js';
import { drawGraph } from './graph.js';
import {
  COLORS,
  FONT_NUM,
  drawEnergyOverlays,
  drawFlagIcon,
  drawFloor,
  drawFloorLabel,
  drawLines,
  drawRider,
  drawRuler,
  drawStartMarker,
  makeView,
  roundRect,
} from './render.js';

const AUTOSAVE_KEY = 'energy-rider-autosave-v1';
const SETTINGS_KEY = 'energy-rider-settings-v2';
const OLD_SETTINGS_KEY = 'energy-rider-settings-v1';
const MIN_ZOOM = 0.02; // below linerider-advanced's 0.1 so long tracks still fit on a phone
const MAX_ZOOM = 24;
const SNAP_PX = 6; // snap radius in screen px (plus the line's own width)
const ERASER_PX = 7;
const PENCIL_MIN_PX = 6; // LRA PencilTool MINIMUM_LINE = 6 / zoom
const LINE_MIN = 0.01; // LRA LineTool MINIMUM_LINE

const store = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  set(key, v) {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* storage unavailable */
    }
  },
};

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Utility.SnapToDegrees / AngleLock
function snapToDegrees(sx, sy, ex, ey) {
  const deg = Math.hypot(sx - ex, sy - ey) > 1 ? 15 : 45;
  let a = (Math.atan2(ey - sy, ex - sx) * 180) / Math.PI;
  if (a < 0) a += 360;
  const snapped = (Math.round(a / deg) * deg) % 360;
  const rad = (snapped * Math.PI) / 180;
  const cx = Math.cos(rad),
    cy = Math.sin(rad);
  const d = (ex - sx) * cx + (ey - sy) * cy;
  let rx = sx + cx * d,
    ry = sy + cy * d;
  if (snapped === 90 || snapped === 270) rx = sx;
  if (snapped === 0 || snapped === 180) ry = sy;
  return [rx, ry];
}

const DEFAULT_SETTINGS = {
  showHeight: true,
  showVelocity: true,
  showRuler: true,
  colorPlayback: false, // lines turn black while Bob rides, as on linerider.com
  snap: true,
  showWorking: false,
  panel: 'graph', // 'graph' | 'log' | null
};

export class Editor {
  constructor() {
    this.listeners = new Set();
    const narrow = typeof window !== 'undefined' && window.innerWidth < 720;
    // settings saved before colour-while-riding became off by default keep
    // everything except that one choice
    let savedSettings = store.get(SETTINGS_KEY);
    if (!savedSettings) {
      const old = store.get(OLD_SETTINGS_KEY);
      if (old) {
        delete old.colorPlayback;
        savedSettings = old;
      }
    }
    const settings = { ...DEFAULT_SETTINGS, ...(narrow ? { panel: null } : {}), ...(savedSettings || {}) };
    this.state = {
      tool: 'pencil',
      lineType: LineType.Blue,
      redMultiplier: 1,
      sceneryWidth: 1,
      playing: false,
      frame: 0,
      flagFrame: null,
      speed: 1,
      mass: 60,
      floorY: SAMPLE_FLOOR_Y,
      trackName: 'Energy Valley (example)',
      rev: 0,
      zoom: 2,
      canUndo: false,
      canRedo: false,
      maxFrame: 0,
      floorPrompt: null,
      toast: null,
      music: null,
      readings: [],
      lineCount: 0,
      recording: false,
      ...settings,
    };
    this.track = null;
    this.undoStack = [];
    this.redoStack = [];
    this.cam = { x: 0, y: 0, zoom: 2 };
    this.series = new EnergySeries();
    this.view = { w: 1, h: 1, dpr: 1 };
    this.pointers = new Map();
    this.drag = null;
    this.hover = null;
    this.keys = new Set();
    this.dirty = true;
    this.frameFloat = 0;
    this.modalOpen = false;
    this.graphCanvas = null;
    this.audio = null;
    this._energyCache = { key: '', value: null };

    const saved = store.get(AUTOSAVE_KEY);
    let loaded = false;
    if (saved && saved.json) {
      try {
        const { track, meta } = loadTrackJson(saved.json);
        this._setTrack(track, meta, { keepView: false });
        if (saved.flagFrame != null) this.state.flagFrame = saved.flagFrame;
        loaded = true;
      } catch (e) {
        console.warn('Autosave could not be restored', e);
      }
    }
    if (!loaded) this.loadSample();
  }

  // ---------- store ----------
  subscribe = (fn) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;
  set(patch) {
    this.state = { ...this.state, ...patch };
    this.dirty = true;
    for (const fn of this.listeners) fn();
    const keys = Object.keys(patch);
    if (keys.some((k) => k in DEFAULT_SETTINGS)) {
      const s = {};
      for (const k of Object.keys(DEFAULT_SETTINGS)) s[k] = this.state[k];
      store.set(SETTINGS_KEY, s);
    }
  }
  /** Something about the track or energy reference changed. */
  changed(extra = {}) {
    // Bob must always start above the floor (GPE is never negative)
    const floorY = extra.floorY ?? this.state.floorY;
    const low0 = lowestY(this.track.getFrame(0));
    let movedFloor = false;
    if (floorY <= low0) {
      extra = { ...extra, floorY: Math.round((low0 + PX_PER_M) * 100) / 100 };
      movedFloor = true;
    }
    this.set({
      rev: this.state.rev + 1,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      lineCount: this.track.lines.size,
      ...extra,
    });
    if (movedFloor) this.toast('The floor moved down so that Bob starts above it.');
    // never leave the playhead below the floor
    const hit = this.floorFrame(this.state.frame);
    if (hit >= 0 && this.state.frame > hit) {
      this.frameFloat = hit;
      this.set({ frame: hit });
    }
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.autosave(), 600);
  }
  toast(text, kind = 'info') {
    const id = Date.now();
    this.set({ toast: { text, kind, id } });
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      if (this.state.toast?.id === id) this.set({ toast: null });
    }, 5200);
  }

  // ---------- track lifecycle ----------
  _setTrack(track, meta = {}, { keepView = false } = {}) {
    this.track = track;
    this.undoStack = [];
    this.redoStack = [];
    this.frameFloat = 0;
    const energy = meta.energy || {};
    let floorY = Number.isFinite(energy.floorY) ? energy.floorY : null;
    if (floorY === null) {
      const b = this._physBounds();
      floorY = b ? b.maxY + PX_PER_M : track.startY + 10 * PX_PER_M;
    }
    this.state = {
      ...this.state,
      playing: false,
      frame: 0,
      flagFrame: null,
      maxFrame: 0,
      floorY,
      mass: Number.isFinite(energy.mass) ? energy.mass : this.state.mass,
      trackName: meta.label || this.state.trackName,
      floorPrompt: null,
      readings: [],
    };
    if (!keepView) this.zoomToFit();
    this.changed();
  }

  _physBounds() {
    let b = null;
    for (const l of this.track.lines.values()) {
      if (!l.physical) continue;
      if (!b) b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      b.minX = Math.min(b.minX, l.x1, l.x2);
      b.maxX = Math.max(b.maxX, l.x1, l.x2);
      b.minY = Math.min(b.minY, l.y1, l.y2);
      b.maxY = Math.max(b.maxY, l.y1, l.y2);
    }
    return b;
  }

  loadSample() {
    this.stopMusic();
    const t = buildSampleTrack();
    this._setTrack(t, { label: 'Energy Valley (example)', energy: { floorY: SAMPLE_FLOOR_Y, mass: 60 } });
    this.viewRect(-300, -60, 760, SAMPLE_FLOOR_Y + 20);
  }

  /** Fit a world rectangle into the view (used for the example's opening shot). */
  viewRect(x1, y1, x2, y2) {
    const w = this.view.w > 10 ? this.view.w : 1200;
    const h = this.view.h > 10 ? this.view.h : 800;
    const z = Math.max(MIN_ZOOM, Math.min(4, Math.min((w * 0.85) / (x2 - x1), (h * 0.6) / (y2 - y1))));
    this.cam = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 + (h * 0.06) / z, zoom: z };
    this._pendingRect = this.view.w > 10 ? null : [x1, y1, x2, y2];
    this.set({ zoom: z });
  }

  newTrack() {
    this.stopMusic();
    const t = new Track();
    t.setStart(0, 0);
    this._setTrack(t, { label: 'My track', energy: { floorY: 10 * PX_PER_M, mass: this.state.mass } });
    // Bob a little left of centre, with room to draw down and to the right
    const w = this.view.w > 10 ? this.view.w : 1200;
    const h = this.view.h > 10 ? this.view.h : 800;
    this.cam = { x: (w * 0.12) / 3, y: (h * 0.2) / 3, zoom: 3 };
    this.set({ zoom: 3 });
  }

  meta() {
    return {
      label: this.state.trackName,
      duration: Math.max(this.state.maxFrame, 40),
      energy: {
        floorY: this.state.floorY,
        mass: this.state.mass,
        version: 1,
      },
    };
  }

  exportJson() {
    return saveTrackJson(this.track, this.meta());
  }

  importJson(text) {
    const { track, meta } = loadTrackJson(text);
    this._setTrack(track, meta);
    this.toast(`Loaded “${this.state.trackName}” (${track.lines.size} lines).`);
  }

  autosave() {
    store.set(AUTOSAVE_KEY, { json: this.exportJson(), flagFrame: this.state.flagFrame });
  }

  // ---------- energy ----------
  energyNow() {
    const s = this.state;
    const key = s.rev + '|' + s.frame + '|' + s.mass + '|' + s.floorY + '|' + this.track.changeCount;
    if (this._energyCache.key !== key) {
      this._energyCache = { key, value: energyAt(this.track, s.frame, s.mass, s.floorY) };
    }
    return this._energyCache.value;
  }

  energySeries(upTo) {
    return this.series.get(this.track, upTo, this.state.mass, this.state.floorY);
  }

  setMass(m) {
    m = Math.max(1, Math.min(1000, Math.round(m * 10) / 10));
    this.changed({ mass: m });
  }

  /** Move the floor (dragging its label). It can't go above Bob's starting position. */
  setFloorY(y) {
    const low0 = lowestY(this.track.getFrame(0));
    this.changed({ floorY: Math.max(y, Math.round((low0 + 1) * 100) / 100) });
  }

  /**
   * The first frame (up to `upTo`) at which Bob reaches the floor, or -1.
   * Playback, stepping and scrubbing all stop here, so GPE never goes negative.
   */
  floorFrame(upTo) {
    const key = this.track.changeCount + '|' + this.state.floorY;
    let c = this._floorScan;
    if (!c || c.key !== key) c = this._floorScan = { key, next: 0, hit: -1 };
    while (c.hit < 0 && c.next <= upTo) {
      if (lowestY(this.track.getFrame(c.next)) > this.state.floorY) c.hit = c.next;
      c.next++;
    }
    return c.hit >= 0 && c.hit <= upTo ? c.hit : -1;
  }

  /** Called from the floor prompt: lower the floor below Bob's path and the track. */
  lowerFloor() {
    const s = this.state;
    const f = s.frame;
    const nowLow = lowestY(this.track.getFrame(f));
    // where will Bob be over the next two seconds? (capped, in case he is
    // falling off the end of the track into empty space)
    let soon = nowLow;
    for (let n = f; n <= f + PHYSICS_RATE * 2; n++) soon = Math.max(soon, lowestY(this.track.getFrame(n)));
    soon = Math.min(soon, nowLow + 5 * PX_PER_M);
    const b = this._physBounds();
    const trackLow = b ? b.maxY : -Infinity;
    const newY = Math.round((Math.max(trackLow, soon) + PX_PER_M) * 100) / 100;
    const moved = (newY - s.floorY) / PX_PER_M;
    this.changed({ floorY: newY, floorPrompt: null });
    this.toast(
      `Floor lowered by ${moved.toFixed(1)} m. Every GPE value went up by the same amount (m × g × ${moved.toFixed(1)} m), but the changes in GPE are unchanged.`,
    );
    this.play({ resume: true });
  }

  /** Called from the floor prompt: leave the floor where it is. Bob stays paused on it. */
  stopAtFloor() {
    this.set({ floorPrompt: null, playing: false });
  }

  addReading() {
    const e = this.energyNow();
    const r = {
      id: Date.now() + Math.random(),
      t: this.state.frame / PHYSICS_RATE,
      frame: this.state.frame,
      h: e.h,
      v: e.speed,
      gpe: e.gpe,
      ke: e.ke,
      total: e.total,
      mass: this.state.mass,
    };
    this.set({ readings: [...this.state.readings, r], panel: 'log' });
  }
  removeReading(id) {
    this.set({ readings: this.state.readings.filter((r) => r.id !== id) });
  }
  clearReadings() {
    this.set({ readings: [] });
  }

  // ---------- undo ----------
  _commit(action) {
    if (!action) return;
    this.undoStack.push(action);
    if (this.undoStack.length > 500) this.undoStack.shift();
    this.redoStack = [];
    this.changed();
  }
  undo() {
    const a = this.undoStack.pop();
    if (!a) return;
    this.track.undo(a);
    this.redoStack.push(a);
    this.changed();
  }
  redo() {
    const a = this.redoStack.pop();
    if (!a) return;
    this.track.redo(a);
    this.undoStack.push(a);
    this.changed();
  }
  /** Backspace in LRA: remove the most recently added line. */
  removeLatestLine() {
    let latest = null;
    for (const l of this.track.lines.values()) if (l.physical && (!latest || l.id > latest.id)) latest = l;
    if (!latest) return;
    this.track.beginAction();
    this.track.userRemoveLine(latest);
    this._commit(this.track.endAction());
  }

  // ---------- playback ----------
  play({ ignoreFlag = false, resume = false, slow = false } = {}) {
    if (resume) {
      if (this.state.playing) return;
    } else {
      let start = !ignoreFlag && this.state.flagFrame != null ? this.state.flagFrame : 0;
      const hit = this.floorFrame(start);
      if (hit >= 0) start = hit;
      this.frameFloat = start;
      this.set({ frame: start });
      this.centreOnRider();
    }
    this.frameFloat = this.state.frame;
    this.lastTick = performance.now();
    this.set({ playing: true, speed: slow ? 0.25 : this.state.speed, floorPrompt: null });
    this.syncMusic(true);
  }
  pause() {
    if (!this.state.playing) return;
    this.set({ playing: false });
    this.audio?.pause();
  }
  togglePause() {
    if (this.state.playing) this.pause();
    else this.play({ resume: true });
  }
  stop() {
    this.audio?.pause();
    const f = this.state.flagFrame ?? 0;
    this.frameFloat = f;
    this.set({ playing: false, frame: f, floorPrompt: null });
  }
  setFrame(f) {
    f = Math.max(0, Math.round(f));
    const hit = this.floorFrame(f);
    if (hit >= 0 && f > hit) {
      f = hit;
      if (this.state.frame !== hit) this.toast('Bob reaches the floor here. Lower the floor (drag its label) to go further.');
    }
    this.frameFloat = f;
    this.set({ frame: f, maxFrame: Math.max(this.state.maxFrame, f) });
    this.followRider();
    if (this.state.playing) this.syncMusic(true);
  }
  step(d) {
    if (this.state.playing) this.pause();
    this.setFrame(this.state.frame + d);
  }
  toggleFlag() {
    const f = this.state.frame;
    this.set({ flagFrame: this.state.flagFrame === f ? null : f });
    this.toast(this.state.flagFrame === null ? 'Flag removed.' : `Flag set at ${(f / 40).toFixed(2)} s. Play now starts here.`);
    this.autosave();
  }
  setSpeed(speed) {
    this.set({ speed });
    if (this.audio) this.audio.playbackRate = speed;
  }

  // ---------- music ----------
  _dropMusic() {
    this.stopMusic();
    this.audio?.destroy?.();
    if (this.state.music?.url) URL.revokeObjectURL(this.state.music.url);
    this.audio = null;
  }
  setMusic(file) {
    this._dropMusic();
    if (!file) {
      this.set({ music: null });
      return;
    }
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.src = url;
    audio.preload = 'auto';
    audio.addEventListener('error', () => this.toast('That audio file could not be played. Try an MP3 or M4A file.', 'error'));
    this.audio = audio;
    this.set({ music: { kind: 'file', name: file.name, url, offset: 0, volume: 1 } });
    this.toast(`Music added: ${file.name}. It plays in time with Bob.`);
  }
  setMusicOffset(offset) {
    if (!this.state.music) return;
    this.set({ music: { ...this.state.music, offset } });
    if (this.state.playing) this.syncMusic(true);
  }
  stopMusic() {
    this.audio?.pause();
  }
  syncMusic(force = false) {
    const a = this.audio;
    const m = this.state.music;
    if (!a || !m) return;
    if (!this.state.playing) {
      a.pause();
      return;
    }
    const t = this.state.frame / PHYSICS_RATE + (m.offset || 0);
    a.playbackRate = this.state.speed;
    if (t < 0 || (a.duration && t >= a.duration)) {
      a.pause();
      return;
    }
    if (force || a.paused || Math.abs(a.currentTime - t) > 0.15) {
      try {
        a.currentTime = t;
      } catch {
        /* not seekable yet */
      }
    }
    if (a.paused) a.play().catch(() => {});
  }

  // ---------- camera ----------
  setZoom(z, sx = this.view.w / 2, sy = this.view.h / 2) {
    z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
    const v = makeView(this.cam, this.view.w, this.view.h);
    const [wx, wy] = v.toWorld(sx, sy);
    this.cam.zoom = z;
    // keep the world point under the cursor fixed
    this.cam.x = wx - (sx - this.view.w / 2) / z;
    this.cam.y = wy - (sy - this.view.h / 2) / z;
    this.set({ zoom: z });
  }
  zoomBy(f, sx, sy) {
    this.setZoom(this.cam.zoom * f, sx, sy);
  }
  centreOn(x, y) {
    this.cam.x = x;
    this.cam.y = y;
    this.dirty = true;
  }
  centreOnRider() {
    const c = centre(this.track.getFrame(this.state.frame));
    this.centreOn(c.x, c.y + (this.view.h * 0.1) / this.cam.zoom);
  }
  focusStart() {
    this.centreOn(this.track.startX + 8, this.track.startY);
  }
  focusFlag() {
    if (this.state.flagFrame == null) return;
    const c = centre(this.track.getFrame(this.state.flagFrame));
    this.centreOn(c.x, c.y);
  }
  /**
   * The largest part of the canvas not covered by the floating panels, in
   * canvas pixels. Used to frame the track and Bob so nothing hides under them.
   */
  freeRect() {
    const w = this.view.w > 10 ? this.view.w : 1200;
    const h = this.view.h > 10 ? this.view.h : 800;
    const cr = this.canvas?.getBoundingClientRect?.() || { left: 0, top: 0 };
    const rel = (sel) => {
      const el = typeof document !== 'undefined' ? document.querySelector(sel) : null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { l: r.left - cr.left, t: r.top - cr.top, r: r.right - cr.left, b: r.bottom - cr.top };
    };
    const gap = 14;
    const ruler = this.state.showRuler ? 46 : 0;
    const tb = rel('.toolbar-wrap');
    const tl = rel('.timeline');
    const L = ruler + gap,
      R = w - gap;
    const T = (tb ? tb.b : 0) + gap,
      B = (tl ? tl.t : h) - gap;
    const panels = ['.energy', '.side'].map(rel).filter(Boolean);
    // option 1: keep clear of the panels sideways
    let x1 = L,
      x2 = R;
    for (const p of panels) {
      if ((p.l + p.r) / 2 < w / 2) x1 = Math.max(x1, p.r + gap);
      else x2 = Math.min(x2, p.l - gap);
    }
    // option 2: keep clear of the panels above and below
    let y1 = T,
      y2 = B;
    for (const p of panels) {
      if ((p.t + p.b) / 2 < h / 2) y1 = Math.max(y1, p.b + gap);
      else y2 = Math.min(y2, p.t - gap);
    }
    const a = { x1, y1: T, x2, y2: B };
    const b = { x1: L, y1, x2: R, y2 };
    return { a, b, fallback: { x1: L, y1: T, x2: R, y2: B } };
  }

  /** Zoom and pan so every drawn line (and Bob's start) is on screen and clear of the panels. */
  zoomToFit() {
    const b = this.track.bounds();
    if (!b) {
      this.showBob();
      return;
    }
    const pad = 4;
    const minX = Math.min(b.minX, this.track.startX) - pad,
      maxX = Math.max(b.maxX, this.track.startX + 18) + pad;
    const minY = Math.min(b.minY, this.track.startY - 12) - pad,
      maxY = Math.max(b.maxY, this.track.startY + 6) + pad;
    const bw = Math.max(1, maxX - minX),
      bh = Math.max(1, maxY - minY);
    const { a, b: c, fallback } = this.freeRect();
    // whichever panel-free area lets the track appear biggest
    let best = null;
    for (const r of [a, c]) {
      const rw = r.x2 - r.x1,
        rh = r.y2 - r.y1;
      if (rw < 120 || rh < 80) continue;
      const z = Math.min(rw / bw, rh / bh);
      if (!best || z > best.z) best = { z, r };
    }
    if (!best) {
      const r = fallback;
      best = { z: Math.min((r.x2 - r.x1) / bw, (r.y2 - r.y1) / bh), r };
    }
    if (!best) best = { z: 1, r: fallback };
    const z = Math.max(MIN_ZOOM, Math.min(8, best.z));
    this._frameWorldPoint((minX + maxX) / 2, (minY + maxY) / 2, z, best.r);
  }

  /** Bring Bob back into view at a comfortable zoom (for when you get lost). */
  showBob() {
    const c = centre(this.track.getFrame(this.state.frame));
    const z = this.cam.zoom >= 1 && this.cam.zoom <= 8 ? this.cam.zoom : 2;
    const { a, b } = this.freeRect();
    const area = (r) => Math.max(0, r.x2 - r.x1) * Math.max(0, r.y2 - r.y1);
    this._frameWorldPoint(c.x, c.y, z, area(a) >= area(b) ? a : b);
  }

  /** Put world point (x, y) at the centre of screen rectangle r, at zoom z. */
  _frameWorldPoint(x, y, z, r) {
    const w = this.view.w > 10 ? this.view.w : 1200;
    const h = this.view.h > 10 ? this.view.h : 800;
    const sx = (r.x1 + r.x2) / 2,
      sy = (r.y1 + r.y2) / 2;
    this.cam = { x: x - (sx - w / 2) / z, y: y - (sy - h / 2) / z, zoom: z };
    this.set({ zoom: z });
  }

  followRider() {
    const c = centre(this.track.getFrame(this.state.frame));
    const z = this.cam.zoom;
    const bx = (this.view.w * 0.12) / z;
    const by = (this.view.h * 0.12) / z;
    // keep Bob a little above the middle: the panels live along the bottom
    const fy = this.cam.y - (this.view.h * 0.1) / z;
    if (c.x - this.cam.x > bx) this.cam.x = c.x - bx;
    if (this.cam.x - c.x > bx) this.cam.x = c.x + bx;
    if (c.y - fy > by) this.cam.y += c.y - fy - by;
    if (fy - c.y > by) this.cam.y -= fy - c.y - by;
  }

  // ---------- tools ----------
  setTool(tool) {
    if (this.drag && this.drag.kind === 'tool') this._endTool(true);
    this.set({ tool });
  }
  setLineType(t) {
    if (this.state.tool !== 'pencil' && this.state.tool !== 'line') this.set({ tool: 'pencil' });
    this.set({ lineType: t });
  }
  cycleMultiplier() {
    if (this.state.lineType === LineType.Red) {
      const m = this.state.redMultiplier >= 3 ? 1 : this.state.redMultiplier + 1;
      this.set({ redMultiplier: m });
      this.toast(`Red line strength ×${m}`);
    } else if (this.state.lineType === LineType.Scenery) {
      const w = this.state.sceneryWidth >= 3 ? 0.5 : Math.floor(this.state.sceneryWidth + 1);
      this.set({ sceneryWidth: w });
    }
  }
  snapActive() {
    return this.state.snap !== this.keys.has('s');
  }

  _findSnap(wx, wy, physicalOnly) {
    const rad = SNAP_PX / this.cam.zoom;
    let best = null;
    let bd = Infinity;
    for (const l of this.track.lines.values()) {
      if (physicalOnly && !l.physical) continue;
      const w = l.width || 1;
      const d1 = Math.hypot(wx - l.x1, wy - l.y1);
      const d2 = Math.hypot(wx - l.x2, wy - l.y2);
      if (d1 - w < rad && d1 < bd) {
        bd = d1;
        best = [l.x1, l.y1];
      }
      if (d2 - w < rad && d2 < bd) {
        bd = d2;
        best = [l.x2, l.y2];
      }
    }
    return best;
  }

  _makeLine(x1, y1, x2, y2, flip) {
    const t = this.state.lineType;
    if (t === LineType.Red) return new RedLine(x1, y1, x2, y2, flip, this.state.redMultiplier);
    if (t === LineType.Scenery) return new SceneryLine(x1, y1, x2, y2, this.state.sceneryWidth);
    return new StandardLine(x1, y1, x2, y2, flip);
  }

  _beginTool(wx, wy, e) {
    const tool = this.state.tool;
    const phys = this.state.lineType !== LineType.Scenery;
    if (tool === 'pencil' || tool === 'line') {
      let sx = wx,
        sy = wy,
        snapped = false;
      if (this.snapActive()) {
        const s = this._findSnap(wx, wy, phys);
        if (s) {
          [sx, sy] = s;
          snapped = true;
        }
      }
      this.track.beginAction();
      this.drag = { kind: 'tool', tool, sx, sy, ex: sx, ey: sy, flip: e.shiftKey, snapped, drawn: false };
    } else if (tool === 'eraser') {
      this.track.beginAction();
      this.drag = { kind: 'tool', tool, lx: wx, ly: wy };
      this._erase(wx, wy, wx, wy);
    } else if (tool === 'start') {
      this.drag = { kind: 'start', ox: wx - this.track.startX, oy: wy - this.track.startY };
      if (this.state.playing) this.pause();
      this.setFrame(0);
    }
  }

  _moveTool(wx, wy, e) {
    const d = this.drag;
    if (!d) return;
    if (d.kind === 'start') {
      this.track.setStart(Math.round((wx - d.ox) * 100) / 100, Math.round((wy - d.oy) * 100) / 100);
      this.changed();
      return;
    }
    if (d.tool === 'pencil') {
      this._pencilTo(d, wx, wy);
    } else if (d.tool === 'line') {
      let ex = wx,
        ey = wy;
      if (this.keys.has('x')) [ex, ey] = snapToDegrees(d.sx, d.sy, ex, ey);
      else if (this.snapActive()) {
        const s = this._findSnap(wx, wy, this.state.lineType !== LineType.Scenery);
        if (s && (s[0] !== d.sx || s[1] !== d.sy)) [ex, ey] = s;
      }
      d.ex = ex;
      d.ey = ey;
      if (e.shiftKey !== undefined) d.flip = !!e.shiftKey;
    } else if (d.tool === 'eraser') {
      this._erase(d.lx, d.ly, wx, wy);
      d.lx = wx;
      d.ly = wy;
    }
    this.dirty = true;
  }

  // PencilTool.OnMouseMoved: lay a new segment once the pointer is far enough
  _pencilTo(d, wx, wy) {
    d.ex = wx;
    d.ey = wy;
    const len = Math.hypot(wx - d.sx, wy - d.sy);
    const min = PENCIL_MIN_PX / this.cam.zoom;
    const scen = this.state.lineType === LineType.Scenery;
    if ((scen && len >= min) || len >= min * 2) {
      this.track.userAddLine(this._makeLine(d.sx, d.sy, wx, wy, d.flip));
      d.drawn = true;
      d.sx = wx;
      d.sy = wy;
      this.changed();
    }
  }

  _endTool(cancel = false) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.kind === 'start') {
      this.autosave();
      return;
    }
    if (!cancel) {
      if (d.tool === 'pencil') {
        if (this.state.lineType === LineType.Scenery && !d.drawn && d.ex === d.sx && d.ey === d.sy) {
          // a single click with the scenery pencil leaves a dot
          this.track.userAddLine(this._makeLine(d.sx, d.sy, d.sx, d.sy, false));
        } else {
          this._pencilTo(d, d.ex, d.ey);
        }
      } else if (d.tool === 'line') {
        const len = Math.hypot(d.ex - d.sx, d.ey - d.sy);
        if (len >= LINE_MIN) this.track.userAddLine(this._makeLine(d.sx, d.sy, d.ex, d.ey, d.flip));
      }
    }
    const action = this.track.endAction();
    if (action) this._commit(action);
    this.dirty = true;
  }

  _erase(x1, y1, x2, y2) {
    const r = ERASER_PX / this.cam.zoom;
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / (r / 2)));
    const victims = new Set();
    for (const l of this.track.lines.values()) {
      const w = (l.width || 1) * 1;
      for (let i = 0; i <= steps; i++) {
        const px = x1 + ((x2 - x1) * i) / steps;
        const py = y1 + ((y2 - y1) * i) / steps;
        if (distToSegment(px, py, l.x1, l.y1, l.x2, l.y2) < r + w) {
          victims.add(l);
          break;
        }
      }
    }
    if (!victims.size) return;
    for (const l of victims) this.track.userRemoveLine(l);
    this.changed();
  }

  // ---------- DOM wiring ----------
  attach(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const ro = new ResizeObserver(() => this._resize());
    ro.observe(canvas);
    this._ro = ro;
    this._resize();
    const opts = { passive: false };
    this._handlers = {
      pointerdown: (e) => this._onPointerDown(e),
      pointermove: (e) => this._onPointerMove(e),
      pointerup: (e) => this._onPointerUp(e),
      pointercancel: (e) => this._onPointerUp(e, true),
      pointerleave: () => {
        this.hover = null;
        this.dirty = true;
      },
      wheel: (e) => this._onWheel(e),
      contextmenu: (e) => e.preventDefault(),
    };
    for (const [k, fn] of Object.entries(this._handlers)) canvas.addEventListener(k, fn, opts);
    this._keydown = (e) => this._onKeyDown(e);
    this._keyup = (e) => {
      this.keys.delete(e.key.toLowerCase());
      // buttons fire their click on Space keyup; we already handled Space
      if (e.key === ' ' && e.target?.tagName === 'BUTTON' && !this.modalOpen) e.preventDefault();
    };
    // After a mouse/touch click on a toolbar or timeline control, hand focus
    // back to the page so the next key press is a shortcut, not that control.
    this._blurAfterClick = (e) => {
      const el = e.target?.closest?.('.toolbar button, .swatch button, .timeline button, .timeline input[type="range"]');
      if (el) setTimeout(() => document.activeElement === el && el.blur(), 0);
    };
    document.addEventListener('pointerup', this._blurAfterClick, true);
    this._blur = () => this.keys.clear();
    window.addEventListener('keydown', this._keydown);
    window.addEventListener('keyup', this._keyup);
    window.addEventListener('blur', this._blur);
    const loop = (t) => {
      this._raf = requestAnimationFrame(loop);
      this._tick(t);
    };
    this._raf = requestAnimationFrame(loop);
    if (this._needsFit) this.zoomToFit();
  }
  detach() {
    cancelAnimationFrame(this._raf);
    this._ro?.disconnect();
    if (this.canvas) for (const [k, fn] of Object.entries(this._handlers)) this.canvas.removeEventListener(k, fn);
    window.removeEventListener('keydown', this._keydown);
    window.removeEventListener('keyup', this._keyup);
    window.removeEventListener('blur', this._blur);
    document.removeEventListener('pointerup', this._blurAfterClick, true);
  }
  _resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const first = this.view.w <= 1;
    this.view = { w: r.width, h: r.height, dpr };
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    if (first && r.width > 10) {
      if (this._pendingRect) this.viewRect(...this._pendingRect);
      else this.zoomToFit();
    }
    this.dirty = true;
  }
  _screenPos(e) {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  _world(sx, sy) {
    return makeView(this.cam, this.view.w, this.view.h).toWorld(sx, sy);
  }

  _onPointerDown(e) {
    if (this.state.recording) return;
    e.preventDefault();
    this.canvas.setPointerCapture?.(e.pointerId);
    const [sx, sy] = this._screenPos(e);
    this.pointers.set(e.pointerId, { sx, sy });
    if (this.pointers.size === 2) {
      // second finger: cancel the stroke and start a pinch
      if (this.drag?.kind === 'tool') {
        this.track.cancelAction();
        this.drag = null;
      }
      const [a, b] = [...this.pointers.values()];
      this.drag = {
        kind: 'pinch',
        dist: Math.hypot(a.sx - b.sx, a.sy - b.sy),
        mx: (a.sx + b.sx) / 2,
        my: (a.sy + b.sy) / 2,
        zoom: this.cam.zoom,
      };
      return;
    }
    if (this.pointers.size > 2) return;
    // floor label is a drag handle
    const fr = this._floorRect;
    if (fr && sx >= fr.x && sx <= fr.x + fr.w && sy >= fr.y && sy <= fr.y + fr.h && e.button === 0) {
      const [, wy] = this._world(sx, sy);
      this.drag = { kind: 'floor', oy: wy - this.state.floorY };
      return;
    }
    const [wx, wy] = this._world(sx, sy);
    if (e.button === 1 || e.button === 2 || this.state.tool === 'pan') {
      this.drag = { kind: 'pan', sx, sy, cx: this.cam.x, cy: this.cam.y };
      return;
    }
    if (e.button !== 0) return;
    this._beginTool(wx, wy, e);
  }

  _onPointerMove(e) {
    const [sx, sy] = this._screenPos(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { sx, sy });
    const [wx, wy] = this._world(sx, sy);
    this.hover = { sx, sy, wx, wy, shift: e.shiftKey };
    const d = this.drag;
    if (!d) {
      const fr = this._floorRect;
      const overFloor = fr && sx >= fr.x && sx <= fr.x + fr.w && sy >= fr.y && sy <= fr.y + fr.h;
      this.canvas.style.cursor = overFloor ? 'ns-resize' : '';
      this.dirty = true;
      return;
    }
    if (d.kind === 'pinch') {
      if (this.pointers.size < 2) return;
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.sx - b.sx, a.sy - b.sy);
      const mx = (a.sx + b.sx) / 2,
        my = (a.sy + b.sy) / 2;
      this.cam.x -= (mx - d.mx) / this.cam.zoom;
      this.cam.y -= (my - d.my) / this.cam.zoom;
      d.mx = mx;
      d.my = my;
      this.setZoom((d.zoom * dist) / (d.dist || 1), mx, my);
      return;
    }
    if (d.kind === 'pan') {
      this.cam.x = d.cx - (sx - d.sx) / this.cam.zoom;
      this.cam.y = d.cy - (sy - d.sy) / this.cam.zoom;
      this.dirty = true;
      return;
    }
    if (d.kind === 'floor') {
      this.setFloorY(Math.round((wy - d.oy) * 100) / 100);
      return;
    }
    this._moveTool(wx, wy, e);
  }

  _onPointerUp(e, cancel = false) {
    this.pointers.delete(e.pointerId);
    const d = this.drag;
    if (!d) return;
    if (d.kind === 'pinch') {
      if (this.pointers.size === 0) this.drag = null;
      return;
    }
    if (d.kind === 'pan' || d.kind === 'floor') {
      this.drag = null;
      if (d.kind === 'floor') this.autosave();
      return;
    }
    if (!cancel) {
      const [sx, sy] = this._screenPos(e);
      const [wx, wy] = this._world(sx, sy);
      if (d.kind === 'tool' && d.tool === 'pencil') {
        d.ex = wx;
        d.ey = wy;
      }
      if (d.kind === 'tool' && d.tool === 'line') this._moveTool(wx, wy, e);
    }
    this._endTool(cancel);
  }

  _onWheel(e) {
    e.preventDefault();
    const [sx, sy] = this._screenPos(e);
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    this.zoomBy(Math.exp(-dy * 0.0016), sx, sy);
  }

  _onKeyDown(e) {
    const t = e.target;
    const tag = (t && t.tagName) || '';
    const isRange = tag === 'INPUT' && t.type === 'range';
    if ((/INPUT|TEXTAREA|SELECT/.test(tag) && !isRange) || t?.isContentEditable) return;
    if (this.modalOpen || this.state.recording) return;
    const k = e.key.toLowerCase();
    // A focused toolbar button or the timeline slider shouldn't swallow the
    // shortcuts: Space still plays/pauses instead of pressing the button.
    if (tag === 'BUTTON' && k === 'enter') return;
    if ((tag === 'BUTTON' || isRange) && [' ', 'home', 'end', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault();
    this.keys.add(k);
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (ctrl && k === 'y') {
      e.preventDefault();
      this.redo();
      return;
    }
    if (ctrl) return;
    switch (k) {
      case 'q':
        this.setTool('pencil');
        break;
      case 'w':
        this.setTool('line');
        break;
      case 'e':
        this.setTool('eraser');
        break;
      case 't':
        this.setTool('pan');
        break;
      case 'd':
        this.setTool('start');
        break;
      case '1':
        this.setLineType(LineType.Blue);
        break;
      case '2':
        this.setLineType(LineType.Red);
        break;
      case '3':
        this.setLineType(LineType.Scenery);
        break;
      case 'tab':
        e.preventDefault();
        this.cycleMultiplier();
        break;
      case 'y':
        this.play({ ignoreFlag: e.altKey, slow: e.shiftKey });
        break;
      case 'u':
        this.stop();
        break;
      case 'i':
        this.toggleFlag();
        break;
      case ' ':
        e.preventDefault();
        this.togglePause();
        break;
      case 'm':
        this.setSpeed(this.state.speed === 1 ? 0.25 : 1);
        break;
      case 'arrowright':
        e.preventDefault();
        this.step(e.shiftKey ? 40 : 1);
        break;
      case 'arrowleft':
        e.preventDefault();
        this.step(e.shiftKey ? -40 : -1);
        break;
      case 'backspace':
        e.preventDefault();
        this.removeLatestLine();
        break;
      case 'home':
        this.focusStart();
        break;
      case 'f1':
        e.preventDefault();
        this.showBob();
        break;
      case 'f2':
        e.preventDefault();
        this.focusFlag();
        break;
      case 'z':
        this.zoomBy(1.25);
        break;
      case 'x':
        if (!this.drag) this.zoomBy(0.8);
        break;
      case 'escape':
        if (this.drag?.kind === 'tool') {
          this.track.cancelAction();
          this.drag = null;
          this.dirty = true;
        }
        break;
      case 'enter':
        this.addReading();
        break;
      default:
    }
  }

  // ---------- frame loop ----------
  _tick(now) {
    const s = this.state;
    if (s.playing && !s.recording) {
      const dt = Math.min(now - (this.lastTick || now), 250) / 1000;
      this.lastTick = now;
      const from = s.frame;
      this.frameFloat += dt * PHYSICS_RATE * s.speed;
      let to = Math.floor(this.frameFloat);
      if (to > from) {
        // did Bob reach the floor? Stop there and ask about lowering it.
        const hit = this.floorFrame(to);
        if (hit >= 0) {
          this.frameFloat = hit;
          this.set({ frame: hit, playing: false, floorPrompt: { frame: hit }, maxFrame: Math.max(s.maxFrame, hit) });
          this.audio?.pause();
          this.followRider();
          return this._render();
        }
        this.set({ frame: to, maxFrame: Math.max(s.maxFrame, to) });
        this.followRider();
        this.syncMusic(false);
      }
    }
    if (this.dirty || s.playing) this._render();
  }

  _render() {
    this.dirty = false;
    const { w, h, dpr } = this.view;
    if (w < 2 || h < 2) return;
    const ctx = this.ctx;
    const s = this.state;
    const view = makeView(this.cam, w, h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, w, h);

    drawFloor(ctx, view, s.floorY, { dpr, dragging: this.drag?.kind === 'floor' });

    // world space
    ctx.setTransform(view.z * dpr, 0, 0, view.z * dpr, view.ox * dpr, view.oy * dpr);
    const showHits = !s.playing;
    drawLines(ctx, this.track, view, {
      playing: s.playing,
      colorPlayback: s.colorPlayback,
      hits: showHits ? this.track.hits[s.frame] : null,
    });
    if (!s.playing) {
      drawStartMarker(ctx, this.track);
      if (s.flagFrame != null && s.flagFrame !== s.frame) {
        const fr = this.track.getFrame(s.flagFrame);
        drawRider(ctx, fr, 0.3);
        const c = centre(fr);
        drawFlagIcon(ctx, c.x - 2, c.y - 6);
      }
    }
    const rider = this.track.getFrame(s.frame);
    drawRider(ctx, rider, 1);
    this._drawToolPreview(ctx, view);

    // screen space overlays
    const e = this.energyNow();
    drawEnergyOverlays(ctx, view, e, s.floorY, { height: s.showHeight, velocity: s.showVelocity, dpr });
    if (s.showRuler) drawRuler(ctx, view, s.floorY, dpr);
    this._floorRect = drawFloorLabel(ctx, view, s.floorY, { dpr, left: s.showRuler ? 58 : 12 });
    this._drawToolLabel(ctx, view, dpr);

    if (this.graphCanvas && s.panel === 'graph') {
      const span = Math.max(s.maxFrame, s.frame, PHYSICS_RATE * 10);
      const series = this.energySeries(Math.max(s.frame, s.maxFrame));
      drawGraph(this.graphCanvas, series, s.frame, { span });
    }
  }

  _drawToolPreview(ctx, view) {
    const d = this.drag;
    const z = view.z;
    const typeColor =
      this.state.lineType === LineType.Red ? COLORS.red : this.state.lineType === LineType.Scenery ? COLORS.green : COLORS.blue;
    if (d && d.kind === 'tool' && (d.tool === 'line' || d.tool === 'pencil')) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = typeColor;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2 * (this.state.lineType === LineType.Scenery ? this.state.sceneryWidth : 1);
      ctx.beginPath();
      ctx.moveTo(d.sx, d.sy);
      ctx.lineTo(d.ex, d.ey);
      ctx.stroke();
      if (d.tool === 'line' && this.state.lineType !== LineType.Scenery) {
        // show which side Bob can ride on
        const dx = d.ex - d.sx,
          dy = d.ey - d.sy;
        const L = Math.hypot(dx, dy);
        if (L > 1) {
          const flip = d.flip;
          const nx = flip ? dy / L : -dy / L;
          const ny = flip ? -dx / L : dx / L;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(d.sx - nx * 2, d.sy - ny * 2);
          ctx.lineTo(d.ex - nx * 2, d.ey - ny * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    const hv = this.hover;
    if (!hv || this.state.playing) return;
    const tool = this.state.tool;
    if ((tool === 'pencil' || tool === 'line') && this.snapActive() && (!d || d.kind !== 'pan')) {
      const s = this._findSnap(hv.wx, hv.wy, this.state.lineType !== LineType.Scenery);
      if (s) {
        ctx.save();
        ctx.strokeStyle = typeColor;
        ctx.lineWidth = 1.5 / z;
        ctx.beginPath();
        ctx.arc(s[0], s[1], 4 / z, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (tool === 'eraser') {
      ctx.save();
      ctx.strokeStyle = 'rgba(29,34,48,0.6)';
      ctx.lineWidth = 1 / z;
      ctx.beginPath();
      ctx.arc(hv.wx, hv.wy, ERASER_PX / z, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** While drawing a straight line: its length, slope and the GPE change along it. */
  _drawToolLabel(ctx, view, dpr) {
    const d = this.drag;
    if (!d || d.kind !== 'tool' || d.tool !== 'line') return;
    const dx = d.ex - d.sx,
      dy = d.ey - d.sy;
    const L = Math.hypot(dx, dy);
    if (L < 1) return;
    const lenM = L / PX_PER_M;
    const drop = dy / PX_PER_M; // positive = goes down
    const ang = Math.abs((Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI);
    const dG = -this.state.mass * 9.8 * drop;
    const lines = [
      `${lenM.toFixed(2)} m long, ${ang.toFixed(0)}° slope`,
      drop > 0.005 ? `drops ${drop.toFixed(2)} m` : drop < -0.005 ? `rises ${(-drop).toFixed(2)} m` : 'level',
      `ΔGPE for Bob: ${dG >= 0 ? '+' : '−'}${Math.abs(Math.round(dG)).toLocaleString('en-GB')} J`,
    ];
    const [ex, ey] = view.toScreen(d.ex, d.ey);
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `500 11px ${FONT_NUM}`;
    const tw = Math.max(...lines.map((t) => ctx.measureText(t).width));
    let x = ex + 16,
      y = ey + 16;
    if (x + tw + 16 > view.w) x = ex - tw - 26;
    if (y + 58 > view.h) y = ey - 70;
    ctx.fillStyle = 'rgba(29,34,48,0.88)';
    roundRect(ctx, x, y, tw + 16, 56, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    lines.forEach((t, i) => ctx.fillText(t, x + 8, y + 17 + i * 16));
    ctx.restore();
  }
}
