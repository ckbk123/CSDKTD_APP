import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CP06",
  title: "Root-locus construction",
  description: "Explore branch rules and the gain conditions.",
  domain: "continuous",
  category: "plots",
  defaultExample: "L(s) = K/(s(s+2)(s+5)); K >= 0",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
