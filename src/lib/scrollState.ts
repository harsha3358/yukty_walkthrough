// Shared, mutable state read every frame by the 3D scene.
// Kept outside React so scrolling never triggers re-renders of the canvas.
export const scrollState = {
  // Continuous chapter position: 2.5 means halfway between chamber 2 and 3.
  chapter: 0,
  pointerX: 0,
  pointerY: 0,
};

// Fired by the 3D logo intro once the logo lands, so the hero text can follow it in.
export const LOGO_SETTLED_EVENT = "yukty:logo-settled";
