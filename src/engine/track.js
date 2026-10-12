// Port of linerider-advanced: src/Game/Track.cs, TrackWriter.cs (line
// extensions) and Timeline.cs (frame cache).
import { Ext, LineType, STARTING_MOMENTUM } from './constants.js';
import { SimulationGrid } from './grid.js';
import { createRider, generateBones, simulate } from './rider.js';

const F_RAD2DEG = Math.fround(57.2957764);
const TAU = Math.PI * 2;

// Angle.FromVector(v).Degrees, normalised to [0, 360) like the C# Angle class
function angleDegrees(x, y) {
  let r = Math.atan2(y, x);
  r %= TAU;
  if (r < 0) {
    r = r % -TAU;
    r = TAU + r;
  }
  return normDeg(r * F_RAD2DEG);
}
function normDeg(d) {
  d %= 360;
  if (d < 0) {
    d = d % -360;
    d = 360 + d;
  }
  return d;
}

const pointKey = (x, y) => x + ',' + y;

export class Track {
  constructor({ version = 62 } = {}) {
    this.version = version;
    this.grid = new SimulationGrid(version);
    this.lines = new Map(); // id -> line
    this.endpoints = new Map(); // "x,y" -> Set(line)
    this.idCounter = 0;
    this.sceneryIdCounter = -1;
    this.startX = 0;
    this.startY = 0;
    this.zeroStart = false;
    this.bones = generateBones(0, 0);
    this.frames = [];
    this.hits = []; // per frame: Set of line ids touched (for highlighting)
    this.changeCount = 0;
    this.resetFrames();
  }

  setStart(x, y) {
    this.startX = x;
    this.startY = y;
    this.bones = generateBones(x, y);
    this.resetFrames();
  }

  setZeroStart(v) {
    this.zeroStart = !!v;
    this.resetFrames();
  }

  getStartRider() {
    return createRider(this.startX, this.startY, this.zeroStart ? 0 : STARTING_MOMENTUM, 0);
  }

  resetFrames() {
    this.frames = [this.getStartRider()];
    this.hits = [new Set()];
    this.changeCount++;
  }

  /** Timeline.GetFrame: simulate up to `n`, caching every frame. */
  getFrame(n) {
    n = Math.max(0, Math.floor(n));
    while (this.frames.length <= n) {
      const i = this.frames.length;
      const hits = new Set();
      this.frames.push(simulate(this.frames[i - 1], this.grid, this.bones, i, hits));
      this.hits.push(hits);
    }
    return this.frames[n];
  }

  /** First frame (searching up to `max`) where the rider has crashed, or -1. */
  firstCrashFrame(max) {
    for (let i = 0; i <= max; i++) if (this.getFrame(i).crashed) return i;
    return -1;
  }

  // ---- line management (Track.AddLine / TrackWriter) ----
  _assignId(line) {
    if (line.type === LineType.Scenery) {
      if (line.id === null || line.id === undefined || line.id >= 0) line.id = this.sceneryIdCounter--;
      else if (line.id <= this.sceneryIdCounter) this.sceneryIdCounter = line.id - 1;
    } else {
      if (line.id === null || line.id === undefined) line.id = this.idCounter++;
      else if (line.id >= this.idCounter) this.idCounter = line.id + 1;
    }
  }

  _indexEndpoints(line, add) {
    for (const k of [pointKey(line.x1, line.y1), pointKey(line.x2, line.y2)]) {
      let s = this.endpoints.get(k);
      if (add) {
        if (!s) this.endpoints.set(k, (s = new Set()));
        s.add(line);
      } else if (s) {
        s.delete(line);
        if (!s.size) this.endpoints.delete(k);
      }
    }
  }

  /**
   * Add a line. With updateExtensions (the editor default) the line-end
   * extensions of connected lines are recomputed like TrackWriter.AddLine.
   * Loading a file keeps the stored extensions instead.
   */
  addLine(line, { updateExtensions = true } = {}) {
    this._assignId(line);
    if (this.lines.has(line.id)) throw new Error('Line id collision: ' + line.id);
    this.lines.set(line.id, line);
    this._indexEndpoints(line, true);
    if (line.physical) {
      this.grid.addLine(line);
      if (updateExtensions) this._updateExtensions(line, true);
      this.resetFrames();
    }
    return line;
  }

