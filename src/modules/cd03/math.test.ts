import { describe, expect, it } from 'vitest';
import { abs, add, model, neg, parsePlant, roots, validate, type Design } from './model';
import { assess, measure, response } from './response';
const baseline: Design = { a: 2, b: 1, k: 4, lag: false, p: .01, z: .1 };
describe('CD03 plant, full roots and tracking', () => {
  it('derives the original proportional model, complete pair and ramp limit', () => {
    expect(parsePlant(String.raw`\frac1{s(s+2)}`)).toEqual({ a: 2, b: 1 });
    const m = model(baseline); expect(m.denominator).toEqual([1, 2, 4]); expect(m.kv).toBe(2); expect(m.rampError).toBe(.5);
    expect(m.baselineRoots[0].re).toBe(-1); expect(Math.abs(m.baselineRoots[0].im)).toBeCloseTo(Math.sqrt(3), 14);
  });
  it('keeps all three poles and derives Kv from the actual lag', () => {
    const d = { ...baseline, lag: true }, m = model(d);
    expect(m.denominator).toEqual([1, 2.01, 4.02, .4]); expect(m.fullRoots).toHaveLength(3);
    expect(m.beta).toBe(10); expect(m.kv).toBe(20); expect(m.rampError).toBe(.05);
    const s = { re: -1, im: Math.sqrt(3) };
    const expectedAngle = (Math.atan2(s.im, s.re + d.z) - Math.atan2(s.im, s.re + d.p)) * 180 / Math.PI;
    expect(m.angle).toBeCloseTo(expectedAngle, 12); expect(m.angle).toBeLessThan(0);
  });
  it('recovers independently factored changed cubic roots', () => {
    // (s+.1)(s²+1.91s+3.829) = s³+2.01s²+4.02s+.3829.
    const m = model({ ...baseline, lag: true, z: .095725 });
    expect(m.fullRoots.some(p => abs(add(p, { re: .1, im: 0 })) < 1e-12)).toBe(true);
    expect(m.fullRoots.filter(p => p.im).every(p => Math.abs(p.re + .955) < 1e-12)).toBe(true);
    expect(Math.abs(m.fullRoots.find(p => p.im > 0)!.im)).toBeCloseTo(Math.sqrt(2.916975), 12);
    expect(m.kv).toBeCloseTo(19.145, 12);
  });
  it('distinguishes a full-loop boundary and two-RHP-pole failure from a formal error constant', () => {
    // At z=(a+p)(ap+Kb)/(Kb), denominator=(s+2.01)(s²+4.02).
    const edge = model({ ...baseline, lag: true, z: 2.02005 });
    expect(edge.stability).toBe('boundary'); expect(edge.rampError).toBeUndefined();
    expect(edge.fullRoots.some(p => Math.abs(p.re + 2.01) < 1e-11)).toBe(true);
    const bad = model({ ...baseline, lag: true, z: 3 }); expect(bad.stability).toBe('unstable'); expect(bad.fullRoots.filter(p => p.re > 0)).toHaveLength(2); expect(bad.rampError).toBeUndefined();
  });
  it('validates the actual family and preserves visual token meanings', () => {
    for (const value of ['', String.raw`\frac1{s+2}`, String.raw`\frac{1}{s^\quad2+2s}`, String.raw`\frac{0^0}{s(s+2)}`, String.raw`\frac1{s(s+1e-2)}`, String.raw`\frac1{s(s+100)}`]) expect(() => parsePlant(value)).toThrow();
    expect(() => validate({ ...baseline, p: .1, z: .01, lag: true })).toThrow(/p<z/);
    expect(() => validate({ ...baseline, k: 1 })).toThrow(/oscillatory/);
    expect(() => validate({ ...baseline, a: NaN })).toThrow(/finite/);
    expect(() => roots([1, 0, 0, 0, 1])).toThrow(/quadratic/);
  });
  it('retains all real and repeated roots without using order-dependent labels', () => {
    expect(roots([1, 6, 11, 6]).map(p => p.re).sort((a, b) => a - b)).toEqual([-3, -2, -1]);
    expect(roots([1, 3, 3, 1]).every(p => Math.abs(p.re + 1) < 1e-12 && Math.abs(p.im) < 1e-12)).toBe(true);
  });
});
describe('full response and bounded measurements', () => {
  it('agrees with the baseline analytic step, derivative and independent crossing values', () => {
    const m = model(baseline), r = response(m.numerator, m.denominator, m.fullRoots);
    const value = (t: number) => 1 - Math.exp(-t) * (Math.cos(Math.sqrt(3) * t) + Math.sin(Math.sqrt(3) * t) / Math.sqrt(3));
    for (const t of [0, .25, 1, 2, 4, 10]) expect(r.value(t)).toBeCloseTo(value(t), 12);
    expect(r.slope(1)).toBeCloseTo(4 / Math.sqrt(3) * Math.exp(-1) * Math.sin(Math.sqrt(3)), 12);
    const a = measure(r, 10, .02); expect(a.overshoot * 100).toBeCloseTo(16.303353482158, 6); expect(a.peakTime).toBeCloseTo(Math.PI / Math.sqrt(3), 8); expect(a.settling).toBeCloseTo(4.038174486964, 7);
    expect(assess(a, 20, 4.5).all).toBe('met'); expect(assess(a, 20, 4).settling).toBe('failed');
  });
  it('does not turn an early in-band sample into established settling', () => {
    const m = model(baseline), r = response(m.numerator, m.denominator, m.fullRoots), a = measure(r, 1.21, .02);
    expect(Math.abs(r.value(1.21) - 1)).toBeLessThan(.02); expect(a.settling).toBeUndefined(); expect(a.tail).toBeGreaterThan(.02); expect(assess(a, 20, 4.5).all).toBe('unknown');
  });
  it('agrees with a separately derived changed-mode expansion at early and late times', () => {
    // Partial fractions of the known factorization, derived by initial value/slope:
    // y=1+(3/64)e^(-t/10)+e^(-191t/200)[-67/64 cos(wt)-12737/(12800w) sin(wt)].
    const d = { ...baseline, lag: true, z: .095725 }, m = model(d), r = response(m.numerator, m.denominator, m.fullRoots), w = Math.sqrt(2.916975);
    const expected = (t: number) => 1 + 3 / 64 * Math.exp(-t / 10) + Math.exp(-.955 * t) * (-67 / 64 * Math.cos(w * t) - 12737 / (12800 * w) * Math.sin(w * t));
    for (const t of [0, .2, 1, 4, 10, 100]) expect(r.value(t)).toBeCloseTo(expected(t), 11);
    expect(r.residues.some(c => Math.abs(c.re - 3 / 64) < 1e-12)).toBe(true);
    const a = measure(r, 20, .02); expect(a.settling).toBeCloseTo(8.492268129954148, 7); expect(assess(a, 30, 4.5).settling).toBe('failed');
    for (const t of [20, 50, 100, 200]) expect(Math.abs(r.value(t) - 1)).toBeLessThanOrEqual(r.tail(20));
  });
  it('matches an independent original-ODE RK4 reference and demonstrates a successful revision', () => {
    // Independent RK4 on e'''+(a+p)e''+(ap+Kb)e'+Kbz e=0,
    // [e,e',e''](0+)=[-1,0,Kb], dt=.0005; sampled peaks/linear last crossings.
    for (const [p, z, overshootPct, settling] of [[.01, .1, 22.249083642360358, 8.66005218590835], [.002, .02, 17.520776190413546, 2.9271663330535]]) {
      const m = model({ ...baseline, lag: true, p, z }), r = response(m.numerator, m.denominator, m.fullRoots), a = measure(r, 20, .02);
      expect(a.overshoot * 100).toBeCloseTo(overshootPct, 4); expect(a.settling).toBeCloseTo(settling, 4); expect(m.kv).toBe(20);
      expect(assess(a, 20, 4.5).all).toBe(p === .002 ? 'met' : 'failed');
    }
  });
  it('requires stable distinct modes and bounds response work', () => {
    expect(() => response([1], [1, 2, 1], [{ re: -1, im: 0 }, { re: -1, im: 0 }])).toThrow(/Repeated/);
    const m = model({ ...baseline, lag: true, z: 3 }); expect(() => response(m.numerator, m.denominator, m.fullRoots)).toThrow(/stable/);
    const good = model(baseline), r = response(good.numerator, good.denominator, good.fullRoots);
    expect(() => measure(r, 0, .02)).toThrow(/horizon/); expect(() => r.value(201)).toThrow(/200/);
    expect(() => response([4.1], good.denominator, good.fullRoots)).toThrow(/initial-condition/);
    expect(abs(add(good.fullRoots[0], neg(good.fullRoots[1])))).toBeGreaterThan(3);
  });
});
