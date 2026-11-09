import { bound, checkEntryDeadline, cubicRoots, polynomialResidual, rootLocus, stepTrace, type Design, type Trace } from './math';
export interface Requirements { overshoot: number; deadline: number; ramp: number; horizon: number; maxGain: number }
/** Original full-model checks, without broadening the solver's design family. */
export function checkModel(d: Design, requirements: Requirements) {
  const { overshoot, deadline, ramp, horizon, maxGain } = requirements;
  bound(overshoot, 0, 100, 'Overshoot limit (%)'); bound(deadline, .1, 200, 'Entry deadline (s)'); bound(ramp, 0, 100, 'Ramp-error limit'); bound(horizon, .5, 200, 'Response horizon (s)'); bound(maxGain, .01, 10000, 'Root-locus maximum gain');
  const roots = cubicRoots(d.coefficients[1], d.coefficients[2], d.coefficients[3]);
  if (roots.some(r => r.re >= -1e-8)) throw new Error('The complete cubic roots are not resolved strictly in the left half-plane. Move the target or compensator pole.');
  const residual = Math.max(...roots.map(r => polynomialResidual(d.coefficients, r)));
  let locus: ReturnType<typeof rootLocus> | undefined, trace: Trace | undefined, locusError = '', traceError = '';
  try { locus = rootLocus(d, maxGain); } catch (error) { locusError = error instanceof Error ? error.message : 'The locus is unresolved.'; }
  try { trace = stepTrace(d, horizon); } catch (error) { traceError = error instanceof Error ? error.message : 'The response is unresolved.'; }
  return { d, requirements, roots, residual, locus, trace, locusError, traceError, entryCheck: trace ? checkEntryDeadline(trace, deadline) : 'Unresolved' };
}
export type Checked = ReturnType<typeof checkModel>;
