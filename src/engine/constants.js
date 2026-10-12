// Port of linerider-advanced: src/Game/Physics/RiderConstants.cs
// https://github.com/jealouscloud/linerider-advanced (GPL-3.0)
//
// Coordinates are in Line Rider "pixels" (track units). y grows downward.
// The simulation runs at a fixed 40 frames per second.

export const PHYSICS_RATE = 40; // frames per second (Constants.PhysicsRate)
export const CELL_SIZE = 14; // SimulationGrid.CellSize
export const GRAVITY_X = 0;
export const GRAVITY_Y = 0.175; // RiderConstants.Gravity
export const ENDURANCE_FACTOR = 0.0285;
export const STARTING_MOMENTUM = 0.4;

// Contact point indices
export const SledTL = 0; // "peg"
export const SledBL = 1; // "tail"
export const SledBR = 2; // "nose"
export const SledTR = 3; // "string"
export const BodyButt = 4;
export const BodyShoulder = 5;
export const BodyHandLeft = 6;
export const BodyHandRight = 7;
export const BodyFootLeft = 8;
export const BodyFootRight = 9;

export const DEFAULT_RIDER = [
  [0, 0],
  [0, 5],
  [15, 5],
  [17.5, 0],
  [5, 0],
  [5, -5.5],
  [11.5, -5],
  [11.5, -5],
  [10, 5],
  [10, 5],
];

export const DEFAULT_SCARF = [
  [-2, -0.5],
  [-3.5, -0.5],
  [-5.5, -0.5],
  [-7, -0.5],
  [-9, -0.5],
  [-11.5, -0.5],
];

// Bone definitions in the exact order of RiderConstants' static constructor.
// (The duplicated shoulder -> right hand bone is in the original too.)
// [joint1, joint2, breakable, onlyRepel]
export const BONE_DEFS = [
  [SledTL, SledBL, false, false],
  [SledBL, SledBR, false, false],
  [SledBR, SledTR, false, false],
  [SledTR, SledTL, false, false],
  [SledTL, SledBR, false, false],
  [SledTR, SledBL, false, false],

  [SledTL, BodyButt, true, false],
  [SledBL, BodyButt, true, false],
  [SledBR, BodyButt, true, false],

  [BodyShoulder, BodyButt, false, false],
  [BodyShoulder, BodyHandLeft, false, false],
  [BodyShoulder, BodyHandRight, false, false],
  [BodyButt, BodyFootLeft, false, false],
  [BodyButt, BodyFootRight, false, false],
  [BodyShoulder, BodyHandRight, false, false],

  [BodyShoulder, SledTL, true, false],
  [SledTR, BodyHandLeft, true, false],
  [SledTR, BodyHandRight, true, false],
  [BodyFootLeft, SledBR, true, false],
  [BodyFootRight, SledBR, true, false],

  [BodyShoulder, BodyFootLeft, false, true],
  [BodyShoulder, BodyFootRight, false, true],
];

// Scarf bones: AddScarfBone(index) for index 1..6
export const SCARF_BONES = [1, 2, 3, 4, 5, 6].map((i) => ({
  joint1: i - 1,
  joint2: i,
  rest: i % 2 === 0 ? 1.5 : 2.0,
  breakable: false,
  onlyRepel: false,
}));

export function pointFriction(i) {
  switch (i) {
    case SledTL:
    case BodyButt:
    case BodyShoulder:
      return 0.8;
    case BodyHandLeft:
    case BodyHandRight:
      return 0.1;
    default:
      return 0.0;
  }
}

export const LineType = { Blue: 0, Red: 1, Scenery: 2 };
export const Ext = { None: 0, Left: 1, Right: 2, Both: 3 };
