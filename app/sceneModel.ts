export const LANDING_SCENE = 0;
export const PROJECT_SCENE_START = 1;
export const PROJECT_SCENE_END = 4;
export const ABOUT_SCENE = 5;
export const CONTACT_SCENE = 6;
export const LAST_SCENE = CONTACT_SCENE;
export const TOTAL_SCENES = LAST_SCENE + 1;

export const projectIndexToScene = (projectIndex: number) =>
  Math.max(
    PROJECT_SCENE_START,
    Math.min(PROJECT_SCENE_END, projectIndex + PROJECT_SCENE_START),
  );

export const sceneToProjectIndex = (sceneIndex: number) =>
  Math.max(
    0,
    Math.min(
      PROJECT_SCENE_END - PROJECT_SCENE_START,
      sceneIndex - PROJECT_SCENE_START,
    ),
  );

export const isProjectScene = (sceneIndex: number) =>
  sceneIndex >= PROJECT_SCENE_START && sceneIndex <= PROJECT_SCENE_END;
