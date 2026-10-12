// Port of linerider-advanced: src/Game/Physics/SimulationGrid.cs,
// SimulationGridStatic.cs and LineContainer.cs.
import { CELL_SIZE } from './constants.js';

// SimulationGrid.GetCellKey: an int32 hash, reproduced with 32-bit wrapping
// so that (astronomically rare) key collisions behave as in the original.
export function cellKey(x, y) {
  let hash = 27;
  hash = (Math.imul(hash, 486187739) + x) | 0;
  hash = (Math.imul(hash, 486187739) + y) | 0;
  return hash;
}

function cellInfo(px, py) {
  const gx = Math.floor(px / CELL_SIZE);
  const gy = Math.floor(py / CELL_SIZE);
  return { x: gx, y: gy, rx: px - CELL_SIZE * gx, ry: py - CELL_SIZE * gy };
}

function getStep(forwards, cellpos, remainder) {
  if (forwards) return cellpos < 0 ? CELL_SIZE + remainder : CELL_SIZE - remainder;
  return cellpos < 0 ? -CELL_SIZE - remainder : -(remainder + 1);
}

// C# Math.Round defaults to banker's rounding (MidpointRounding.ToEven)
function roundEven(v) {
  const r = Math.round(v);
  if (Math.abs(v % 1) === 0.5) {
    return 2 * Math.round(v / 2);
  }
  return r;
}

const MAX_STEPS = 1e6;

/** Grid cells touched by the segment, in the original traversal order. */
export function getGridPositions(x1, y1, x2, y2, version = 62) {
  if (version === 61) return getGridPositions61(x1, y1, x2, y2);
  const diffx = x2 - x1;
  const diffy = y2 - y1;
  const ret = [];
  let cell = cellInfo(x1, y1);
  const gridend = cellInfo(x2, y2);
  ret.push(cell);
  if ((diffx === 0 && diffy === 0) || (cell.x === gridend.x && cell.y === gridend.y)) return ret;

  const left = Math.min(cell.x, gridend.x);
  const right = Math.max(cell.x, gridend.x);
  const top = Math.min(cell.y, gridend.y);
  const bottom = Math.max(cell.y, gridend.y);
  let cx = x1;
  let cy = y1;
  const scalarx = 1 / diffy;
  const scalary = 1 / diffx;
  const xforwards = diffx > 0;
  const yforwards = diffy > 0;
  for (let n = 0; n < MAX_STEPS; n++) {
    const boundaryx = getStep(yforwards, cell.y, cell.ry);
    const boundaryy = getStep(xforwards, cell.x, cell.rx);
    const stepx = diffx * boundaryx * scalarx;
    const stepy = diffy * boundaryy * scalary;
    cx += Math.abs(stepx) < Math.abs(boundaryy) ? stepx : boundaryy;
    cy += Math.abs(stepy) < Math.abs(boundaryx) ? stepy : boundaryx;
    cell = cellInfo(cx, cy);
    if (!(cell.x >= left && cell.x <= right && cell.y >= top && cell.y <= bottom)) return ret;
    ret.push(cell);
  }
  return ret;
}

function getGridPositions61(x1, y1, x2, y2) {
  const diffx = x2 - x1;
  const diffy = y2 - y1;
  const ret = [];
  let cell = cellInfo(x1, y1);
  const gridend = cellInfo(x2, y2);
  ret.push(cell);
  if ((diffx === 0 && diffy === 0) || (cell.x === gridend.x && cell.y === gridend.y)) return ret;
  const left = Math.min(cell.x, gridend.x);
  const right = Math.max(cell.x, gridend.x);
  const top = Math.min(cell.y, gridend.y);
  const bottom = Math.max(cell.y, gridend.y);
  let cx = x1;
  let cy = y1;
  let slope = 0;
  let loc13 = 0;
  let isbelowactualY = 0;
  if (diffx !== 0 && diffy !== 0) {
    slope = diffy / diffx;
    loc13 = 1.0 / slope;
    isbelowactualY = y1 - slope * x1;
  }
  for (let n = 0; n < MAX_STEPS; n++) {
    const difX = -cell.rx + (diffx > 0 ? CELL_SIZE : -1);
    const difY = -cell.ry + (diffy > 0 ? CELL_SIZE : -1);
    if (diffx === 0) {
      cy = cy + difY;
    } else if (diffy === 0) {
      cx = cx + difX;
    } else {
      const whyyy = roundEven(slope * (cx + difX) + isbelowactualY);
      if (Math.abs(whyyy - cy) < Math.abs(difY)) {
        cx = cx + difX;
        cy = whyyy;
      } else if (Math.abs(whyyy - cy) === Math.abs(difY)) {
        cx = cx + difX;
        cy = cy + difY;
      } else {
        cx = roundEven((cy + difY - isbelowactualY) * loc13);
        cy = cy + difY;
      }
    }
    cell = cellInfo(cx, cy);
    if (cell.x >= left && cell.x <= right && cell.y >= top && cell.y <= bottom) {
      ret.push(cell);
      continue;
    }
    return ret;
  }
  return ret;
}

/**
 * Physics grid. Each cell keeps its lines ordered by descending id
 * (LineContainer: "puts lines with greater ids first").
 */
export class SimulationGrid {
  constructor(version = 62) {
    this.version = version;
    this.cells = new Map();
  }
  getCell(x, y) {
    return this.cells.get(cellKey(x, y));
  }
  _register(line, x, y) {
    const key = cellKey(x, y);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    // insert keeping descending id order, ignore id collisions
    let i = 0;
    while (i < cell.length && line.id < cell[i].id) i++;
    if (i < cell.length && cell[i].id === line.id) return;
    cell.splice(i, 0, line);
  }
  _unregister(line, x, y) {
    const key = cellKey(x, y);
    const cell = this.cells.get(key);
    if (!cell) return;
    const i = cell.findIndex((l) => l.id === line.id);
    if (i >= 0) cell.splice(i, 1);
  }
  addLine(line) {
    for (const p of getGridPositions(line.x1, line.y1, line.x2, line.y2, this.version)) {
      this._register(line, p.x, p.y);
    }
  }
  removeLine(line) {
    for (const p of getGridPositions(line.x1, line.y1, line.x2, line.y2, this.version)) {
      this._unregister(line, p.x, p.y);
    }
  }
}
