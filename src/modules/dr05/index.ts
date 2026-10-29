import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DR05",
  title: "Sampling and ZOH",
  description: "Derive a sampled model under a declared hold.",
  domain: "discrete",
  category: "representation",
  defaultExample: "G(s) = 1/(s+1); zero-order hold; T = 0.1 s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
