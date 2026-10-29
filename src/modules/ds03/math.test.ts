import { describe, expect, it } from 'vitest';
import { analyze, BASELINE, mapToW, parseFamily, roots, stableInterval, transform, VARIANT } from './math';

describe('DS03 bounded polynomial grammar', () => {
  it('reads visual notation, factors and numeric fractions', () => {
    expect(parseFamily(BASELINE)).toEqual({ b: { slope: 1, constant: -1 }, c: { slope: .2, constant: 0 } });
    expect(parseFamily(String.raw`P\left(z\right)=z^{2}+\left(K-1\right)z+\frac{1}{5}K`)).toEqual(parseFamily(BASELINE));
    expect(parseFamily('(z+0.2)(z+0.3)+Kz')).toEqual({ b: { slope: 1, constant: .5 }, c: { slope: 0, constant: .06 } });
  });
  it.each(['', 'z^3+K', 'z^2+K^2', 'z^2+1/z', '2z^2+K', 'z^2+sin(K)', 'z^2+1/0', 'z^2+NaN', 'z^2+1000K', 'z^2+0.000000001K', 'z^2+(K', 'z^2+\\placeholder{}', 'z^2+' + '('.repeat(13) + '1' + ')'.repeat(13), 'z^2+' + '1'.repeat(301)])('rejects unsupported/incomplete input %s', text => expect(() => parseFamily(text)).toThrow());
});
describe('DS03 substitution and complete gain set', () => {
  it('derives the independent bridge fixture by expansion', () => {
    // (1+w)^2+(K-1)(1-w²)+.2K(1-2w+w²)
    const f = parseFamily(BASELINE);
    expect(transform(f)).toEqual([{ slope: -.8, constant: 2 }, { slope: -.4, constant: 2 }, { slope: 1.2, constant: 0 }]);
    expect(stableInterval(f)).toEqual({ lower: -0, upper: 2.5, empty: false });
    const r = analyze(f, 1);
    expect(r.abc[0]).toBeCloseTo(1.2, 14); expect(r.abc[1]).toBeCloseTo(1.6, 14); expect(r.abc[2]).toBeCloseTo(1.2, 14);
    expect(r.zRoots[0].im).toBeCloseTo(Math.sqrt(.2), 14);
    expect(r.classification).toBe('strictly stable');
  });
  it('recovers the .1K variation and open endpoints without sweeping', () => {
    const i = stableInterval(parseFamily(VARIANT));
    expect(i.lower).toBeCloseTo(0); expect(i.upper).toBeCloseTo(20 / 9, 13);
    for (const k of [-1, 0, 1, 20 / 9, 3]) {
      const r = analyze(parseFamily(VARIANT), k);
      expect(r.classification === 'strictly stable').toBe(k === 1);
    }
  });
  it('retains the excluded z=-1 pole when Q loses its quadratic term', () => {
    const r = analyze(parseFamily(BASELINE), 2.5);
    expect(r.abc).toEqual([0, 1, 3]);
    expect(r.zRoots).toEqual([{ re: -1, im: 0 }, { re: -.5, im: 0 }]);
    expect(r.wRoots).toEqual([null, { re: -3, im: 0 }]);
    expect(r.special).toBe('degree-loss'); expect(r.classification).toContain('boundary');
    const atZero = analyze(parseFamily(BASELINE), 0);
    expect(atZero.special).toBe('zero-constant'); expect(atZero.zRoots.map(z => z.re).sort()).toEqual([0, 1]);
  });
  it('handles all-real, empty and reversed gain intervals', () => {
    expect(stableInterval(parseFamily('z^2+.2'))).toEqual({ lower: -Infinity, upper: Infinity, empty: false });
    expect(stableInterval(parseFamily('z^2+2')) .empty).toBe(true);
    expect(stableInterval(parseFamily('z^2+Kz+2')) .empty).toBe(true);
    // K<-1 and K>-1 cannot both hold, even though each inequality has solutions.
    expect(stableInterval(parseFamily('z^2+(3K+3)z+K')).empty).toBe(true);
    expect(stableInterval(parseFamily('z^2-Kz'))).toEqual({ lower: -1, upper: 1, empty: false });
  });
  it('diagnoses a zero Routh row and simultaneous degree loss in original roots', () => {
    const f = parseFamily('z^2+Kz+1');
    expect(analyze(f, 0).special).toBe('zero-row');
    expect(analyze(f, 0).zRoots).toEqual([{ re: -0, im: 1 }, { re: -0, im: -1 }]);
    expect(stableInterval(f).empty).toBe(true);
    expect(analyze(parseFamily('(z+1)^2'), 0).wRoots).toEqual([null, null]);
    expect(analyze(parseFamily('(z-1)^2'), 0).zRoots.map(z => z.re)).toEqual([1, 1]);
    expect(analyze(parseFamily('(z-1)^2'), 0).special).toBe('zero-row');
    expect(analyze(parseFamily('z^2-2'), 0).classification).toBe('unstable');
    // Both ±sqrt(2) are outside the disk, so both transformed roots are in RHP.
    expect(analyze(parseFamily('z^2-2'), 0).signChanges).toBe(2);
  });
  it('satisfies substitution and original polynomial residuals on changed data', () => {
    for (const text of [BASELINE, VARIANT, 'z^2+(.3K-.7)z+.4K-.1', 'z^2-5z+6', '(z-.3)^2']) {
      const f = parseFamily(text);
      for (const k of [-2, .5, 3]) {
        const r = analyze(f, k);
        for (const z of r.zRoots) {
          expect(z.re ** 2 - z.im ** 2 + r.b * z.re + r.c).toBeCloseTo(0, 10);
          expect(2 * z.re * z.im + r.b * z.im).toBeCloseTo(0, 10);
        }
        const w = .25, z = (1 + w) / (1 - w);
        expect((1 - w) ** 2 * (z * z + r.b * z + r.c)).toBeCloseTo(r.abc[0] * w * w + r.abc[1] * w + r.abc[2], 12);
      }
    }
  });
  it('uses a stable quadratic formula with disparate roots', () => {
    const r = roots(10000, .01);
    expect(r[1].re).toBeCloseTo(-.0000010000000001, 15);
    expect(r[0].re * r[1].re).toBeCloseTo(.01, 14);
  });
  it.each([NaN, Infinity, -101, 101])('rejects invalid gain %s', k => expect(() => analyze(parseFamily(BASELINE), k)).toThrow());
});
describe('DS03 disk map', () => {
  it('preserves the real component near z=-1 without subtracting nearly equal squares', () => {
    // At z=-1+jb, direct division (-2+jb)/(jb) gives 1+2j/b.
    for (const b of [1e-8, -1e-8, 1e-6]) {
      const w = mapToW({ re: -1, im: b })!;
      expect(w.re).toBe(1); expect(w.im).toBe(2 / b);
    }
    // Exactly represented dyadic offsets make both expected components explicit.
    const epsilon = 2 ** -26;
    expect(mapToW({ re: -1 + epsilon, im: epsilon })).toEqual({ re: 1 - 2 ** 26, im: 2 ** 26 });
    expect(mapToW({ re: -1 - epsilon, im: epsilon })).toEqual({ re: 1 + 2 ** 26, im: 2 ** 26 });
    // The opposite boundary point must also retain a small positive real part.
    const nearOne = mapToW({ re: 1, im: 1e-8 })!;
    expect(nearOne.re / 2.5e-17).toBeCloseTo(1, 14);
    expect(nearOne.im / 5e-9).toBeCloseTo(1, 14);
  });
  it('maps inside/outside and unit boundary using an independent real-part identity', () => {
    for (const z of [{ re: .2, im: .4 }, { re: 2, im: -1 }, { re: 0, im: 1 }]) {
      const w = mapToW(z)!;
      expect(w.re).toBeCloseTo((Math.hypot(z.re, z.im) ** 2 - 1) / ((z.re + 1) ** 2 + z.im ** 2), 14);
    }
    expect(mapToW({ re: 0, im: 0 })).toEqual({ re: -1, im: 0 });
    expect(mapToW({ re: 1, im: 0 })).toEqual({ re: 0, im: 0 });
    expect(mapToW({ re: -1, im: 0 })).toBeNull();
    expect(mapToW({ re: 0, im: 1 })).toEqual({ re: 0, im: 1 });
    const near = mapToW({ re: -1 + 1e-6, im: 0 })!;
    expect(near.re).toBeCloseTo(-1999999, 2);
  });
});
