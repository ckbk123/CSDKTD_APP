import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CF05",
  title: "Time-frequency tradeoffs",
  description: "Compare performance predictions with full responses.",
  domain: "continuous",
  category: "performance",
  defaultExample: "G(s) = 1/(s(s+2)); C(s) = 12(s+8/3)/(s+6)",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
