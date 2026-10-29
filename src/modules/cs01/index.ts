import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CS01",
  title: "Pole stability",
  description: "Distinguish transfer poles and internal state modes.",
  domain: "continuous",
  category: "stability",
  defaultExample: "G(s) = 1/((s+1)(s+2)); poles = -1, -2",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
