import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DD01",
  title: "Controller emulation",
  description: "Apply Euler or Tustin to a continuous controller.",
  domain: "discrete",
  category: "design",
  defaultExample: "C(s) = 12(s+8/3)/(s+6); Tustin; T = 0.1 s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
