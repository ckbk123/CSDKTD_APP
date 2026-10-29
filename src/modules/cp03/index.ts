import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CP03",
  title: "Sinusoidal response",
  description: "Relate gain and phase to time-domain sinusoids.",
  domain: "continuous",
  category: "plots",
  defaultExample: "G(s) = 1/((s+1)(s+2)); u(t) = sin(t); omega = 1 rad/s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
