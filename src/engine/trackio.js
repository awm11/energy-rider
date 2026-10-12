// .track.json import/export, compatible with linerider-advanced
// (src/IO/json/JSONLoader.cs / JSONWriter.cs) and linerider.com.
import { Ext, LineType } from './constants.js';
import { RedLine, SceneryLine, StandardLine } from './lines.js';
import { Track } from './track.js';

const toBool = (v) => v === true || v === 1 || v === '1' || v === 'true';

function lineFromJson(l) {
  const type = Number(l.type);
  let line;
  if (type === LineType.Blue || type === LineType.Red) {
    line =
      type === LineType.Red
        ? new RedLine(+l.x1, +l.y1, +l.x2, +l.y2, toBool(l.flipped), Math.max(1, Number(l.multiplier) || 1))
        : new StandardLine(+l.x1, +l.y1, +l.x2, +l.y2, toBool(l.flipped));
    line.extension = Number(l.extended) || 0;
    if (toBool(l.leftExtended)) line.extension |= Ext.Left;
    if (toBool(l.rightExtended)) line.extension |= Ext.Right;
  } else if (type === LineType.Scenery) {
    line = new SceneryLine(+l.x1, +l.y1, +l.x2, +l.y2, Number(l.width) || 1);
  } else {
    throw new Error('Unknown line type ' + l.type);
  }
  line.id = Number(l.id);
  return line;
}

function linesArrayToObjects(arr) {
  // ['type','id','x1','y1','x2','y2','extended','flipped','leftLine','rightLine','multiplier']
  return arr.map((a) => {
    const o = { type: a[0], id: a[1], x1: a[2], y1: a[3], x2: a[4], y2: a[5] };
    if (o.type !== 2 && a.length > 6) {
      o.extended = a[6];
      if (a.length > 7) {
        o.flipped = a[7];
        if (o.type === 1 && a.length > 10) o.multiplier = a[10];
      }
    }
    return o;
  });
}

/** Parse a .track.json string. Returns { track, meta }. */
export function loadTrackJson(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    throw new Error('That file is not valid JSON.');
  }
  let version = 62;
  if (obj.version === '6.1') version = 61;
  else if (obj.version && obj.version !== '6.2') throw new Error('Unsupported physics version: ' + obj.version);

  const track = new Track({ version });
  let sx = 0,
    sy = 0;
  const startPos = obj.startPosition || obj.riders?.[0]?.startPosition;
  if (startPos) {
    sx = Number(startPos.x) || 0;
    sy = Number(startPos.y) || 0;
  }
  track.setStart(sx, sy);
  track.zeroStart = !!obj.zeroStart;
  if (obj.riders?.[0]?.startVelocity) {
    const v = obj.riders[0].startVelocity;
    if (Number(v.x) === 0 && Number(v.y) === 0) track.zeroStart = true;
  }
  if (obj.linesArrayCompressed && !obj.linesArray && !obj.lines) {
    throw new Error('Compressed tracks are not supported. Re-save it from linerider-advanced without compression.');
  }
  let lines = [];
  if (Array.isArray(obj.linesArray) && obj.linesArray.length) lines = linesArrayToObjects(obj.linesArray);
  else if (Array.isArray(obj.lines)) lines = obj.lines;

  const physical = [];
  const scenery = [];
  for (const l of lines) {
    const line = lineFromJson(l);
    (line.physical ? physical : scenery).push(line);
  }
  // physical ids are kept exactly; scenery gets negative ids like LRA
  for (const line of physical) track.addLine(line, { updateExtensions: false });
  for (const line of scenery) {
    line.id = null;
    track.addLine(line, { updateExtensions: false });
  }
  track.resetFrames();
  const meta = {
    label: obj.label || 'Untitled track',
    creator: obj.creator || '',
    description: obj.description || '',
    duration: Number(obj.duration) || 0,
    energy: obj.energyRider || null,
  };
  return { track, meta };
}

/** Serialise to the linerider.com / linerider-advanced .track.json format. */
export function saveTrackJson(track, meta = {}) {
  const phys = [];
  const scen = [];
  for (const l of track.lines.values()) (l.physical ? phys : scen).push(l);
  phys.sort((a, b) => a.id - b.id);
  let nextId = phys.reduce((m, l) => Math.max(m, l.id), -1) + 1;
  const lines = [];
  for (const l of phys) {
    const o = {
      id: l.id,
      type: l.type,
      x1: l.x1,
      y1: l.y1,
      x2: l.x2,
      y2: l.y2,
      flipped: l.inv,
      leftExtended: !!(l.extension & Ext.Left),
      rightExtended: !!(l.extension & Ext.Right),
      extended: l.extension,
    };
    if (l.type === LineType.Red) o.multiplier = l.multiplier;
    lines.push(o);
  }
  scen.sort((a, b) => b.id - a.id);
  for (const l of scen) {
    lines.push({ id: nextId++, type: 2, x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, width: l.width });
  }
  const out = {
    label: meta.label || 'Energy track',
    creator: meta.creator || '',
    description: meta.description || '',
    duration: meta.duration || 0,
    version: track.version === 61 ? '6.1' : '6.2',
    audio: null,
    startPosition: { x: track.startX, y: track.startY },
    riders: [
      {
        startPosition: { x: track.startX, y: track.startY },
        startVelocity: { x: track.zeroStart ? 0 : 0.4, y: 0 },
        remountable: false,
      },
    ],
    lines,
  };
  if (track.zeroStart) out.zeroStart = true;
  if (meta.energy) out.energyRider = meta.energy;
  return JSON.stringify(out, null, 1);
}
