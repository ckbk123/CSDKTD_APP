import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CF03",
  title: "Error and effort",
  description: "Compare integral error measures and control effort.",
  domain: "continuous",
  category: "performance",
  defaultExample: "G(s) = 1/((s+1)(s+2)); C(s) = 4; unit step; horizon: 10 s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
