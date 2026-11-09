import { expect, it } from 'vitest';
import { displayedModel, prepare } from './calculation';
import { baseline, movePole, parseModel } from './math';
import { textRat } from './algebra';
it('retains the independent baseline step and weighted components through the preparation layer', () => {
  const p = prepare(baseline(), 8), i = 50, t = p.times[i], w = Math.sqrt(3), expected = 1 - Math.exp(-t) * (Math.cos(w * t) + Math.sin(w * t) / w); expect(p.output![i]).toBeCloseTo(expected, 13); expect(p.solution!.terms.map(term => term.coefficient)).toEqual([1, -1, -1 / w]); expect(p.times).toHaveLength(401); expect(p.error).toBe('');
});
it('keeps exact inspection when a genuinely uncanceled pair has unresolved numerical weights', () => {
  const p = prepare(parseModel('1', '-2', '1', '-\\frac{1000000000000000001}{1000000000000000000}'), 8); expect(p.analysis.common).toHaveLength(1); expect(p.analysis.internal).toBe('unstable'); expect(p.analysis.bibo).toBe(false); expect(p.output).toBeUndefined(); expect(p.error).toContain('uncanceled pole and zero');
});
it('reparses displayed generated coefficients without losing the unmoved exact hidden pole', () => {
  const source = parseModel('\\frac23', '-\\frac13', '1', '-\\frac13'), moved = displayedModel(movePole(source, 0, -2, 0)), p = prepare(moved, 8); expect(textRat(moved.a1)).toBe('5/3'); expect(textRat(moved.a0)).toBe('-2/3'); expect(p.analysis.common).toHaveLength(2); expect(p.analysis.internal).toBe('unstable'); expect(p.analysis.bibo).toBe(true); const index = 50; expect(p.output![index]).toBeCloseTo(.5 * (1 - Math.exp(-2 * p.times[index])), 13); expect(textRat(source.a1)).toBe('2/3');
});
it('withholds an unsupported growing trace and recovers at the original shorter horizon', () => {
  const model = parseModel('-12', '36', '0', '1'), p = prepare(model, 8); expect(p.analysis.poles[0].multiplicity).toBe(2); expect(p.output).toBeUndefined(); expect(p.error).toContain('exp(40)'); expect(prepare(model, 2).output).toBeDefined(); expect(() => prepare(model, 21)).toThrow('20 s');
});
