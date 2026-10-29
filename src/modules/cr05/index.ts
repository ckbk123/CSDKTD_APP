import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CR05",
  title: "Signal flow and Mason",
  description: "Trace paths, loops and Mason determinants.",
  domain: "continuous",
  category: "representation",
  defaultExample: "G1 = 1/(s+1); G2 = 1/(s+2); inner H2 = 2; outer H1 = 1",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
