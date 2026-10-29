import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CP01",
  title: "Time response",
  description: "Inspect step, ramp and initial-condition responses.",
  domain: "continuous",
  category: "plots",
  defaultExample: "G(s) = 1/((s+1)(s+2)); input: unit step; initial state: zero",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
