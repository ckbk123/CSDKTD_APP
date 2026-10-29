import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DF02",
  title: "Discrete tracking error",
  description: "Compare physical-time ramps and sequence ramps.",
  domain: "discrete",
  category: "performance",
  defaultExample: "L(z) = 0.1/(z-1); unity feedback; r[k] = kT; T = 0.1 s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
