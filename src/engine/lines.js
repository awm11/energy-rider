// Port of linerider-advanced: src/Game/Lines/StandardLine.cs, RedLine.cs,
// SceneryLine.cs. Arithmetic is written in the same order as the C# source
// so results are bit-for-bit identical (both use IEEE-754 doubles).
import { Ext, LineType } from './constants.js';

export const ZONE = 10; // StandardLine.Zone
const RED_CONST_ACC = 0.1;

export class SceneryLine {
  constructor(x1, y1, x2, y2, width = 1) {
    this.id = null;
    this.type = LineType.Scenery;
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.width = width;
  }
  get physical() {
    return false;
  }
  clone() {
    const l = new SceneryLine(this.x1, this.y1, this.x2, this.y2, this.width);
    l.id = this.id;
    return l;
  }
}

export class StandardLine {
  constructor(x1, y1, x2, y2, inv = false) {
    this.id = null;
    this.type = LineType.Blue;
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.inv = !!inv;
    this.extension = Ext.None;
    this.width = 1;
    this.calculateConstants();
  }
  get physical() {
    return true;
  }
  // "Left"/"Right" according to inv
  get startX() {
    return this.inv ? this.x2 : this.x1;
  }
  get startY() {
    return this.inv ? this.y2 : this.y1;
  }
  get endX() {
    return this.inv ? this.x1 : this.x2;
  }
  get endY() {
    return this.inv ? this.y1 : this.y2;
  }

  calculateConstants() {
    const dx = this.x2 - this.x1;
    const dy = this.y2 - this.y1;
    this.dx = dx;
    this.dy = dy;
    const sqrDistance = dx * dx + dy * dy;
    this.dotScalar = 1 / sqrDistance;
    this.distance = Math.sqrt(sqrDistance);
    const inv = 1 / this.distance;
    const nx = dx * inv;
    const ny = dy * inv;
    // OpenTK: PerpendicularRight = (Y, -X), PerpendicularLeft = (-Y, X)
    if (this.inv) {
      this.nx = ny;
      this.ny = -nx;
    } else {
      this.nx = -ny;
      this.ny = nx;
    }
    this.extensionRatio = Math.min(0.25, ZONE / this.distance);
  }

  get limitLeft() {
    return this.extension & Ext.Left ? -this.extensionRatio : 0.0;
  }
  get limitRight() {
    return this.extension & Ext.Right ? 1.0 + this.extensionRatio : 1.0;
  }

  /**
   * StandardLine.Interact. Mutates the point p ({x,y,px,py,mx,my,f}).
   * Returns true on collision.
   */
  interact(p) {
    const nx = this.nx;
    const ny = this.ny;
    if (p.mx * nx + p.my * ny > 0) {
      const sdx = p.x - this.x1;
      const sdy = p.y - this.y1;
      const disty = nx * sdx + ny * sdy;
      if (disty > 0 && disty < ZONE) {
        const distx = (sdx * this.dx + sdy * this.dy) * this.dotScalar;
        if (distx <= this.limitRight && distx >= this.limitLeft) {
          const posx = p.x - disty * nx;
          const posy = p.y - disty * ny;
          if (p.f !== 0) {
            let fx = ny * p.f * disty;
            let fy = nx * p.f * disty;
            if (p.px >= posx) fx = -fx;
            if (p.py >= posy) fy = -fy;
            p.x = posx;
            p.y = posy;
            p.px = p.px + fx;
            p.py = p.py + fy;
          } else {
            p.x = posx;
            p.y = posy;
          }
          return true;
        }
      }
    }
    return false;
  }

  clone() {
    const l = new StandardLine(this.x1, this.y1, this.x2, this.y2, this.inv);
    l.id = this.id;
    l.extension = this.extension;
    return l;
  }
}

export class RedLine extends StandardLine {
  constructor(x1, y1, x2, y2, inv = false, multiplier = 1) {
    super(x1, y1, x2, y2, inv);
    this.type = LineType.Red;
    this.multiplier = multiplier;
    this.calculateConstants();
  }
  calculateConstants() {
    super.calculateConstants();
    const m = RED_CONST_ACC * (this.multiplier ?? 1);
    const ax = this.nx * m;
    const ay = this.ny * m;
    if (this.inv) {
      this.accX = ay;
      this.accY = -ax;
    } else {
      this.accX = -ay;
      this.accY = ax;
    }
  }
  interact(p) {
    if (super.interact(p)) {
      p.px = p.px + this.accX;
      p.py = p.py + this.accY;
      return true;
    }
    return false;
  }
  clone() {
    const l = new RedLine(this.x1, this.y1, this.x2, this.y2, this.inv, this.multiplier);
    l.id = this.id;
    l.extension = this.extension;
    return l;
  }
}

export function createLine(type, x1, y1, x2, y2, opts = {}) {
  switch (type) {
    case LineType.Blue:
      return new StandardLine(x1, y1, x2, y2, opts.inv);
    case LineType.Red:
      return new RedLine(x1, y1, x2, y2, opts.inv, opts.multiplier ?? 1);
    default:
      return new SceneryLine(x1, y1, x2, y2, opts.width ?? 1);
  }
}
