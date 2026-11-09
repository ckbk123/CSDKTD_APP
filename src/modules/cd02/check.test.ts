import { expect, it } from 'vitest';
import { checkModel } from './check';
import { design } from './math';
const inputs = { g: 1, a: 2, sigma: 2, omega: 2, pole: 6 }, limits = { overshoot: 10, deadline: 4, ramp: .4, horizon: 12, maxGain: 60 };
it('checks every baseline root and the independently inverted full step rather than just the target pair', () => {
  const c = checkModel(design(inputs), limits); expect(c.roots).toHaveLength(3); expect(c.residual).toBeLessThan(1e-12); expect(c.roots.some(r => Math.abs(r.re + 4) < 1e-12 && Math.abs(r.im) < 1e-12)).toBe(true); expect(c.d.coefficients).toEqual([1, 8, 24, 32]);
  const t = c.trace!; for (const i of [0, 83, 240, t.time.length - 1]) { const x = t.time[i], full = 1 + .5 * Math.exp(-4 * x) - Math.exp(-2 * x) * (1.5 * Math.cos(2 * x) + .5 * Math.sin(2 * x)); expect(t.full[i]).toBeCloseTo(full, 12); } expect(t.overshoot).toBeCloseTo(7.925, 2); expect(c.d.rampError).toBe(3 / 8);
});
it('preserves the full response when plant gain doubles and the derived controller gain halves', () => {
  const c = checkModel(design({ ...inputs, g: 2 }), limits); expect(c.d.gain).toBe(6); expect(c.d.zero).toBe(8 / 3); expect(c.d.coefficients).toEqual([1, 8, 24, 32]); for (const [i, x] of c.trace!.time.entries()) if (i % 317 === 0) expect(c.trace!.full[i]).toBeCloseTo(1 + .5 * Math.exp(-4 * x) - Math.exp(-2 * x) * (1.5 * Math.cos(2 * x) + .5 * Math.sin(2 * x)), 12);
});
it('retains the canceled stable mode and its failing ramp requirement', () => {
  const c = checkModel(design({ ...inputs, pole: 4 }), limits); expect(c.roots).toHaveLength(3); expect(c.d.zero).toBe(2); expect(c.d.remaining).toBe(2); expect(c.d.coefficients).toEqual([1, 6, 16, 16]); expect(c.d.rampError).toBe(.5); expect(c.d.rampError).toBeGreaterThan(c.requirements.ramp); c.trace!.full.forEach((value, i) => expect(value).toBeCloseTo(c.trace!.pair[i], 12));
});
it('retains geometry/root/locus evidence while withholding a response that exceeds the original work bound', () => {
  const c = checkModel(design({ ...inputs, pole: 50 }), { ...limits, horizon: 200 }); expect(c.roots).toHaveLength(3); expect(c.locus?.branches).toHaveLength(3); expect(c.trace).toBeUndefined(); expect(c.traceError).toContain('60,000'); expect(c.entryCheck).toBe('Unresolved');
});
it('keeps a slow remaining mode and the sampled deadline bracket unresolved', () => {
  const slow = checkModel(design({ ...inputs, pole: 2.04 }), limits); expect(slow.d.remaining).toBeCloseTo(.04, 13); expect(slow.trace!.entry).toBeNull(); expect(slow.entryCheck).toBe('Unresolved'); expect(slow.d.rampError).toBeCloseTo(12.75, 10);
  const bracket = checkModel(design(inputs), { ...limits, deadline: 2.067 }); expect(bracket.trace!.entryBracket![0]).toBeCloseTo(2.0625, 12); expect(bracket.trace!.entryBracket![1]).toBeCloseTo(2.06875, 12); expect(bracket.entryCheck).toBe('Unresolved');
});
