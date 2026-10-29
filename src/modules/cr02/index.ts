import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CR02",
  title: "ODE and Laplace",
  description: "Follow a linear equation into its transfer function.",
  domain: "continuous",
  category: "representation",
  defaultExample: "y'' + 3y' + 2y = u; y(0) = 0; y'(0) = 0",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
