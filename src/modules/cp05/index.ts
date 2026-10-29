import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CP05",
  title: "Nyquist construction",
  description: "Map a contour into a complex response curve.",
  domain: "continuous",
  category: "plots",
  defaultExample: "L(s) = 4/((s+1)(s+2)); negative unity feedback",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
