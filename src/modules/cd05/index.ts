import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CD05",
  title: "Lead: frequency design",
  description: "Choose phase boost and verify the actual crossover.",
  domain: "continuous",
  category: "design",
  defaultExample: "G(s) = 1/(s(s+2)); C0 = 4; target crossover = 2 rad/s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
