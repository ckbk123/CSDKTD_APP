import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CD09",
  title: "Luenberger observer",
  description: "Estimate vector state from one measured output.",
  domain: "continuous",
  category: "design",
  defaultExample: "A = [0,1; -2,-3]; B = [0;1]; C = [1,0]; observer targets = -6, -7",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
