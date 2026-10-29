import type { ModuleManifest } from '../../core/module';

export const manifest = Object.freeze({
  id: "DR02",
  title: "Difference equations",
  description: "Step through delay memory and coefficient order.",
  domain: "discrete",
  category: "representation",
  defaultExample: "y[k+1] = 0.90483742 y[k] + 0.09516258 u[k]; T = 0.1 s",
  load: () => import('./workspace'),
} satisfies ModuleManifest);
