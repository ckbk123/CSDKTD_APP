import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CD07",
  title: "PID tuning rules",
  description: "Inspect rule assumptions and compare resulting designs.",
  domain: "continuous",
  category: "design",
  defaultExample: "G(s) = exp(-0.5s)/(2s+1); response-curve tuning example",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
