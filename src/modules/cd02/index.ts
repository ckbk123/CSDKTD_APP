import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CD02",
  title: "Lead: root locus",
  description: "Place a lead compensator from a target pole pair.",
  domain: "continuous",
  category: "design",
  defaultExample: "G(s) = 1/(s(s+2)); targets = -2 +/- 2j; compensator pole = -6",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
