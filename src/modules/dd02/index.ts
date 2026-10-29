import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DD02",
  title: "Discrete lead and lag",
  description: "Design compensation directly in the z plane.",
  domain: "discrete",
  category: "design",
  defaultExample: "G(s) = 50/(s(s+5)); ZOH T = 0.1 s; target zeta = 0.707, wn = 10 rad/s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
