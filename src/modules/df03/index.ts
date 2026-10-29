import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DF03",
  title: "Discrete frequency quality",
  description: "Read sampled-loop crossovers, margins and bandwidth.",
  domain: "discrete",
  category: "performance",
  defaultExample: "L(z) = 0.5/(z-0.8); negative unity feedback; T = 0.1 s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
