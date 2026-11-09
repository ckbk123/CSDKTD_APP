import { experiment, poles, type Plant } from './math';

/** Existing analytic solver plus the original bounded drawing policy. */
export function prepare(plant: Plant, w: number, A: number, t0: number) {
  if (!Number.isFinite(t0) || t0 < 0 || t0 > 1000) throw new Error('Window start must be between 0 and 1000 s.');
  const e = experiment(plant, w, A), t1 = t0 + 3 * e.period;
  const samples = Array.from({ length: 901 }, (_, i) => { const t = t0 + (t1 - t0) * i / 900; return { t, ...e.particular(t) }; });
  const responseAmplitude = A * e.value.magnitude, bound = e.tailBound(t0), tolerance = Math.max(1e-9, responseAmplitude * .01), settled = e.stable && bound <= tolerance;
  const rate = Math.max(w, ...poles(plant).map(p => Math.hypot(p.re, p.im))), steps = settled ? 900 : Math.max(900, Math.ceil((t1 - t0) * rate * 10));
  let actual: ({ t: number } & ReturnType<typeof e.sample>)[] | undefined, actualError = '';
  try {
    if (steps > 12000) throw new Error('This three-period window cannot resolve the transient within 12001 samples. Increase ω, choose slower modes, or move to a settled window.');
    actual = Array.from({ length: steps + 1 }, (_, i) => { const t = t0 + (t1 - t0) * i / steps; return { t, ...e.sample(t) }; });
  } catch (error) { actualError = error instanceof Error ? error.message : 'The zero-state response could not be displayed.'; }
  return { plant, w, A, t0, t1, e, samples, actual, actualError, responseAmplitude, bound, tolerance, settled };
}
export type Trial = ReturnType<typeof prepare>;
