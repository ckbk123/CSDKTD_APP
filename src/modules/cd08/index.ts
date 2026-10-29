import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CD08",
  title: "State feedback",
  description: "Place state poles and set the scalar reference gain.",
  domain: "continuous",
  category: "design",
  defaultExample: "A = [0,1; -2,-3]; B = [0;1]; C = [1,0]; targets = -2, -4",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
