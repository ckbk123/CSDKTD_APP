import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DD06",
  title: "Discrete state feedback",
  description: "Check controllability and place sampled state poles.",
  domain: "discrete",
  category: "design",
  defaultExample: "A = [0,1; -2,-3]; B = [0;1]; ZOH T = 0.1 s; targets = 0.7, 0.8",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
