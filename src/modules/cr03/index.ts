import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CR03",
  title: "State representations",
  description: "Compare transfer functions and state coordinates.",
  domain: "continuous",
  category: "representation",
  defaultExample: "A = [0,1; -2,-3]; B = [0;1]; C = [1,0]; D = 0",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
