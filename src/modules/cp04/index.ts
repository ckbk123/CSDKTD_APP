import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CP04",
  title: "Bode construction",
  description: "Build magnitude and phase from individual factors.",
  domain: "continuous",
  category: "plots",
  defaultExample: "G(s) = 1/((s+1)(s+2)); frequency unit: rad/s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
