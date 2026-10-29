import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CF04",
  title: "Frequency specifications",
  description: "Read margins, bandwidth and resonant behavior.",
  domain: "continuous",
  category: "performance",
  defaultExample: "G(s) = 1/(s(s+2)); C(s) = 4; L(s) = C(s)G(s)",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
