import { describe, expect, it } from 'vitest';
import { check, designLead, lagForTarget, nextStep, requiredRatio, residual, rootLocus, stepTrace, targetFromSpecs } from './math';
import { multiply, poles, routh } from './engine';
const plant = { g: 1, a: 2, c0: 4 }, target = { sigma: 2, omega: 2 };
const lead = () => designLead(plant, target, 6);
const compare = (a: number[], b: number[]) => { expect(a).toHaveLength(b.length); a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 10)); };

describe('allocation and complete algebra', () => {
  it('preserves baseline and derives all three exact lead poles, gain and zero', () => {
    const before = check(plant), d = lead(), c = check(plant, d);
    compare(before.model.closed, [1, 2, 4]); expect(before.rampError).toBe(.5);
    expect(d.gain).toBe(12); expect(d.zero).toBeCloseTo(8 / 3, 12); expect(d.remaining).toBe(4); expect(d.angleResidual).toBeCloseTo(0, 12); expect(d.magnitudeGain).toBeCloseTo(12, 11);
    compare(c.model.closed, [1, 8, 24, 32]); compare(c.model.closed, multiply([1, 4], [1, 4, 8]));
    expect(c.poles).toHaveLength(3); expect(c.poles.some(z => Math.abs(z.re + 4) < 1e-10 && Math.abs(z.im) < 1e-10)).toBe(true);
    expect(c.poles.some(z => Math.abs(z.re + 2) < 1e-10 && Math.abs(z.im - 2) < 1e-10)).toBe(true); expect(c.rampError).toBeCloseTo(3 / 8, 12);
  });
  it('allocates lag ratio from the verified lead error and retains the complete quartic', () => {
    const d = lead(), c = check(plant, d), lag = lagForTarget(c, .1, .1), full = check(plant, d, lag);
    expect(requiredRatio(c, .1)).toBeCloseTo(3.75, 12); expect(lag.p).toBeCloseTo(2 / 75, 12);
    compare(full.model.closed, [1, 8 + 2 / 75, 24 + 16 / 75, 33.52, 3.2]);
    expect(full.poles).toHaveLength(4); expect(full.poles.every(z => z.re < 0 && residual(full.model.closed, z) < 1e-10)).toBe(true);
    expect(full.kv).toBeCloseTo(10, 11); expect(full.rampError).toBeCloseTo(.1, 12);
    expect(full.poles.every(z => Math.hypot(z.re + 2, z.im - 2) > .001)).toBe(true);
  });
  it('changes lead pole and plant coefficients with independently factored expected cubics', () => {
    const d = designLead(plant, target, 8), c = check(plant, d);
    expect(d.gain).toBe(16); expect(d.zero).toBe(3); compare(c.model.closed, multiply([1, 6], [1, 4, 8])); expect(c.rampError).toBeCloseTo(1 / 3, 12);
    const p = { g: 2, a: 3, c0: 4 }, changed = designLead(p, target, 8), cc = check(p, changed);
    expect(changed.gain).toBe(6); expect(changed.zero).toBeCloseTo(14 / 3, 12); compare(cc.model.closed, [1, 11, 36, 56]); expect(cc.rampError).toBeCloseTo(3 / 7, 12);
    expect(check(p, changed, lagForTarget(cc, .05, .1)).rampError).toBeCloseTo(.05, 12);
  });
  it('can meet a loose error target with an identity lag while retaining its hidden pole', () => {
    const d = lead(), c = check(plant, d), l = lagForTarget(c, .5, .1), full = check(plant, d, l);
    expect(l.z).toBe(l.p); expect(requiredRatio(c, .5)).toBe(1); expect(full.poles).toHaveLength(4); expect(full.rampError).toBeCloseTo(c.rampError!, 12);
  });
  it('converts time specs into an explicitly approximate pair and rechecks the full model', () => {
    const t = targetFromSpecs(100 * Math.exp(-Math.PI), 2); expect(t.sigma).toBe(2); expect(t.omega).toBeCloseTo(2, 12);
    expect(designLead(plant, t, 6).gain).toBeCloseTo(12, 11); expect(() => targetFromSpecs(0, 2)).toThrow();
  });
});

