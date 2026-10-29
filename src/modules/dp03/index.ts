import type { ModuleManifest } from '../../core/module';

export const manifest = {
  id: "DP03",
  title: "Discrete Bode and Nyquist",
  description: "Explore unit-circle frequency and warped-plane views.",
  domain: "discrete",
  category: "plots",
  defaultExample: "G(z) = (0.0544z+0.0493)/(z^2-1.741z+0.741); T = 0.1 s",
  load: () => import('./workspace'),
} satisfies ModuleManifest;
