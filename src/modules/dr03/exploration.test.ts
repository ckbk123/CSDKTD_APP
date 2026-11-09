import { describe, expect, it, vi } from 'vitest';
import { baseline, compute, inspect, withModel, type Source } from './exploration';
import { parseModel } from './parser';
import { run } from './math';
vi.mock('./math', async original => { const actual = await original<typeof import('./math')>(); return { ...actual, run: vi.fn(actual.run) }; });
const source = (text: string, extra: Partial<Source['experiment']> = {}): Source => ({ model: parseModel(text), sourceT: null, experiment: { T: .1, count: 5, delay: 0, amplitude: 1, kind: 'step', pastY: [0], pastU: [0], ...extra } });
describe('DR03 qualified experiment snapshots and cached inspection', () => {
  it('matches the independent mechanical response while all cursor targets reuse checked rows', () => {
    const checked = compute(baseline()), calls = vi.mocked(run).mock.calls.length, selected = inspect(checked, 10, 'y'); expect(selected.row).toBe(checked.result.rows[10]); expect(selected.value).toBeCloseTo(.5 - Math.exp(-1) + .5 * Math.exp(-2), 11); for (const k of [0, 10, 20]) { for (const target of ['y', 0, 1, 2, 3] as const) inspect(checked, k, target); } expect(vi.mocked(run).mock.calls).toHaveLength(calls); expect(selected.controller!.y).toBeCloseTo(selected.value, 11); expect(selected.observer!.y).toBeCloseTo(selected.value, 11);
  });
  it('preserves old-memory simultaneous updates and properly mapped canonical initial states', () => {
    const checked = compute(source('(2z^2+3z+4)/(z^2-.5z+.125)', { pastY: [1, -2], pastU: [3, -1] })); const first = inspect(checked, 0, 0); expect(first.row.x).toEqual([1, -2, 3, -1]); expect(first.row.y).toBe(31 / 4); expect(first.row.next).toEqual([31 / 4, 1, 1, 3]); expect(inspect(checked, 0, 1).value).toBe(1); expect(inspect(checked, 1, 'y').value).toBe(83 / 4);
    const mapped = compute(source('1/(z-.5)', { pastY: [4], pastU: [3], amplitude: 0 })); expect(mapped.result.controller!.initial).toEqual([5]); expect(mapped.result.observer!.initial).toEqual([5]); expect([0, 1, 2].map(k => inspect(mapped, k, 'y').value)).toEqual([5, 2.5, 1.25]);
  });
  it('reruns a T-dependent ramp rather than treating T as timestamp-only', () => {
    const first = compute(source('1/(z-.5)', { kind: 'ramp' })), calls = vi.mocked(run).mock.calls.length, second = compute({ ...first, experiment: { ...first.experiment, T: .2 } }); expect(vi.mocked(run).mock.calls.length).toBe(calls + 1); expect(first.result.inputs).toEqual([0, .1, .2, .30000000000000004, .4]); expect(first.result.rows.map(row => row.y)).toEqual([0, 0, .1, .25, .42500000000000004]); second.result.rows.forEach((row, i) => expect(row.y).toBeCloseTo(first.result.rows[i].y * 2, 14)); expect(inspect(second, 4, 'y').row.t).toBe(.8);
  });
  it('keeps pure delays and feedthrough separate, including the zero-storage gain', () => {
    const direct = compute(source('3', { pastY: [], pastU: [] })); expect(direct.result.history.A).toEqual([]); expect(inspect(direct, 0, 'y').value).toBe(3); expect(() => inspect(direct, 0, 0)).toThrow('current history'); const delayed = compute(source('3', { delay: 4, amplitude: 2, pastY: [], pastU: [5, -2, 7, 3] })); expect(delayed.result.history.A).toHaveLength(4); expect(delayed.result.rows.map(row => row.y)).toEqual([9, 21, -6, 15, 6]);
  });
  it('retains hidden declared memory while canonical maps are unavailable and preserves accuracy withholding', () => {
    const hidden = compute(source('(z-.5)/(z-.5)', { pastY: [4], pastU: [3], amplitude: 0 })); expect(hidden.result.canonicalWarning).toContain('unavailable'); expect(hidden.result.controller).toBeUndefined(); expect(inspect(hidden, 0, 'y').value).toBe(.5); const before = compute(baseline()); expect(() => compute(source('1/(z^2-2.1z+.9)', { count: 81, amplitude: 0, pastY: [.66, 1.1], pastU: [0, 0] }))).toThrow('Roundoff amplification'); expect(inspect(before, 10, 'y').value).toBeCloseTo(.199788200446864, 12);
  });
  it('retains matching declared histories on explicit model changes, adds zero cells and validates inspection', () => {
    const original = source('1/(z-.5)', { delay: 2, pastY: [4], pastU: [3, 2, 1] }), changed = withModel(original, parseModel('1/(z^2-.5z+.125)')); expect(changed.experiment.pastY).toEqual([4, 0]); expect(changed.experiment.pastU).toEqual([3, 2, 1, 0]); expect(original.experiment.pastY).toEqual([4]); const checked = compute(baseline()); expect(() => inspect(checked, .5, 'y')).toThrow('integer'); expect(() => inspect(checked, 21, 'y')).toThrow('integer');
  });
});
