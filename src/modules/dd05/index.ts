import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DD05",
  title: "Analytical digital PID",
  description: "Match a sampled characteristic equation to targets.",
  domain: "discrete",
  category: "design",
  defaultExample: "G(s) = 10/(10s+1); H = 0.05; T = 2 s; zeta = 0.707; wn = 2 rad/s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
