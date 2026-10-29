import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DF01",
  title: "Sampled transient quality",
  description: "Measure response in sample counts and seconds.",
  domain: "discrete",
  category: "performance",
  defaultExample: "G(z) = 0.2/(z-0.8); unit step; T = 0.1 s; settling band: 2%",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
