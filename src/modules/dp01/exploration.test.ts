import { describe, expect, it, vi } from 'vitest';
import * as original from './math';
import { baseline, compute, computeLab, inspect, labBaseline, moveLab, nudgeLabRadius } from './exploration';
describe('DP01 checked source and independent live mode comparison', () => {
  it('reaches declared key endpoints without relaxing native comparison bounds', () => {
    let radius = .8; for (let i = 0; i < 70; i++) radius = computeLab({ ...labBaseline(), radius: nudgeLabRadius(radius, .01) }).radius; expect(radius).toBe(1.5);
    radius = .8; for (let i = 0; i < 80; i++) radius = computeLab({ ...labBaseline(), radius: nudgeLabRadius(radius, -.01) }).radius; expect(radius).toBe(0);
    expect(() => computeLab({ ...labBaseline(), radius: nudgeLabRadius(0, -.01) })).toThrow('shared radius'); expect(() => computeLab({ ...labBaseline(), radius: nudgeLabRadius(1.5, .01) })).toThrow('shared radius');
    expect(computeLab({ ...labBaseline(), radius: 1.5 }).radius).toBe(1.5); expect(() => computeLab({ ...labBaseline(), radius: 1.5000000000000002 })).toThrow('shared radius');
  });
  it('retains the original delayed baseline and reads cached arithmetic without rerunning simulation', () => {
    const checked = compute(baseline()), run = vi.spyOn(original, 'simulate'); try { expect(checked.rows!.slice(0, 4).map(row => Number(row.y.toFixed(6)))).toEqual([0, .2, .36, .488]); const selected = inspect(checked, 3); expect(selected.row).toBe(checked.rows![3]); expect(selected.output).toEqual([{ index: 2, weight: .8, value: .36000000000000004 }]); expect(selected.input[1]).toEqual({ index: 2, weight: .2, value: 1 }); for (let k = 0; k < 41; k++) inspect(checked, k); expect(run).not.toHaveBeenCalled(); } finally { run.mockRestore(); }
  });
  it('preserves full-model histories, hidden modes and the scaled far-pole experiment', () => {
    const source = baseline(), hidden = compute({ ...source, expression: '(z-2)/((z-2)(z-.5))', customHistory: true, experiment: { ...source.experiment, count: 4, history: [0, -1] } }); expect(hidden.roots.some(root => root.re === 2)).toBe(true); expect(hidden.rows!.map(row => row.free)).toEqual([1, 2.5, 5.25, 10.625]); const far = compute({ ...source, expression: 'z/(z-10000)', experiment: { ...source.experiment, input: 'impulse', amplitude: .0001, count: 4 } }); expect(far.rows!.map(row => row.y)).toEqual([.0001, 1, 10000, 1e8]); expect(far.roots[0].re).toBe(10000); expect(far.impulseFormula).toContain('10000');
  });
  it('keeps fixed-z timing separate from the T-dependent physical ramp without resampling a plant', () => {
    const source = baseline(), first = compute(source), timed = compute({ ...source, experiment: { ...source.experiment, T: .25 } }); expect(timed.model).toEqual(first.model); expect(timed.roots).toEqual(first.roots); expect(timed.rows!.map(row => row.y)).toEqual(first.rows!.map(row => row.y)); expect(inspect(timed, 4).row.t).toBe(1); const ramp = compute({ ...source, experiment: { ...source.experiment, input: 'ramp' } }), rampT = compute({ ...source, experiment: { ...source.experiment, T: .25, input: 'ramp' } }); expect(inspect(ramp, 3).row.y).toBeCloseTo(.056, 13); rampT.rows!.forEach((row, k) => expect(row.y).toBeCloseTo(ramp.rows![k].y * 2.5, 11));
  });
  it('preserves repeated, zero, conjugate and direct-feedthrough behavior through original engines', () => {
    const source = baseline(), repeated = compute({ ...source, expression: '1/(z-1)^2', customHistory: true, experiment: { ...source.experiment, input: 'free', history: [1, 0], count: 4 } }); expect(repeated.rows!.map(row => row.y)).toEqual([2, 3, 4, 5]); const zero = compute({ ...source, expression: '1/z^2', experiment: { ...source.experiment, input: 'impulse', count: 5 } }); expect(zero.rows!.map(row => row.y)).toEqual([0, 0, 1, 0, 0]); const direct = compute({ ...source, expression: '(z+1)/(z-.5)', experiment: { ...source.experiment, input: 'impulse', count: 4 } }); expect(direct.rows!.map(row => row.y)).toEqual([1, 1.5, .75, .375]);
  });
  it('rejects invalid source drafts atomically while preserving valid-model inspection on response-bound failure', () => {
    const source = baseline(), first = compute(source); expect(() => compute({ ...source, experiment: { ...source.experiment, T: 0 } })).toThrow('Sample period'); expect(() => compute({ ...source, expression: '1/z^3' })).toThrow('integer powers'); expect(first.model.a).toEqual([1, -.8]); const unavailable = compute({ ...source, expression: '1/(z-1000)' }); expect(unavailable.roots[0].re).toBe(1000); expect(unavailable.rows).toBeUndefined(); expect(unavailable.responseIssue).toContain('10¹⁰'); expect(() => inspect(unavailable, 0)).toThrow('10¹⁰'); expect(() => inspect(first, .5)).toThrow('integer');
  });
  it('keeps comparison modes independent and changes both envelopes only through the explicit shared radius', () => {
    const source = labBaseline(), first = computeLab(source); expect(first.a.slice(0, 5)).toEqual([1, .8, .6400000000000001, .5120000000000001, .4096000000000001]); expect(first.b[3]).toBeCloseTo(-.512, 14); const moved = moveLab(source, 'a', { re: 0, im: .6 }); expect(moved.radius).toBe(.6); expect(moved.angleA).toBe(90); expect(moved.angleB).toBe(180); expect(moved.a[2]).toBeCloseTo(-.36, 14); expect(moved.b[2]).toBeCloseTo(.36, 14); expect(source.radius).toBe(.8); const zero = moveLab({ ...source, angleA: 45 }, 'a', { re: 0, im: 0 }); expect(zero.angleA).toBe(45); expect(zero.a.slice(0, 4).map(value => value === 0 ? 0 : value)).toEqual([1, 0, 0, 0]); expect(() => moveLab(source, 'b', { re: 2, im: 0 })).toThrow('shared radius');
  });
});
