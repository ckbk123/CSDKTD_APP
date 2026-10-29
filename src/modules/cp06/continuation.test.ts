import { describe, expect, it } from 'vitest';
import { c, residual } from './complex';
import { matchRoots, trace } from './continuation';
import { baseline, characteristic, parseModel } from './model';
import { decimal } from './rational';

describe('minimum-distance assignment and bounded continuation', () => {
  it('tracks conjugate identities when input order reverses', () => {
    const result = matchRoots([c(-1, 2), c(-1, -2), c(-3)], [c(-4), c(0, -3), c(0, 3)]);
    expect(result.points).toEqual([c(0, 3), c(0, -3), c(-4)]); expect(result.ambiguous).toBe(false);
  });
  it('flags a real-to-conjugate collision with nonunique branch labels', () => {
    expect(matchRoots([c(-2), c(-1)], [c(-1.5, 1), c(-1.5, -1)]).ambiguous).toBe(true);
    expect(matchRoots([c(-1), c(-1)], [c(-1, 1), c(-1, -1)]).ambiguous).toBe(false);
  });
  it('computes all baseline moving branches and the full K=70 crossing', () => {
    const model = baseline(), result = trace(model, 140); expect(result.capped).toBe(false); expect(result.evaluations).toBeLessThanOrEqual(2049);
    const frame = result.frames.find(p => p.gain === 70)!; expect(frame.points).toHaveLength(3);
    expect(frame.points.some(p => Math.abs(p.re + 7) < 1e-9)).toBe(true); expect(frame.points.some(p => Math.abs(p.im - Math.sqrt(10)) < 1e-9)).toBe(true);
    expect(result.frames.at(-1)?.gain).toBe(140);
    for (const sample of result.frames) for (const point of sample.points) expect(residual(characteristic(model, decimal(String(sample.gain), true), true), point)).toBeLessThan(2e-9);
  });
  it('has a straight first-order branch with independently known endpoint', () => {
    const result = trace(parseModel('2', 's+3'), 10); expect(result.frames.at(-1)?.points).toEqual([c(-23)]); expect(result.gaps).toBe(0);
  });
  it('preserves fixed cancelled modes separately from the moving trace', () => {
    const model = parseModel('s-1', '(s-1)(s+2)'), result = trace(model, 10);
    expect(model.fixed[0].re).toBe(1); expect(result.frames.every(f => f.points.length === 1)).toBe(true); expect(result.frames.at(-1)?.points).toEqual([c(-12)]);
  });
  it('supports a repeated starting pole and diverging tangent directions', () => {
    const result = trace(parseModel('1', '(s+1)^3'), 8); const end = result.frames.at(-1)!;
    expect(end.points).toHaveLength(3); expect(end.points.some(p => Math.abs(p.re + 3) < 1e-10)).toBe(true); expect(end.points.some(p => Math.abs(p.re) < 1e-10 && Math.abs(p.im - Math.sqrt(3)) < 1e-10)).toBe(true);
  });
  it('reports finite budget omission without fabricating a complete locus', () => {
    const result = trace(baseline(), 140, 64, 17); expect(result.capped).toBe(true); expect(result.gaps).toBeGreaterThan(0); expect(result.evaluations).toBe(17);
    expect(result.frames.some(f => f.issue?.includes('budget'))).toBe(true);
  });
  it.each([[0, 64, 2049], [1001, 64, 2049], [140, 2, 2049], [140, 64, 10000]])('rejects unsupported trace bounds %s/%s/%s', (max, count, budget) => expect(() => trace(baseline(), max, count, budget)).toThrow());
});