  removeLine(line, { updateExtensions = true } = {}) {
    if (!this.lines.has(line.id)) return;
    if (line.physical && updateExtensions) this._updateExtensions(line, false);
    this.lines.delete(line.id);
    this._indexEndpoints(line, false);
    if (line.physical) {
      this.grid.removeLine(line);
      this.resetFrames();
    }
  }

  /** Lines connected end-to-start with `input` (TrackWriter.GetPairs). */
  _getPairs(input) {
    const out = [];
    const seen = new Set();
    for (const k of [pointKey(input.x1, input.y1), pointKey(input.x2, input.y2)]) {
      const s = this.endpoints.get(k);
      if (!s) continue;
      for (const line of s) {
        if (!line.physical || line.id === input.id || seen.has(line)) continue;
        if (
          (line.endX === input.startX && line.endY === input.startY) ||
          (line.startX === input.endX && line.startY === input.endY)
        ) {
          seen.add(line);
          out.push(line);
        }
      }
    }
    // SimulationCell ordering (descending id)
    out.sort((a, b) => b.id - a.id);
    return out;
  }

  // TrackWriter.UpdateExtensions
  _updateExtensions(input, add) {
    const list = this._getPairs(input);
    const inputangle = angleDegrees(input.endX - input.startX, input.endY - input.startY);
    for (const connected of list) {
      const angle2 = angleDegrees(connected.endX - connected.startX, connected.endY - connected.startY);
      const startlink = input.startX === connected.endX && input.startY === connected.endY;
      const diff = startlink ? normDeg(angle2 - inputangle) : normDeg(inputangle - angle2);
      if (diff > 0 && diff <= 180) {
        const inputflag = startlink !== input.inv ? Ext.Left : Ext.Right;
        const connectedflag = startlink !== connected.inv ? Ext.Right : Ext.Left;
        this._logExt(input);
        this._logExt(connected);
        if (add) {
          input.extension |= inputflag;
          connected.extension |= connectedflag;
        } else {
          input.extension &= ~inputflag;
          connected.extension &= ~connectedflag;
        }
      }
    }
  }

  // ---- undoable actions ----
  _logExt(line) {
    if (this._action && !this._action.extBefore.has(line)) this._action.extBefore.set(line, line.extension);
  }
  beginAction() {
    this._action = { added: [], removed: [], extBefore: new Map(), extAfter: new Map() };
  }
  /** Finish the current action and return it (null if nothing changed). */
  endAction() {
    const a = this._action;
    this._action = null;
    if (!a || (!a.added.length && !a.removed.length)) return null;
    for (const [line] of a.extBefore) a.extAfter.set(line, line.extension);
    return a;
  }
  cancelAction() {
    this._action = null;
  }
  userAddLine(line) {
    this.addLine(line);
    this._action?.added.push(line);
    return line;
  }
  userRemoveLine(line) {
    // log extensions of the removed line itself so undo restores them
    this._logExt(line);
    this.removeLine(line);
    if (this._action) {
      const i = this._action.added.indexOf(line);
      if (i >= 0) this._action.added.splice(i, 1);
      else this._action.removed.push(line);
    }
  }
  undo(a) {
    for (let i = a.added.length - 1; i >= 0; i--) this.removeLine(a.added[i], { updateExtensions: false });
    for (const l of a.removed) this.addLine(l, { updateExtensions: false });
    for (const [line, ext] of a.extBefore) line.extension = ext;
    this.resetFrames();
  }
  redo(a) {
    for (const l of a.removed) this.removeLine(l, { updateExtensions: false });
    for (const l of a.added) this.addLine(l, { updateExtensions: false });
    for (const [line, ext] of a.extAfter) line.extension = ext;
    this.resetFrames();
  }

  allLines() {
    return [...this.lines.values()];
  }

  bounds() {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const l of this.lines.values()) {
      minX = Math.min(minX, l.x1, l.x2);
      maxX = Math.max(maxX, l.x1, l.x2);
      minY = Math.min(minY, l.y1, l.y2);
      maxY = Math.max(maxY, l.y1, l.y2);
    }
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
  }

  clear() {
    this.grid = new SimulationGrid(this.version);
    this.lines.clear();
    this.endpoints.clear();
    this.idCounter = 0;
    this.sceneryIdCounter = -1;
    this.resetFrames();
  }
}
