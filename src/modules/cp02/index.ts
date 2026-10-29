import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CP02",
  title: "Poles, zeros and modes",
  description: "Connect pole and zero locations with response shape.",
  domain: "continuous",
  category: "plots",
  defaultExample: "G(s) = 4/(s^2+2s+4); input: unit step",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
