import { expect, it } from 'vitest';
import { checkModel } from './check';
import { design, polynomialResidual, remainingDecay, stepValue } from './math';
/** Independent oracle: align exact IEEE-754 significands as integers, then
 * round their exact sum once. Power-of-two scaling is exact in this domain. */
function exactSum(values: number[]) {
  const view = new DataView(new ArrayBuffer(8));
  const terms = values.map(value => { view.setFloat64(0, value); const bits = view.getBigUint64(0), exponent = Number((bits >> 52n) & 2047n), sign = bits >> 63n ? -1n : 1n; return { integer: sign * ((bits & ((1n << 52n) - 1n)) | (exponent ? 1n << 52n : 0n)), exponent: exponent ? exponent - 1023 - 52 : -1074 }; });
  const exponent = Math.min(...terms.map(t => t.exponent)), integer = terms.reduce((sum, t) => sum + (t.integer << BigInt(t.exponent - exponent)), 0n); return Number(integer) * 2 ** exponent;
}
function previous(value: number) { const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value); view.setBigUint64(0, view.getBigUint64(0) - 1n); return view.getFloat64(0); }
const limits = { overshoot: 10, deadline: 4, ramp: .4, horizon: 12, maxGain: 60 };
it('admits the represented p=2.02 input above the unchanged r=.02 boundary, and rejects its predecessor below it', () => {
  const expected = exactSum([2, 2.02, -4]); expect(expected).toBeGreaterThan(.02); expect(expected).toBe(.020000000000000018);
  const d = design({ g: 1, a: 2, pole: 2.02, sigma: 2, omega: 2 }); expect(d.remaining).toBe(expected); expect(d.gain).toBeCloseTo(4.04, 12); expect(d.zero).toBeCloseTo(4 / 101, 13); expect(d.rampError).toBeCloseTo(25.25, 10);
  expect(exactSum([2, previous(2.02), -4])).toBeLessThan(.02); expect(() => design({ g: 1, a: 2, pole: previous(2.02), sigma: 2, omega: 2 })).toThrow('remaining closed-loop pole');
});
it.each([[2, 6, 2], [2, 2.02, 2], [2.02, 2, 2], [.2, 4, 2.09], [4, .2, 2.09], [.1, 20, 10], [20, .2, 10], [10, .2, .1]])('retains normal and either-order cancellation bits for a=%s,p=%s,σ=%s', (a, p, sigma) => {
  expect(remainingDecay(a, p, sigma)).toBe(exactSum([a, p, -2 * sigma]));
});
it('matches exact aligned-integer sums across bounded scale and cancellation controls', () => {
  for (const a of [.1, .2, 1, 2, 2.02, 3.999, 20]) for (const p of [.2, 2.02, 4, 6, 50]) for (const sigma of [.1, 1, 2, 2.09, 9.999, 10]) expect(remainingDecay(a, p, sigma)).toBe(exactSum([a, p, -2 * sigma]));
});
it('keeps the corrected boundary design consistent with its unreduced polynomial, all roots and full response', () => {
  const d = design({ g: 1, a: 2, pole: 2.02, sigma: 2, omega: 2 }), c = checkModel(d, limits), r = .020000000000000018, q = 8;
  [1, 4 + r, q + 4 * r, q * r].forEach((value, i) => expect(d.coefficients[i]).toBeCloseTo(value, 12)); expect(c.roots).toHaveLength(3); for (const root of [{ re: -r, im: 0 }, { re: -2, im: 2 }, { re: -2, im: -2 }]) expect(polynomialResidual(d.coefficients, root)).toBeLessThan(1e-14);
  expect(c.roots.some(root => Math.abs(root.re + r) < 1e-12 && Math.abs(root.im) < 1e-12)).toBe(true); expect(c.trace!.entry).toBeNull(); expect(c.entryCheck).toBe('Unresolved');
  const gain = 4.04, zero = q * r / gain, A = gain * (zero - r) / (-r * ((2 - r) ** 2 + 4)), B = -1 - A, D = (r * A + 2 * B) / 2;
  for (const t of [0, .1, 1, 5, 12]) expect(stepValue(d, t)).toBeCloseTo(1 + A * Math.exp(-r * t) + Math.exp(-2 * t) * (B * Math.cos(2 * t) + D * Math.sin(2 * t)), 12);
  const swapped = design({ g: 1, a: 2.02, pole: 2, sigma: 2, omega: 2 }); expect(swapped.remaining).toBe(d.remaining); for (const t of [.1, 1, 12]) expect(stepValue(swapped, t)).toBeCloseTo(stepValue(d, t), 13);
});
