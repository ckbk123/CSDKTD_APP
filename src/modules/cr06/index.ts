import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CR06",
  title: "Dynamic states",
  description: "Choose integrator states and inspect trajectories.",
  domain: "continuous",
  category: "representation",
  defaultExample: "x1' = x2; x2' = -2x1 - 3x2 + u; y = x1; x(0) = [0;0]",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
