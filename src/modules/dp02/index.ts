import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DP02",
  title: "Pole mapping",
  description: "Connect the s plane, unit circle and sample period.",
  domain: "discrete",
  category: "plots",
  defaultExample: "s = -2 + 3j and -2 - 3j; z = exp(sT); T = 0.1 s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
