import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DS02",
  title: "Jury criterion",
  description: "Derive discrete stability conditions and intervals.",
  domain: "discrete",
  category: "stability",
  defaultExample: "P(z) = z^2 + (K-1)z + 0.2K; parameter: K",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
