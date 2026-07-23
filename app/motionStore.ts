export type CorridorMotion = {
  progress: number;
  velocity: number;
  pointerX: number;
  pointerY: number;
  entered: boolean;
  routeTransition: number;
  reducedMotion: boolean;
  mobile: boolean;
};

export const CORRIDOR_MOTION: CorridorMotion = {
  progress: 0,
  velocity: 0,
  pointerX: 0,
  pointerY: 0,
  entered: false,
  routeTransition: 0,
  reducedMotion: false,
  mobile: false,
};

export const SCENE_COUNT = 7;
export const LAST_SCENE = SCENE_COUNT - 1;
