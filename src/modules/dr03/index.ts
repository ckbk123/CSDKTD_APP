import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DR03",
  title: "Discrete state models",
  description: "Compare delay, transfer and state representations.",
  domain: "discrete",
  category: "representation",
  defaultExample: "A = [0,1; -2,-3]; B = [0;1]; C = [1,0]; use ZOH at T = 0.1 s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
