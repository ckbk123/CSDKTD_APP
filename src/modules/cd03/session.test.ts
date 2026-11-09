import { expect, it, vi } from 'vitest';
import * as responseMath from './response';
import * as modelMath from './model';
import { baselineDesign, check, initialRequirements, moveCorner } from './session';

it('retains the actual proportional baseline and independently known accuracy/transient result', () => {
  const c = check(baselineDesign(), initialRequirements());
  expect(c.model.baselineKv).toBe(2); expect(c.model.rampError).toBe(.5); expect(c.assessment.accuracy).toBe('failed'); expect(c.assessment.transient).toBe('met');
  expect(c.full).toBe(c.baseline); expect(c.full.metrics!.overshoot * 100).toBeCloseTo(16.303353482158, 8); expect(c.full.metrics!.settling).toBeCloseTo(4.038174486964, 7);
});
it('reassesses only changed requirements without solving or measuring the retained signals again', () => {
  const c = check({ ...baselineDesign(), lag: true }, initialRequirements()), build = vi.spyOn(modelMath, 'model'), measure = vi.spyOn(responseMath, 'measure'), response = vi.spyOn(responseMath, 'response');
  try { const next = check(c.design, { ...c.requirements, kv: 20.000000001, overshoot: 30, settling: 10 }, c); expect(next.assessment.accuracy).toBe('unknown'); expect(next.full).toBe(c.full); expect(build).not.toHaveBeenCalled(); expect(measure).not.toHaveBeenCalled(); expect(response).not.toHaveBeenCalled(); }
  finally { vi.restoreAllMocks(); }
});
it('preserves the ratio during the independently validated near-zero experiment', () => {
  const initial = check({ ...baselineDesign(), lag: true }, initialRequirements()); expect(initial.model.kv).toBe(20); expect(initial.full.metrics!.overshoot * 100).toBeCloseTo(22.24909, 4); expect(initial.assessment.transient).toBe('failed');
  const d = moveCorner(initial.design, 'ratio', .002), next = check(d, initial.requirements, initial); expect(d.z).toBe(.02); expect(next.model.kv).toBe(20); expect(next.full.metrics!.overshoot * 100).toBeCloseTo(17.52078, 4); expect(next.full.metrics!.settling).toBeCloseTo(2.927166, 4); expect(next.assessment.prediction).toBe('both'); expect(next.baseline).toBe(initial.baseline);
});
it('retains complete unstable/boundary roots and uncertainty without asserting a final ramp limit', () => {
  const d = { ...baselineDesign(), lag: true };
  const unstable = check({ ...d, z: 3 }, initialRequirements()); expect(unstable.model.fullRoots).toHaveLength(3); expect(unstable.model.stability).toBe('unstable'); expect(unstable.model.rampError).toBeUndefined(); expect(unstable.full.metrics).toBeUndefined(); expect(unstable.full.issue).toContain('unstable');
  const boundary = check({ ...d, z: 2.02005 }, initialRequirements()); expect(boundary.model.stability).toBe('boundary'); expect(boundary.assessment.accuracy).toBe('unknown'); expect(boundary.model.rampError).toBeUndefined();
});
it('rejects ratio/corner domain crossings atomically without changing the original design', () => {
  const d = Object.freeze({ ...baselineDesign(), lag: true }); expect(() => moveCorner(d, 'p', .1)).toThrow('p<z'); expect(() => moveCorner(d, 'ratio', .0009)).toThrow(); expect(() => moveCorner(d, 'ratio', .6)).toThrow(); expect(d.p).toBe(.01); expect(d.z).toBe(.1);
});
it('remeasures changed H or band using the existing modal signals, without rebuilding response or roots', () => {
  const c = check({ ...baselineDesign(), lag: true }, initialRequirements()), build = vi.spyOn(modelMath, 'model'), measure = vi.spyOn(responseMath, 'measure'), response = vi.spyOn(responseMath, 'response');
  try { const next = check(c.design, { ...c.requirements, horizon: 10, band: .05 }, c); expect(next.baseline.signal).toBe(c.baseline.signal); expect(next.full.signal).toBe(c.full.signal); expect(measure).toHaveBeenCalledTimes(2); expect(build).not.toHaveBeenCalled(); expect(response).not.toHaveBeenCalled(); }
  finally { vi.restoreAllMocks(); }
});
it('retains every characteristic mode at a canceled controller zero', () => {
  const c = check({ ...baselineDesign(), lag: true, z: 2 }, initialRequirements()); expect(c.model.fullRoots).toHaveLength(3); expect(c.full.signal.response!.poles).toHaveLength(3); expect(c.model.fullRoots.some(root => Math.abs(root.re + 2) < 1e-10 && root.im === 0)).toBe(true);
});
it('caches explicit measurement failures rather than repeating them on assessment-only target changes', () => {
  const d = { a: 4, b: 4, k: 100, lag: true, p: .01, z: .1 }, c = check(d, { ...initialRequirements(), horizon: 200 }); expect(c.model.fullRoots).toHaveLength(3); expect(c.full.metrics).toBeUndefined(); expect(c.full.issue).toContain('response-grid limit');
  const measure = vi.spyOn(responseMath, 'measure'); try { const next = check(d, { ...c.requirements, overshoot: 40 }, c); expect(next.full).toBe(c.full); expect(next.full.issue).toBe(c.full.issue); expect(measure).not.toHaveBeenCalled(); } finally { vi.restoreAllMocks(); }
});
