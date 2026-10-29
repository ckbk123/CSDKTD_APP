import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CF01",
  title: "Transient specifications",
  description: "Inspect rise time, overshoot and settling time.",
  domain: "continuous",
  category: "performance",
  defaultExample: "T(s) = 4/(s^2+2s+4); unit step; settling band: 2%",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
