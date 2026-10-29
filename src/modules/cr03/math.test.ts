import { describe, expect, it } from 'vitest';
import { at, BASELINE, canonical, controllability, coordinates, equivalence, identity, inverse, normalize, observability, physical, rank, samples, transferOf, validateModel, type StateModel } from './math';
function close(actual: number, expected: number, tolerance = 2e-8): void { expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance * Math.max(1, Math.abs(expected))); }
function arrayClose(actual: readonly number[], expected: readonly number[]): void { expect(actual.length).toBe(expected.length); actual.forEach((value, i) => close(value, expected[i])); }
function matrixClose(actual: readonly (readonly number[])[], expected: readonly (readonly number[])[]): void { expect(actual.length).toBe(expected.length); actual.forEach((row, i) => arrayClose(row, expected[i])); }

describe('CR03 independent realization fixtures', () => {
  it('recovers the baseline resolvent without changing its characteristic denominator', () => {
    expect(transferOf(BASELINE)).toEqual({ numerator: [1], denominator: [1, 3, 2] });
    expect(canonical({ numerator: [1], denominator: [1, 3, 2] })).toEqual(BASELINE);
    for (const t of [0, .1, 1, 3, 10, 20]) {
      const result = at(BASELINE, [0, 0], 1, t);
      arrayClose(result.state, [.5 - Math.exp(-t) + .5 * Math.exp(-2 * t), Math.exp(-t) - Math.exp(-2 * t)]);
      close(result.output, .5 - Math.exp(-t) + .5 * Math.exp(-2 * t));
    }
  });
  it('constructs the proposed numerator and physical-state transformation with determinant six', () => {
    const model = canonical({ numerator: [1, 4], denominator: [1, 3, 2] });
    expect(model).toEqual({ ...BASELINE, C: [4, 1] });
    const changed = physical(model, [1, -2]);
    expect(changed.T).toEqual([[4, 1], [-2, 1]]);
    matrixClose(changed.model.A, BASELINE.A); arrayClose(changed.model.B, [1, 1]); arrayClose(changed.model.C, [1, 0]); arrayClose(changed.initial, [2, -4]);
    expect(equivalence(transferOf(changed.model), { numerator: [1, 4], denominator: [1, 3, 2] }).matches).toBe(true);
    for (const t of [0, .1, 1, 3]) {
      const expected = 2 - 3 * Math.exp(-t) + 3 * Math.exp(-2 * t);
      close(at(model, [1, -2], 1, t).output, expected); close(at(changed.model, changed.initial, 1, t).output, expected);
    }
  });
  it('exposes biproper D and keeps the derivative remainder in C', () => {
    const model = canonical({ numerator: [2, 7, 9], denominator: [1, 3, 2] });
    expect(model).toEqual({ ...BASELINE, C: [5, 1], D: 2 });
    expect(transferOf(model)).toEqual({ numerator: [2, 7, 9], denominator: [1, 3, 2] });
    for (const t of [0, .1, 1, 5]) close(at(model, [0, 0], 1, t).output, 4.5 - 4 * Math.exp(-t) + 1.5 * Math.exp(-2 * t));
    expect(at(model, [0, 0], 1, 0).output).toBe(2);
  });
  it('maps arbitrary coordinates and initial data with independently multiplied matrices', () => {
    const changed = coordinates(BASELINE, [[2, -1], [1, 3]], [1, -1]);
    matrixClose(changed.model.A, [[1 / 7, 12 / 7], [-10 / 7, -22 / 7]]);
    arrayClose(changed.model.B, [-1, 3]); arrayClose(changed.model.C, [3 / 7, 1 / 7]); arrayClose(changed.initial, [3, -2]);
    expect(changed.model.D).toBe(0); expect(changed.residual).toBeLessThan(1e-12);
    expect(equivalence(transferOf(changed.model), transferOf(BASELINE)).matches).toBe(true);
  });
  it('handles a static gain without inventing a state', () => {
    const model = canonical({ numerator: [6], denominator: [2] });
    expect(model).toEqual({ A: [], B: [], C: [], D: 3 });
    expect(transferOf(model)).toEqual({ numerator: [3], denominator: [1] });
    expect(at(model, [], 2, 0)).toEqual({ t: 0, state: [], output: 6 });
    expect(coordinates(model, [], []).condition).toBe(1); expect(rank(observability(model))).toBe(0);
  });
  it('normalizes changed leading coefficients and all four canonical rows', () => {
    const model = canonical({ numerator: [2, 6], denominator: [2, 12, 22, 12] });
    expect(model).toEqual({ A: [[0, 1, 0], [0, 0, 1], [-6, -11, -6]], B: [0, 0, 1], C: [3, 1, 0], D: 0 });
    expect(transferOf(model)).toEqual({ numerator: [1, 3], denominator: [1, 6, 11, 6] });
    const fourth = canonical({ numerator: [1], denominator: [1, 10, 35, 50, 24] });
    expect(fourth.A[3]).toEqual([-24, -50, -35, -10]); expect(transferOf(fourth)).toEqual({ numerator: [1], denominator: [1, 10, 35, 50, 24] });
  });
  it('recovers a noncanonical fourth-order transfer from independently eliminated signal equations', () => {
    // Eliminating x2=s*x1, x3=(s²+s+1)*x1 and
    // x4=(s³+3s²+5s+2)*x1 gives P=s⁴+6s³+17s²+20s+9.
    const model: StateModel = { A: [[0, 1, 0, 0], [-1, -1, 1, 0], [0, -2, -2, 1], [0, 0, -3, -3]], B: [0, 0, 0, 2], C: [3, 0, 0, 0], D: .5 };
    expect(transferOf(model)).toEqual({ numerator: [.5, 3, 8.5, 10, 10.5], denominator: [1, 6, 17, 20, 9] });
  });
  it('keeps hidden modes distinct from equivalent zero-state transfer functions', () => {
    const hidden: StateModel = { A: [[1, 0], [0, -2]], B: [0, 1], C: [1, 1], D: 0 };
    expect(transferOf(hidden)).toEqual({ numerator: [1, -1], denominator: [1, 1, -2] });
    expect(equivalence(transferOf(hidden), { numerator: [1], denominator: [1, 2] }).matches).toBe(true);
    expect(rank(controllability(hidden))).toBe(1); expect(rank(observability(hidden))).toBe(2);
    close(at(hidden, [1, 0], 0, 2).output, Math.exp(2));
    const sameTransfer = canonical(transferOf(hidden));
    expect(rank(controllability(sameTransfer))).toBe(2); expect(rank(observability(sameTransfer))).toBe(1);
    expect(() => physical(sameTransfer, [0, 0])).toThrow(/singular/);
    expect(physical(hidden, [1, 0]).T).toEqual([[1, 1], [1, -2]]);
  });
  it('checks changed one- to four-state trajectories against elementary diagonal solutions', () => {
    for (let n = 1; n <= 4; n++) {
      const model: StateModel = { A: identity(n).map((row, i) => row.map(value => -value * (i + 1))), B: Array.from({ length: n }, (_, i) => i + 1), C: Array.from({ length: n }, (_, i) => (i + 1) / 2), D: .25 };
      const initial = Array.from({ length: n }, (_, i) => (i % 2 ? -1 : 1) * (i + 1) / 10);
      const T = identity(n).map((row, i) => row.map((value, j) => value + (i > j ? (i + j + 1) / 4 : 0)));
      const changed = coordinates(model, T, initial);
      for (const command of [-1, 0, 2]) for (const t of [0, .01, .2, 1, 5, 20]) {
        const expected = initial.map((value, i) => value * Math.exp(-(i + 1) * t) + command * (1 - Math.exp(-(i + 1) * t)));
        const transformed = T.map(row => row.reduce((sum, value, i) => sum + value * expected[i], 0));
        const output = expected.reduce((sum, value, i) => sum + model.C[i] * value, model.D * command);
        arrayClose(at(model, initial, command, t).state, expected);
        arrayClose(at(changed.model, changed.initial, command, t).state, transformed);
        close(at(changed.model, changed.initial, command, t).output, output);
      }
      expect(equivalence(transferOf(model), transferOf(changed.model)).matches).toBe(true);
    }
  });
  it('supports singular A without using an inverse of the dynamics', () => {
    const freeMass: StateModel = { A: [[0, 1], [0, 0]], B: [0, 1], C: [1, 0], D: 0 };
    for (const t of [0, .1, 1, 5, 20]) arrayClose(at(freeMass, [1, 3], 2, t).state, [1 + 3 * t + t * t, 3 + 2 * t]);
    expect(samples(freeMass, [0, 0], 1, 2, 5).map(point => point.t)).toEqual([0, .5, 1, 1.5, 2]);
  });
  it('checks large scaling, fast oscillation, repeated modes and forcing against analytic solutions', () => {
    const cases = [
      { model: { A: [[0, 1e6], [-1e-6, 0]], B: [0, 0], C: [1, 0], D: 0 }, initial: [1, 0], command: 0, expected: (t: number) => Math.cos(t) },
      { model: { A: [[0, 1e6], [-1e6, 0]], B: [0, 0], C: [1, 0], D: 0 }, initial: [1, 0], command: 0, expected: (t: number) => Math.cos(1e6 * t) },
      { model: { A: [[-1, 1e6], [0, -1]], B: [0, 0], C: [1, 0], D: 0 }, initial: [0, 1], command: 0, expected: (t: number) => 1e6 * t * Math.exp(-t) },
      { model: { A: [[-1]], B: [1e6], C: [1], D: 0 }, initial: [0], command: 100, expected: (t: number) => 1e8 * (1 - Math.exp(-t)) },
    ];
    for (const item of cases) for (const t of [.01, .1, 1, 5, 20]) close(at(item.model, item.initial, item.command, t).output, item.expected(t));
    const tiny = at({ A: [[-1]], B: [1], C: [1e-200], D: 0 }, [0], 1, 1).output, expected = 1e-200 * (1 - Math.exp(-1));
    expect(Math.abs((tiny - expected) / expected)).toBeLessThan(2e-8);
  });
});

