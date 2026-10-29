import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DS01",
  title: "Unit-circle stability",
  description: "Classify pole radius, boundary and hidden modes.",
  domain: "discrete",
  category: "stability",
  defaultExample: "Modes: 0.8^k and (-0.8)^k; T = 0.1 s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
