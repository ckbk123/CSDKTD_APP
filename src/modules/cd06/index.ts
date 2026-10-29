import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CD06",
  title: "Lag: frequency design",
  description: "Shape low-frequency gain and check phase effects.",
  domain: "continuous",
  category: "design",
  defaultExample: "G(s) = 1/(s(s+2)); C0 = 4; negative unity feedback",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
