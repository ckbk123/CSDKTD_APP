import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DD04",
  title: "Digital PID",
  description: "Derive and single-step a position or incremental PID.",
  domain: "discrete",
  category: "design",
  defaultExample: "Kp = 4; Ki = 2; Kd = 1; T = 0.1 s; trapezoidal I; backward D",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
