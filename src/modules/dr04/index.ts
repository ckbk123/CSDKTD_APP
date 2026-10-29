import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DR04",
  title: "Sampled signal diagrams",
  description: "Trace sampling boundaries, delays and discrete Mason.",
  domain: "discrete",
  category: "representation",
  defaultExample: "G(s) = 5 exp(-0.2s)/s^2; T = 0.2 s; H = 0.1; C(z) = 10 - 2z^-1",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
