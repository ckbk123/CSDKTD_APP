import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CS02",
  title: "Routh and Hurwitz",
  description: "Work through stability tables and special rows.",
  domain: "continuous",
  category: "stability",
  defaultExample: "P(s) = s^3 + 7s^2 + 10s + K; K = 20",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
