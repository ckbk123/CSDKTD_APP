import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CS04",
  title: "Nyquist stability",
  description: "Connect encirclements with closed-loop stability.",
  domain: "continuous",
  category: "stability",
  defaultExample: "L(s) = 4/((s+1)(s+2)); negative unity feedback",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
