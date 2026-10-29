import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CS03",
  title: "Stable parameter regions",
  description: "Derive gain intervals and inspect their boundaries.",
  domain: "continuous",
  category: "stability",
  defaultExample: "P(s) = s^3 + 7s^2 + 10s + K; parameter: K",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
