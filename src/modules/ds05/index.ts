import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DS05",
  title: "Discrete Nyquist stability",
  description: "Relate the unit-circle mapping to closed-loop roots.",
  domain: "discrete",
  category: "stability",
  defaultExample: "L(z) = 0.5/(z-0.8); negative unity feedback; T = 0.1 s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
