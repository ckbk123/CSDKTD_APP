import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CD04",
  title: "Lead-lag: root locus",
  description: "Allocate transient and tracking requirements.",
  domain: "continuous",
  category: "design",
  defaultExample: "G(s) = 1/(s(s+2)); baseline C(s) = 4; negative unity feedback",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