describe('CR03 trajectory conditioning screening', () => {
  const separated:StateModel={A:[[0,1],[-1,8.125]],B:[0,1],C:[1,0],D:0};
  it('rejects the exact-decimal unexcited fast-mode reproduction instead of displaying its contaminated state',()=>{
    expect(()=>at(separated,[1.1,.1375],0,5)).toThrow(/condition/);
    expect(()=>samples(separated,[1.1,.1375],0,5)).toThrow(/condition/);
  });
  it('retains the accurately resolved short slow mode and a genuine small fast-mode perturbation',()=>{
    const slow=at(separated,[1.1,.1375],0,1);close(slow.state[0],1.1*Math.exp(1/8));close(slow.state[1],.1375*Math.exp(1/8));
    const t=1.5,epsilon=1e-7,fast=epsilon/(8-.125),small=at(separated,[1.1,.1375001],0,t);
    close(small.state[0],(1.1-fast)*Math.exp(t/8)+fast*Math.exp(8*t));
    close(small.state[1],.125*(1.1-fast)*Math.exp(t/8)+8*fast*Math.exp(8*t));
    expect(Math.abs(small.output-1.1*Math.exp(t/8))).toBeGreaterThan(.001);
  });
  it('reports a nonzero but unresolved fast component without trimming it to the slow mode',()=>{
    expect(()=>at(separated,[1.1,.137500000001],0,5)).toThrow(/condition/);
  });
  it('preserves a true growing eigenmode within the existing trajectory bound',()=>{
    const result=at(separated,[.125,1],0,2),growth=Math.exp(16);close(result.state[0],.125*growth);close(result.state[1],growth);close(result.output,.125*growth);
  });
  it('does not reject a resolved slow component just because an unexcited separate block grows quickly',()=>{
    const model:StateModel={A:[[.125,0],[0,8]],B:[0,0],C:[1,0],D:0},result=at(model,[1.1,0],0,5);
    close(result.output,1.1*Math.exp(5/8));expect(result.state[1]).toBe(0);
  });
  it('propagates component accuracy through a cancellation-prone output and keeps the true zero trajectory',()=>{
    expect(()=>at({...separated,C:[8,-1]},[.125,1],0,1.5)).toThrow(/condition/);
    expect(at(separated,[0,0],0,5)).toEqual({t:5,state:[0,0],output:0});
  });
  it('preserves normal fourth-order and oscillatory horizons',()=>{
    const fourth=canonical({numerator:[1],denominator:[1,4,6,4,1]});
    for(const t of [1,5,20])close(at(fourth,[0,0,0,0],1,t).output,1-Math.exp(-t)*(1+t+t*t/2+t*t*t/6));
    const t=20,rotation:StateModel={A:[[0,-2],[2,0]],B:[0,0],C:[1,0],D:0},result=at(rotation,[1,.5],0,t);
    close(result.state[0],Math.cos(2*t)-.5*Math.sin(2*t));close(result.state[1],Math.sin(2*t)+.5*Math.cos(2*t));
  });
});

