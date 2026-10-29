import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CR04",
  title: "Block diagrams",
  description: "Build and simplify scalar feedback diagrams.",
  domain: "continuous",
  category: "representation",
  defaultExample: "G1 = 1/(s+1); G2 = 1/(s+2); H2 = 2; H1 = 1; negative feedback",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
