import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CR01",
  title: "Polynomial laboratory",
  description: "Expand expressions, inspect factors and locate roots.",
  domain: "continuous",
  category: "representation",
  defaultExample: "P(s) = s^4 + 7s^3 + 27s^2 + 47s + 26",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
