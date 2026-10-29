import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DD07",
  title: "Discrete observer",
  description: "Estimate sampled states with explicit update timing.",
  domain: "discrete",
  category: "design",
  defaultExample: "A = [0,1; -2,-3]; C = [1,0]; ZOH T = 0.1 s; observer targets = 0.3, 0.4",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
