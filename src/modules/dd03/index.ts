import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DD03",
  title: "Discrete frequency design",
  description: "Design in a transformed plane and verify the sampled loop.",
  domain: "discrete",
  category: "design",
  defaultExample: "G(s) = 1/(s(s+2)); ZOH T = 0.1 s; baseline controller C = 4",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
