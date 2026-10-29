import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DP01",
  title: "Sequence response",
  description: "Inspect sampled steps, ramps and modal sequences.",
  domain: "discrete",
  category: "plots",
  defaultExample: "G(z) = 0.2/(z-0.8); unit-step input; T = 0.1 s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
