import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DR01",
  title: "Z transforms",
  description: "Connect causal sequences with transform expressions.",
  domain: "discrete",
  category: "representation",
  defaultExample: "h[k] = 0.8^k for k >= 0; initial history: zero",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
