import { describe, expect, it, vi } from 'vitest';
import { classify, locate, realDimension, samples } from './math';
import { appendRow, baseline, check, moveRow, nativePole, poleEntry, removeRow, replaceRow, sampleAt, snap, type Source } from './rows';
vi.mock('./math', async original => { const actual = await original<typeof import('./math')>(); return { ...actual, samples: vi.fn(actual.samples) }; });
describe('DS01 immutable row editing and amplitude cache', () => {
  it('preserves negative-pole alternation while a T edit changes only physical timestamps', () => {
    const first = check(baseline()), calls = vi.mocked(samples).mock.calls.length, changed = check({ ...first, period: .2 }, first);
    expect(changed.cache.get(2)).toBe(first.cache.get(2)); expect(vi.mocked(samples).mock.calls).toHaveLength(calls); expect([0, 1, 2, 3, 4].map(k => Number(sampleAt(changed, 2, k).first.toFixed(4)))).toEqual([1, -.8, .64, -.512, .4096]); expect(sampleAt(first, 2, 4).t).toBe(.4); expect(sampleAt(changed, 2, 4).t).toBe(.8);
  });
  it('keeps a hidden growing row internally while reusing its unchanged free amplitudes', () => {
    const source = moveRow(baseline(), 2, { re: 1.2, im: 0 }), before = check(source), hidden = check(replaceRow(before, 2, { ...before.rows[1].mode, visible: false }), before);
    expect(hidden.verdict).toEqual({ internal: 'grows', bibo: 'stable' }); expect(hidden.cache.get(2)).toBe(before.cache.get(2)); expect(sampleAt(hidden, 2, 4).first).toBeCloseTo(1.2 ** 4, 14);
  });
  it('changes repetition explicitly and preserves the original Jordan/binomial samples', () => {
    const row = { pole: { re: -1, im: 0 }, visible: true, structure: 'jordan3' as const }, source = check({ rows: [{ id: 8, mode: row }], period: .1, horizon: 4 });
    expect([0, 1, 2, 3, 4].map(k => sampleAt(source, 8, k).first)).toEqual([0, 0, 1, -3, 6]); expect(sampleAt(source, 8, 4).norm).toBeCloseTo(Math.sqrt(53), 13); expect(source.verdict.internal).toBe('grows'); expect(classify([{ ...row, structure: 'independent' }]).internal).toBe('bounded');
  });
  it('rejects duplicate/conjugate collisions and retains untouched row values without grid rounding', () => {
    const source = baseline(), precise = { ...source, rows: [source.rows[0], { id: 2, mode: { ...source.rows[1].mode, pole: { re: 1 / 3, im: 0 } } }] }, next = moveRow(precise, 1, { re: snap(.604), im: snap(.796) });
    expect(next.rows[1]).toBe(precise.rows[1]); expect(next.rows[1].mode.pole.re).toBe(1 / 3); expect(locate(next.rows[0].mode.pole)).toBe('boundary'); expect(() => check(moveRow(source, 1, source.rows[1].mode.pole))).toThrow('distinct');
    const pair = { ...source, rows: [{ id: 1, mode: { ...source.rows[0].mode, pole: { re: .6, im: .8 } } }, { id: 2, mode: { ...source.rows[1].mode, pole: { re: .6, im: -.8 } } }] }; expect(() => check(pair)).toThrow('distinct');
  });
  it('preserves the complete 24-state domain and bounded add/remove operations', () => {
    const source: Source = { rows: [0, 1, 2, 3].map(i => ({ id: i + 1, mode: { pole: { re: i / 10, im: .2 + i / 10 }, structure: 'jordan3', visible: true } })), period: 10, horizon: 80 };
    const full = check(source); expect(realDimension(full.rows.map(row => row.mode))).toBe(24); expect(() => appendRow(full, 5)).toThrow('four'); const one = { ...source, rows: source.rows.slice(0, 1) }; expect(() => removeRow(one, 1)).toThrow('at least one'); expect(appendRow(one, 5).rows[1].mode.pole).toEqual({ re: 0, im: 0 });
  });
  it('retains the unchanged near-circle certification and original visual grammar', () => {
    const pole = nativePole(1, 1e-10); expect(locate(pole)).toBe('near-boundary'); expect(poleEntry(pole)).toBe('1+0.0000000001j'); expect(nativePole(1 / 3, -.8)).toEqual({ re: 1 / 3, im: -.8 }); expect(() => nativePole(2, 1)).toThrow('radius'); expect(() => sampleAt(check(baseline()), 2, .5)).toThrow('integer');
  });
});
