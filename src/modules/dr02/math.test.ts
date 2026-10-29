import { describe, expect, it } from 'vitest';
import { BASELINE, commit, forms, parseTransfer, preview, sample, type Memory, type Model } from './math';

function sequence(model: Model, count: number, y?: number[], u?: number[], kind: 'held' | 'impulse' | 'ramp' = 'held') {
  let memory: Memory = { k: 0, y: y ?? Array(model.a.length - 1).fill(0), u: u ?? Array(model.b.length - 1).fill(0) };
  return Array.from({ length: count }, () => {
    const input = sample(kind, 1, memory.k, .1), output = preview(model, memory, input).output;
    memory = commit(model, memory, input);
    return output;
  });
}
describe('DR02 independently checked recurrence', () => {
  it('baseline matches the geometric closed form and rounded course values', () => {
    const m = parseTransfer(BASELINE);
    expect(m).toEqual({ a: [1, -.90483742], b: [0, .09516258] });
    const y = sequence(m, 11);
    // b = 1-a exactly for the entered rounded coefficients; hence y[k]=1-a^k.
    y.forEach((value, k) => expect(value).toBeCloseTo(1 - .90483742 ** k, 13));
    expect(y[1]).toBeCloseTo(.09516258, 8);
    expect(y[2]).toBeCloseTo(.181269, 6);
    expect(y[3]).toBeCloseTo(.259182, 6);
  });
  it('changed history adds a homogeneous response without changing TF', () => {
    const m = parseTransfer(BASELINE), before = JSON.stringify(m);
    const changed = sequence(m, 8, [2], [3]);
    const zero = sequence(m, 8);
    // At k=0 the stored y[-1]=2 and u[-1]=3 contribute 2a+3b.
    changed.forEach((v, k) => expect(v - zero[k]).toBeCloseTo((2 * .90483742 + 3 * .09516258) * .90483742 ** k, 12));
    expect(JSON.stringify(m)).toBe(before);
  });
  it('second-order changed model has hand-calculated samples and simultaneous shifts', () => {
    const m = parseTransfer('G(z)=(0.5z+0.25)/(z^2-0.5z+0.125)');
    expect(sequence(m, 5)).toEqual([0, .5, 1, 1.1875, 1.21875]);
    const old = { k: 0, y: [2, 3], u: [4, 5] };
    expect(preview(m, old, 1).output).toBe(3.875); // .5*4+.25*5+.5*2-.125*3
    expect(commit(m, old, 1)).toEqual({ k: 1, y: [3.875, 2], u: [1, 4] });
    expect(old).toEqual({ k: 0, y: [2, 3], u: [4, 5] });
  });
  it('S14 audit fixture retains old input values (independent manual arithmetic)', () => {
    const m = parseTransfer('\\frac{14.1z^2-23.9z+10}{z^2-z}');
    // e0=0 then e1=e2=1, prior histories zero. Here scalar input e and output u.
    let memory: Memory = { k: 0, y: [0], u: [0, 0] };
    const outputs = [0, 1, 1].map(input => { const y = preview(m, memory, input).output; memory = commit(m, memory, input); return y; });
    expect(outputs[0]).toBe(0); expect(outputs[1]).toBeCloseTo(14.1, 12); expect(outputs[2]).toBeCloseTo(4.3, 12);
  });
  it('FIR sum stays unnormalized, with explicit input delay slots', () => {
    const m = parseTransfer('1+z^{-1}+z^{-2}');
    expect(sequence(m, 5)).toEqual([1, 2, 3, 3, 3]);
    expect(sequence(m, 5, [], [0, 0], 'impulse')).toEqual([1, 1, 1, 0, 0]);
  });
  it('pure gain, zero numerator, negative gain and pure delay work', () => {
    expect(sequence(parseTransfer('-2'), 3)).toEqual([-2, -2, -2]);
    expect(sequence(parseTransfer('0/(z-0.5)'), 3, [2])).toEqual([1, .5, .25]);
    expect(sequence(parseTransfer('z^{-3}'), 5)).toEqual([0, 0, 0, 1, 1]);
  });
  it('z, inverse powers, common powers, factors and normalized models agree', () => {
    const m = parseTransfer('(2z+1)/(2z^2-z)');
    for (const text of ['(z^-1+0.5z^-2)/(1-0.5z^-1)', '\\frac{2z+1}{z(2z-1)}', '\\left(2z+1\\right)/(2z^{2}-z)']) expect(parseTransfer(text)).toEqual(m);
    const f = forms(m);
    expect(parseTransfer(f.z)).toEqual(m);
    expect(parseTransfer(f.delay)).toEqual(m);
    expect(f.recurrence).toContain('0.5y[k-1]');
  });
  it('physical ramp uses kT and period is not a solver step', () => {
    expect(sample('ramp', 2, 3, .2)).toBeCloseTo(1.2, 12);
    expect(sample('impulse', 2, 3, .2)).toBe(0);
    expect(sample('held', -2, 3, .2)).toBe(-2);
  });
});
describe('DR02 useful failures and resource bounds', () => {
  it.each(['', 'NaN', 'Infinity', 's+1', 'sin(z)', '1/(0)', 'z^7', 'z^0.5', '(z+1)^-1', '1/(z^-6+z^6)', '1/(1e-14z+1)', '1/0.00000001', 'z+', '1//2', '\\frac{}{z}', '\\frac{1}{z', 'z'.repeat(1001)])('rejects malformed/unsupported model %s', text => {
    expect(() => parseTransfer(text)).toThrow();
  });
  it('explains future-input causality for improper forms in either notation', () => {
    expect(() => parseTransfer('(z^2+1)/(z+1)')).toThrow(/future input/);
    expect(() => parseTransfer('1/z^-1')).toThrow(/future input/);
  });
  it('rejects invalid timing/input/history, excessive work and overflow before update', () => {
    const m = parseTransfer('1/(z-1000000)');
    expect(() => sample('held', 1, 0, 0)).toThrow(/period/);
    expect(() => sample('held', Infinity, 0, 1)).toThrow(/amplitude/);
    expect(() => preview(m, { k: 128, y: [0], u: [0] }, 1)).toThrow(/128/);
    expect(() => preview(m, { k: 0, y: [], u: [0] }, 1)).toThrow(/slot/);
    expect(() => preview(m, { k: 0, y: [NaN], u: [0] }, 1)).toThrow(/nonfinite/);
    const old = { k: 0, y: [1e12], u: [0] };
    expect(() => commit(m, old, 1)).toThrow(/not updated/);
    expect(old.y[0]).toBe(1e12);
  });
});
