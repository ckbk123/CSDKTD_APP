import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "CD01",
  title: "PID structure and tuning",
  description: "Compare linear controller actions and derivative filtering.",
  domain: "continuous",
  category: "design",
  defaultExample: "G(s) = 1/((s+1)(s+2)); Kp = 4; Ki = 2; Kd = 1; Tf = 0.05 s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