describe('CR03 bounded failures and numerical qualification', () => {
  it('rejects improper or zero denominators and nonfinite data', () => {
    expect(() => normalize({ numerator: [1, 0, 0], denominator: [1, 1] })).toThrow(/improper/);
    expect(() => normalize({ numerator: [1], denominator: [0] })).toThrow(/zero polynomial/);
    expect(() => normalize({ numerator: [Infinity], denominator: [1] })).toThrow(/finite/);
    expect(() => canonical({ numerator: [1], denominator: [1, 1, 1, 1, 1, 1] })).toThrow(/four/);
    expect(() => validateModel({ ...BASELINE, C: [1] })).toThrow(/square/);
  });
  it('rejects singular, mismatched and ill-conditioned coordinate matrices', () => {
    expect(() => inverse([[1, 2], [2, 4]])).toThrow(/singular/);
    expect(() => inverse([[1, 0], [0, 1e-10]])).toThrow(/condition/);
    expect(() => coordinates(BASELINE, [[1]], [0, 0])).toThrow(/dimensions/);
    matrixClose(inverse([[0, 2], [3, 0]]).matrix, [[0, 1 / 3], [1 / 2, 0]]);
    expect(inverse([[1, 0], [0, 1e-8]]).condition).toBe(1e8);
    expect(() => inverse([[1e-320]])).toThrow(/floating-point range/);
  });
  it('does not mistake small data for a zero rank, and detects changed transfer data', () => {
    expect(rank([[1e-15, 0], [0, 2e-15]])).toBe(2);
    expect(() => rank([[1e-320]])).toThrow(/Rescale/);
    expect(equivalence({ numerator: [1], denominator: [1, 3, 2] }, { numerator: [2], denominator: [1, 3, 2] }).matches).toBe(false);
    expect(equivalence({ numerator: [1], denominator: [1, 3, 2] }, { numerator: [2], denominator: [2, 6, 4] }).matches).toBe(true);
    expect(equivalence({ numerator: [1e-200], denominator: [1, 1] }, { numerator: [0], denominator: [1] }).matches).toBe(false);
    expect(equivalence({ numerator: [1e-200], denominator: [1, 1] }, { numerator: [2e-200], denominator: [2, 2] }).matches).toBe(true);
  });
  it('does not silently erase an unrepresentable nonzero transfer or coordinate gain', () => {
    const tiny: StateModel = { A: [[-1]], B: [1e-200], C: [1e-200], D: 0 };
    expect(() => transferOf(tiny)).toThrow(/underflows/);
    expect(() => at(tiny, [0], 1, 1)).toThrow(/underflows/);
    expect(() => coordinates({ ...tiny, B: [1], C: [1e-320] }, [[1e6]], [0])).toThrow(/underflows/);
    expect(() => at({ A: [], B: [], C: [], D: 1e-200 }, [], 1e-200, 0)).toThrow(/underflows/);
    expect(() => at({ ...tiny, C: [1] }, [0], 1e-200, 1)).toThrow(/underflows/);
    expect(controllability({ ...tiny, A: [[-1e-100]], B: [1e-250] })).toEqual([[1e-250]]);
  });
  it('supports coordinate-scaled initial states while bounding trajectory work', () => {
    const changed = coordinates(BASELINE, [[1000, 0], [0, 1000]], [1, 0]);
    close(at(changed.model, changed.initial, 0, 1).output, 2 * Math.exp(-1) - Math.exp(-2));
    expect(() => at(BASELINE, [0, 0], 1, 21)).toThrow(/time/);
    expect(() => samples(BASELINE, [0, 0], 1, 0)).toThrow(/horizon/);
    expect(() => samples(BASELINE, [0, 0], 1, 1, 402)).toThrow(/samples/);
    expect(() => at({ A: [[100]], B: [1], C: [1], D: 0 }, [1], 1, 20)).toThrow(/range|Trajectory/);
  });
});