describe('full-state responses and refinement', () => {
  it('plots a short transient window while retaining every full-horizon metric', () => {
    const c = check(plant, lead(), lagForTarget(check(plant, lead()), .1, .02)), full = stepTrace(c, 80), detail = stepTrace(c, 80, 12);
    expect(detail.points.at(-1)!.x).toBe(12); expect(detail.plotHorizon).toBe(12); expect(detail.points.length).toBeLessThanOrEqual(901);
    expect(detail.overshoot).toBe(full.overshoot); expect(detail.entry).toBe(full.entry); expect(detail.endingError).toBe(full.endingError); expect(detail.iae).toBe(full.iae);
    expect(stepTrace(c, .5, 12).plotHorizon).toBe(.5);
  });
  it.each([
    [.1, 11.055191466252513, 2.68, -.000007907022845810019, .7598608584297736],
    [.02, 8.568366667158656, 2.1545, -.001116920402883359, .7163368388535188],
  ])('matches the independent physical cascade for lag zero %s', (zero, overshoot, entry, ending, iae) => {
    const d = lead(), c = check(plant, d, lagForTarget(check(plant, d), .1, zero)), t = stepTrace(c, 80);
    expect(t.overshoot).toBeCloseTo(overshoot, 2); expect(Math.abs(t.entry! - entry)).toBeLessThan(.01);
    expect(t.endingError).toBeCloseTo(ending, 8); expect(t.iae).toBeCloseTo(iae, 4);
  });
  it('exposes the degradation after lag and a successful refined allocation', () => {
    const d = lead(), c = check(plant, d), normal = check(plant, d, lagForTarget(c, .1, .1)), refined = check(plant, d, lagForTarget(c, .1, .02));
    const limits = { maxOvershoot: 10, entryDeadline: 4, maxRamp: .1 };
    expect(nextStep(normal, stepTrace(normal, 80), limits)).toContain('Overshoot fails after adding lag');
    expect(nextStep(refined, stepTrace(refined, 80), limits)).toContain('All displayed checks');
  });
  it('checks the changed-plant physical reference and identifies the remaining deadline failure', () => {
    const p = { g: 2, a: 3, c0: 4 }, d = designLead(p, target, 8), c = check(p, d, lagForTarget(check(p, d), .05, .1)), t = stepTrace(c, 80);
    expect(t.overshoot).toBeCloseTo(9.195407933895439, 2); expect(Math.abs(t.entry! - 7.1255)).toBeLessThan(.01);
    expect(t.endingError).toBeCloseTo(-.000010213414414428357, 8); expect(t.iae).toBeCloseTo(.864414329792707, 4);
    expect(nextStep(c, t, { maxOvershoot: 10, entryDeadline: 4, maxRamp: .05 })).toContain('deadline fails');
  });
  it('matches the independent exact baseline over every returned point', () => {
    const trace = stepTrace(check(plant), 80);
    for (const p of trace.points) expect(p.y).toBeCloseTo(1 - Math.exp(-p.x) * (Math.cos(Math.sqrt(3) * p.x) + Math.sin(Math.sqrt(3) * p.x) / Math.sqrt(3)), 7);
    expect(trace.overshoot).toBeCloseTo(100 * Math.exp(-Math.PI / Math.sqrt(3)), 2);
  });
  it('matches the independent lead modal formula with all three modes', () => {
    const d = lead(), trace = stepTrace(check(plant, d), 80);
    // Residues of (12s+32)/[s(s+4)(s²+4s+8)]: A=.5, B=-1.5, D=-.5.
    for (const p of trace.points) expect(p.y).toBeCloseTo(1 + .5 * Math.exp(-4 * p.x) + Math.exp(-2 * p.x) * (-1.5 * Math.cos(2 * p.x) - .5 * Math.sin(2 * p.x)), 7);
    expect(trace.overshoot).toBeCloseTo(7.92483, 3); expect(trace.entry).toBeCloseTo(2.06875, 2);
  });
  it('provides requirement-specific guidance and distinguishes unresolved observation from failure', () => {
    const d = lead(), c = check(plant, d), limits = { maxOvershoot: 10, entryDeadline: 4, maxRamp: .1 };
    expect(nextStep(c, undefined, limits)).toContain('tracking');
    const combined = check(plant, d, lagForTarget(c, .1, .1)); expect(nextStep(combined, undefined, limits)).toContain('Verify');
    const short = stepTrace(combined, .5); expect(short.entry).toBeNull(); expect(nextStep(combined, short, { ...limits, maxOvershoot: 100 })).toContain('horizon');
    expect(nextStep(combined, { ...short, overshoot: 20 }, limits)).toContain('Move the lag corners');
    expect(nextStep(combined, { ...short, overshoot: 5, entry: 5 }, limits)).toContain('deadline');
    expect(nextStep(combined, { ...short, overshoot: 5, entry: 2 }, limits)).toContain('All displayed checks');
  });
  it('enforces complete stability after multiplication even if both sections are proper', () => {
    const c = check(plant, lead(), { z: 10, p: .2 }); expect(c.stability.status).toBe('unstable'); expect(c.rampError).toBeNull();
    expect(nextStep(c, undefined, { maxOvershoot: 10, entryDeadline: 4, maxRamp: .1 })).toContain('not strictly stable');
    expect(() => stepTrace(c, 80)).toThrow();
  });
  it('keeps repeated quadratic modes and guards work/nonfinite input', () => {
    const c = check({ ...plant, c0: 1 }), trace = stepTrace(c, 12);
    for (const p of trace.points) expect(p.y).toBeCloseTo(1 - (1 + p.x) * Math.exp(-p.x), 7);
    expect(() => stepTrace(check(plant, lead()), 200)).toThrow('60,000'); expect(() => stepTrace(c, Infinity)).toThrow();
  });
});

