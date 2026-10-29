import { describe, expect, it } from 'vitest';
import { modelFromText } from './model';
import { mapAt, sampledCurve, TAU, unit, winding } from './winding';
import { decimal, ZERO } from './rational';

describe('complete oriented mapping against independent geometry', () => {
  it('matches baseline cardinal coordinates, circle center/radius and clockwise local orientation', () => {
    const m = modelFromText(), start = mapAt(m, 0), opposite = mapAt(m, Math.PI), quarter = mapAt(m, Math.PI / 2);
    expect(start.loop!.re).toBeCloseTo(2.5, 13); expect(start.loop!.im).toBe(0);
    expect(opposite.loop!.re).toBeCloseTo(-5 / 18, 13);
    expect(quarter.loop!.re).toBeCloseTo(-10 / 41, 13); expect(quarter.loop!.im).toBeCloseTo(-25 / 82, 13);
    // |z|=1 and z=4/5+(1/2)/L imply center10/9, radius25/18.
    for (const p of sampledCurve(m)) expect(Math.hypot(p.loop!.re - 10 / 9, p.loop!.im)).toBeCloseTo(25 / 18, 12);
    expect(quarter.z.im).toBe(1); expect(quarter.loop!.im).toBeLessThan(0);
    expect(start.returnDifference!.re).toBeCloseTo(3.5, 13);
  });
  it('preserves conjugacy and exact endpoint closure', () => {
    const m = modelFromText('2z-1.5', '(z-1.2)(z-1.3)');
    for (const angle of [.1, 1, 2.4]) {
      const a = mapAt(m, angle).loop!, b = mapAt(m, TAU - angle).loop!;
      expect(a.re).toBeCloseTo(b.re, 12); expect(a.im).toBeCloseTo(-b.im, 12);
    }
    expect(mapAt(m, 0).loop).toEqual(mapAt(m, TAU).loop);
    expect(unit(Math.PI)).toEqual({ re: -1, im: 0 });
  });
  it('keeps sample-period changes out of the fixed discrete mapping', () => {
    expect(mapAt(modelFromText('.5', 'z-.8', decimal('1'), decimal('.1')), 1).loop)
      .toEqual(mapAt(modelFromText('.5', 'z-.8', decimal('1'), decimal('.2')), 1).loop);
  });
});
describe('guarded winding independent of algebraic root classification', () => {
  it.each([
    ['.5', 'z-.8', 0, 0], // image circle leaves -1 outside
    ['.5', 'z-1.2', 1, 0], // one CCW turn stabilizes the open outside pole
    ['2', 'z-.8', -1, 1], // one CW turn creates an outside closed-loop pole
    ['2z-1.5', '(z-1.2)(z-1.3)', 2, 0], // Q=(z-.2)(z-.3)
    ['-2z+1.5', '(z-.2)(z-.3)', -2, 2], // Q=(z-1.2)(z-1.3)
    ['1.25', 'z^2-.6z+.25', -2, 2], // conjugate roots radius .5 -> sqrt(1.5)
    ['.5(z-1.2)', '(z-1.2)(z-.2)', 0, 1], // hidden outside factor retained in D,Q
    ['z', 'z-.8', 0, 0], // biproper Q=2z-.8, not a singular direct loop
    ['2', '1', 0, 0], ['-2', '1', 0, 0],
  ] as const)('counts %s / %s without borrowing the answer from root locations', (n, d, expectedW, expectedOutside) => {
    const m = modelFromText(n, d), run = winding(m);
    expect(run.kind).toBe('checked'); expect(run.winding).toBe(expectedW);
    expect(m.openRoots.outside - run.winding!).toBe(expectedOutside);
    expect(m.closedRoots.outside).toBe(expectedOutside);
    expect(run.minimumD).toBeGreaterThan(0); expect(run.minimumQ).toBeGreaterThan(0); expect(run.maximumRatio).toBeLessThan(.125);
    expect(run.acceptedArcs).toBeGreaterThanOrEqual(128); expect(run.arcChecks).toBeLessThanOrEqual(32768);
    expect(run.turns).toBeCloseTo(expectedW, 12); expect(run.points[0].loop).toEqual(run.points.at(-1)!.loop);
  });
  it('keeps a zero loop at zero while retaining all original internal modes', () => {
    const m = modelFromText('1', '(z-1.2)(z-.2)', ZERO), run = winding(m);
    expect(run.kind).toBe('checked'); expect(run.winding).toBe(0); expect(m.closedRoots.outside).toBe(1);
    expect(run.points.every(p => p.loop?.re === 0 && p.loop?.im === 0)).toBe(true);
  });
  it('does not read the root-classification answer to manufacture its winding', () => {
    const m = modelFromText('2z-1.5', '(z-1.2)(z-1.3)');
    const wrongAnswer = { ...m, closedRoots: { ...m.closedRoots, inside: 0, outside: 2 } };
    expect(winding(wrongAnswer).winding).toBe(2);
  });
  it.each([
    ['.5', 'z-1'], ['.5', 'z+1'], ['.5', 'z^2+1'],
    ['1.8', 'z-.8'], ['-.2', 'z-.8'], ['.5', 'z^2+.5'],
    ['.5(z-1)', '(z-1)(z-.2)'],
  ])('separates contour/boundary roots for %s / %s', (n, d) => {
    const run = winding(modelFromText(n, d)); expect(run.kind).toBe('boundary'); expect(run.winding).toBeUndefined(); expect(run.arcChecks).toBe(0);
  });
  it('does not give a finite invented value at an open-loop pole or cancellation', () => {
    expect(mapAt(modelFromText('.5', 'z-1'), 0).loop).toBeUndefined();
    expect(mapAt(modelFromText('.5', 'z^2+1'), Math.PI / 2).loop).toBeUndefined();
    expect(mapAt(modelFromText('.5(z-1)', '(z-1)(z-.2)'), 0).loop).toBeUndefined();
    expect(winding(modelFromText('.5', 'z^2+1')).omittedPoints).toBeGreaterThan(0);
  });
  it('marks the actual critical point when Q has a contour zero', () => {
    const p = mapAt(modelFromText('1.8', 'z-.8'), Math.PI);
    expect(p.loop!.re).toBe(-1); expect(Math.hypot(p.returnDifference!.re, p.returnDifference!.im)).toBe(0);
  });
  it('reports an unresolved near-contour count and a reached work budget', () => {
    const close = modelFromText('.5', 'z-.999999999'), run = winding(close);
    expect(close.openRoots.boundary).toBe(0); expect(run.kind).toBe('unresolved'); expect(run.winding).toBeUndefined();
    expect(run.reason).toContain('No winding count'); expect(run.points).toHaveLength(1025);
    const work = winding(modelFromText('2z-1.5', '(z-1.2)(z-1.3)'), { arcChecks: 128, depth: 20 });
    expect(work.kind).toBe('unresolved'); expect(work.reason).toContain('budget'); expect(work.arcChecks).toBeLessThanOrEqual(128);
  });
  it('validates cursor angle and finite work bounds', () => {
    const m = modelFromText();
    for (const t of [NaN, Infinity, -.1, TAU + .1]) expect(() => mapAt(m, t)).toThrow();
    for (const intervals of [0, 127, 4097, 128.5, NaN]) expect(() => sampledCurve(m, intervals)).toThrow();
    for (const limits of [{ arcChecks: 127, depth: 20 }, { arcChecks: 40000, depth: 20 }, { arcChecks: 128, depth: 21 }, { arcChecks: NaN, depth: 20 }]) expect(() => winding(m, limits)).toThrow();
  });
});
