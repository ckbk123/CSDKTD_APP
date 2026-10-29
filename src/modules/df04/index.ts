import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DF04",
  title: "Sample-period tradeoffs",
  description: "Compare fixed and redesigned sampled controllers.",
  domain: "discrete",
  category: "performance",
  defaultExample: "G(s) = 1/(s+1); C = 2; zero-order hold; T = 0.1 s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
