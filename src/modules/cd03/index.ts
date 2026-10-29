import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CD03",
  title: "Lag: root locus",
  description: "Improve tracking while checking transient changes.",
  domain: "continuous",
  category: "design",
  defaultExample: "G(s) = 1/(s(s+2)); baseline C(s) = 4; unit-ramp reference",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
