import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DS03",
  title: "Bilinear Routh",
  description: "Map the unit disk into a half-plane stability test.",
  domain: "discrete",
  category: "stability",
  defaultExample: "P(z) = z^2 + (K-1)z + 0.2K; z = (1+w)/(1-w)",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
