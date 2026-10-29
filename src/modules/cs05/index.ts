import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CS05",
  title: "Stable root-locus gains",
  description: "Find gains that place every pole in the left half-plane.",
  domain: "continuous",
  category: "stability",
  defaultExample: "L(s) = K/(s(s+2)(s+5)); K >= 0",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
