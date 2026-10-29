import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DP04",
  title: "Discrete root locus",
  description: "Construct gain branches in the z plane.",
  domain: "discrete",
  category: "plots",
  defaultExample: "L(z) = K(z+0.2)/(z(z-1)); K >= 0; T = 0.1 s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
