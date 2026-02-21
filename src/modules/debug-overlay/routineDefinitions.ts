import type { RoutineDefinition } from './types';

export const ROUTINE_DEFINITIONS: RoutineDefinition[] = [
  {
    type: 'baseline',
    label: 'Baseline (steady hold)',
    instructions:
      'Hold the camera steady, 20–40 cm from a single well-lit photo. ' +
      'Keep the print fully visible and centred for the full 30 seconds.',
  },
  {
    type: 'glare',
    label: 'Glare / reflections',
    instructions:
      'Point at a photo under a direct light source or window. ' +
      'Tilt the device slightly so glare appears on the print surface throughout the session.',
  },
  {
    type: 'motion-blur',
    label: 'Motion blur (shaky camera)',
    instructions:
      'Hold the camera 20–40 cm from a photo and introduce gentle, continuous ' +
      'side-to-side and up-down movement — enough to cause occasional blur but not ' +
      'enough to leave the frame entirely.',
  },
  {
    type: 'poor-lighting',
    label: 'Poor lighting (dim or bright room)',
    instructions:
      'Point at a photo in a very dim room, or directly under a bright overhead lamp. ' +
      'Keep the photo centred; the goal is to stress the brightness/darkness thresholds.',
  },
  {
    type: 'multi-photo-switch',
    label: 'Multi-photo switching',
    instructions:
      'Place two printed photos side by side. Alternate pointing the camera at each ' +
      'photo every 5–8 seconds. Let recognition confirm before switching.',
  },
  {
    type: 'collision',
    label: 'Collision test (visually similar photos)',
    instructions:
      'Use two photos of the same band or with similar composition. Point the camera ' +
      'at one, wait for recognition, then slowly pan to the other. Repeat 2–3 times.',
  },
];
