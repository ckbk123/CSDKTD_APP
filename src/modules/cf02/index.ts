import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CF02",
  title: "Steady-state error",
  description: "Compare tracking inputs and error constants.",
  domain: "continuous",
  category: "performance",
  defaultExample: "L(s) = 4/(s(s+2)); unity feedback; reference: r(t) = t",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
