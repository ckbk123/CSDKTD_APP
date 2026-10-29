import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DS04",
  title: "Stable discrete gains",
  description: "Locate unit-circle crossings and stable gain regions.",
  domain: "discrete",
  category: "stability",
  defaultExample: "L(z) = K(z+0.2)/(z(z-1)); negative unity feedback",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