describe('finite root-locus illustration', () => {
  it('retains four branches, contains the selected gain and certifies every sample', () => {
    const d = lead(), c = check(plant, d, lagForTarget(check(plant, d), .1, .1)), locus = rootLocus(c, 60);
    expect(locus.branches).toHaveLength(4); expect(locus.gains).toContain(12); expect(locus.gains).toHaveLength(242);
    locus.gains.forEach((k, i) => {
      const coefficients = [...c.open], offset = coefficients.length - c.model.numerator.length;
      c.model.numerator.forEach((v, j) => { coefficients[offset + j] += v * k / c.gain; });
      locus.branches.forEach(b => expect(residual(coefficients, b[i])).toBeLessThan(1e-8));
    });
    expect(locus.branches[0][0]).toEqual({ re: 0, im: 0 });
  });
  it('extends a small requested range to contain the actual design and checks limits', () => {
    const c = check(plant, lead()), locus = rootLocus(c, 1); expect(locus.maximum).toBeCloseTo(14.4, 12); expect(locus.branches).toHaveLength(3);
    expect(() => rootLocus(c, 10001)).toThrow(); expect(() => rootLocus(check(plant), 10)).toThrow('Reveal');
  });
});

describe('domain, numerical consistency and stability guardrails', () => {
  it.each([NaN, Infinity, 0, -1, 20.1])('rejects unsupported plant numerator %s', g => expect(() => check({ ...plant, g })).toThrow());
  it('rejects a non-lead or unresolved remaining pole, stale plant and corrupted construction', () => {
    expect(() => designLead(plant, { sigma: 4, omega: 2 }, 6)).toThrow('remaining');
    expect(() => designLead(plant, { sigma: 1, omega: 1 }, 2)).toThrow('lead');
    expect(() => check({ ...plant, a: 3 }, lead())).toThrow('current plant'); expect(() => check(plant, { ...lead(), gain: 13 })).toThrow('Recalculate');
  });
  it('rejects unsupported ratio/corner/error values and invalid allocation order', () => {
    const c = check(plant, lead()); expect(() => lagForTarget(c, .0001, .1)).toThrow('ratio'); expect(() => lagForTarget(c, .1, .0001)).toThrow('zero');
    expect(() => requiredRatio(check(plant), .1)).toThrow('lead-only'); expect(() => check(plant, undefined, { z: .1, p: .02 })).toThrow('transient lead');
    expect(() => check(plant, lead(), { z: .1, p: .2 })).toThrow('ratio'); expect(() => requiredRatio(c, 0)).toThrow('error');
  });
  it('uses all Routh inequalities and resolves repeated identity cases', () => {
    expect(routh([1, 2, 1, 1, 1]).status).toBe('unstable'); expect(routh([1, 2, 3, 2, 2]).status).toBe('boundary');
    expect(poles([1, 4, 6, 4, 1])).toHaveLength(4); expect(() => poles([1, 1, 1, 1, 1, 1])).toThrow('degree');
  });
});
