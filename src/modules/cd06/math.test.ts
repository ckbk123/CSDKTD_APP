import { describe, expect, it } from 'vitest';
import { analyze, designLead, frequency, gainCrossover, model, multiply, phaseCrossings, poles, requiredRatio, residual, routh, stepTrace, type Loop } from './math';

const plant = { g: 1, a: 2, k: 4 }, base: Loop = { plant }, lag: Loop = { plant, lag: { z: .1, p: .02 } };
const manual: Loop = { ...lag, lead: { z: 2, p: 4 } };
const closeArray = (a: number[], b: number[]) => { expect(a).toHaveLength(b.length); a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 10)); };

describe('independent identities and complete models', () => {
  it('initializes the accepted baseline and exact second-order poles, crossover and error', () => {
    const a = analyze(base); closeArray(a.model.closed, [1, 2, 4]); expect(a.stability.status).toBe('stable'); expect(a.rampError).toBe(.5);
    expect(a.crossover).toBeCloseTo(Math.sqrt(-2 + Math.sqrt(20)), 11);
    expect(a.phaseMargin).toBeCloseTo(90 - Math.atan(a.crossover / 2) * 180 / Math.PI, 10);
    expect(a.poles).toEqual([{ re: -1, im: Math.sqrt(3) }, { re: -1, im: -Math.sqrt(3) }]); expect(a.phaseCrossings).toEqual([]);
  });
  it('derives the required DC ratio, including a changed plant and an already met target', () => {
    expect(requiredRatio(plant, .1)).toBe(5); expect(requiredRatio(plant, 1)).toBe(1);
    expect(requiredRatio({ g: 2, a: 3, k: 6 }, .05)).toBeCloseTo(5, 12); expect(requiredRatio(plant, .0001)).toBe(5000);
  });
  it('retains all three lag modes and their cubic coefficients', () => {
    const a = analyze(lag); closeArray(a.model.open, [1, 2.02, .04, 0]); closeArray(a.model.numerator, [4, .4]); closeArray(a.model.closed, [1, 2.02, 4.04, .4]);
    expect(a.poles).toHaveLength(3); expect(a.poles.every(z => z.re < 0 && residual(a.model.closed, z) < 1e-10)).toBe(true);
    expect(a.kv).toBe(10); expect(a.rampError).toBe(.1); expect(a.phaseMargin).toBeLessThan(analyze(base).phaseMargin);
    const pair = a.poles.find(z => z.im > 0)!;
    expect(pair.re).toBeCloseTo(-.9579228570345749, 10); expect(pair.im).toBeCloseTo(1.7096316146082948, 10);
    expect(a.poles.find(z => Math.abs(z.im) < 1e-10)!.re).toBeCloseTo(-.10415428593085017, 10);
  });
  it('retains the stable canceled −2 mode in the full quartic and preserves DC gain', () => {
    const a = analyze(manual); closeArray(a.model.closed, [1, 6.02, 16.12, 16.96, 1.6]);
    closeArray(a.model.numerator, [8, 16.8, 1.6]); expect(a.poles).toHaveLength(4);
    expect(a.poles.some(z => Math.abs(z.re + 2) < 1e-8 && Math.abs(z.im) < 1e-8)).toBe(true);
    expect(a.poles.every(z => residual(a.model.closed, z) < 1e-10)).toBe(true); expect(a.kv).toBe(10); expect(a.rampError).toBe(.1);
    closeArray(multiply([1, 2], [1, 4.02, 8.08, .8]), a.model.closed);
  });
  it('shows that keeping the lag ratio fixed does not keep crossover or phase fixed', () => {
    const near = analyze({ plant, lag: { z: .5, p: .1 } }), far = analyze(lag);
    expect(near.rampError).toBe(far.rampError); expect(near.crossover).toBeGreaterThan(far.crossover);
    expect(near.phaseMargin).toBeLessThan(far.phaseMargin - 8);
  });
  it('handles an identity lag without deleting its stable hidden pole', () => {
    const a = analyze({ plant, lag: { z: .1, p: .1 } });
    expect(a.poles).toHaveLength(3); expect(a.rampError).toBe(.5); expect(a.crossover).toBeCloseTo(analyze(base).crossover, 11);
  });
  it('is invariant under reciprocal changes to g and proportional gain', () => {
    const a = analyze(manual), b = analyze({ ...manual, plant: { g: 2, a: 2, k: 2 } });
    closeArray(a.model.closed, b.model.closed); expect(a.crossover).toBe(b.crossover); expect(a.rampError).toBe(b.rampError);
  });
  it('computes a changed plant/target rather than a baseline-only answer', () => {
    const p = { g: 2, a: 3, k: 6 }, a = analyze({ plant: p, lag: { z: .2, p: .04 } });
    closeArray(a.model.closed, [1, 3.04, 12.12, 2.4]); closeArray(a.model.numerator, [12, 2.4]);
    expect(a.kv).toBe(20); expect(a.rampError).toBe(.05); expect(a.stability.status).toBe('stable');
    expect(a.crossover).toBeCloseTo(2.8882236532787062, 10); expect(a.phaseMargin).toBeCloseTo(42.91975416411606, 9);
  });
});

describe('all crossovers and independent full-polynomial stability', () => {
  it('has a strictly decreasing magnitude and exactly one checked gain crossing', () => {
    for (const loop of [base, lag, manual]) {
      const values = [.0001, .01, .1, 1, 2, 10, 100, 10000].map(w => frequency(loop, w).magnitude);
      expect(values.every((v, i) => !i || v < values[i - 1])).toBe(true);
      const w = gainCrossover(loop); expect(frequency(loop, w).magnitude).toBeCloseTo(1, 12);
    }
  });
  it('finds the exact finite phase crossing and critical gain of an aggressive lag', () => {
    const critical = .4 * 2.2 / 7.8, aggressive: Loop = { plant, lag: { z: 10, p: .2 } };
    const a = analyze(aggressive), w = Math.sqrt(4 / 7.8);
    expect(a.phaseCrossings).toHaveLength(1); expect(a.phaseCrossings[0].omega).toBeCloseTo(w, 12);
    expect(a.phaseCrossings[0].gainMarginDb).toBeCloseTo(20 * Math.log10(critical / 4), 10);
    expect(a.stability.status).toBe('unstable'); expect(a.rampError).toBeNull(); expect(a.poles.some(z => z.re > 0)).toBe(true);
    const boundary = analyze({ ...aggressive, plant: { ...plant, k: critical } });
    expect(boundary.stability.status).toBe('boundary'); expect(boundary.rampError).toBeNull(); expect(boundary.phaseCrossings[0].gainMarginDb).toBeCloseTo(0, 10);
  });
  it('finds both finite −180° crossings of a lead–lag, with opposite gain-margin signs', () => {
    const loop: Loop = { ...lag, lag: { z: 10, p: .2 }, lead: { z: 20, p: 100 } };
    const crossings = phaseCrossings(model(loop)); expect(crossings).toHaveLength(2);
    // Hand expansion gives −72.2*x² + 13868*x − 8000 = 0, x=w².
    const root = Math.sqrt(13868 ** 2 - 4 * 72.2 * 8000);
    expect(crossings[0].omega).toBeCloseTo(Math.sqrt((13868 - root) / (2 * 72.2)), 8);
    expect(crossings[1].omega).toBeCloseTo(Math.sqrt((13868 + root) / (2 * 72.2)), 8);
    expect(crossings[0].gainMarginDb).toBeLessThan(0); expect(crossings[1].gainMarginDb).toBeGreaterThan(0);
    for (const c of crossings) expect(frequency(loop, c.omega).phase).toBeCloseTo(-180, 8);
    expect(analyze(loop).stability.status).toBe('unstable');
  });
  it('rejects an unresolved near-tangent phase case instead of silently missing two crossings', () => {
    // For a=2, lag=(10,.2), lead pole=100, the discriminant in lead zero z is:
    // (801.6²+1600)z² − (2*801.6*2164+147520)z + 2164².
    const a = 801.6 ** 2 + 1600, b = -(2 * 801.6 * 2164 + 147520), c = 2164 ** 2;
    const z = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a) * (1 + 1e-13);
    expect(() => phaseCrossings(model({ plant, lag: { z: 10, p: .2 }, lead: { z, p: 100 } }))).toThrow('tangent');
  });
  it.each([
    [[1, 2, 4], 'stable'], [[1, 2, 1, 2], 'boundary'], [[1, 2, 1, 3], 'unstable'],
    [[1, 4, 6, 4, 1], 'stable'], [[1, 2, 3, 2, 2], 'boundary'], [[1, 2, 1, 1, 1], 'unstable'],
  ] as const)('classifies the complete polynomial %j as %s', (c, status) => expect(routh(c).status).toBe(status));
  it('does not confuse coefficient positivity with quartic stability', () => {
    const c = [1, 2, 1, 1, 1]; expect(c.every(v => v > 0)).toBe(true); expect(routh(c).status).toBe('unstable');
    expect(poles(c).some(z => z.re > 0)).toBe(true);
  });
  it('supports repeated roots and certifies all reconstructed poles', () => {
    expect(poles([1, 2, 1])).toEqual([{ re: -1, im: 0 }, { re: -1, im: 0 }]);
    const c = [1, 4, 6, 4, 1], z = poles(c); expect(z).toHaveLength(4);
    expect(z.every(v => Math.abs(v.re + 1) < .01 && Math.abs(v.im) < .01 && residual(c, v) < 1e-9)).toBe(true);
  });
});

describe('lead design at the moved crossover', () => {
  it('meets the actual 55° target plus visible 2° reserve without changing ramp error', () => {
    const plan = designLead(lag, 55, 1, 2.5)!; expect(plan).not.toBeNull();
    const a = analyze({ ...lag, lead: plan }); expect(a.phaseMargin).toBeCloseTo(57, 7);
    expect(a.crossover).toBeCloseTo(plan.omega, 9); expect(a.crossover).toBeGreaterThan(analyze(lag).crossover);
    expect(Math.sqrt(plan.z * plan.p)).toBeCloseTo(a.crossover, 10); expect(a.rampError).toBe(.1); expect(a.stability.status).toBe('stable');
  });
  it('recognizes an already satisfied lag and a lead that cannot lower crossover', () => {
    expect(designLead(lag, 45, 1, 2.5)).toBeNull(); expect(() => designLead(lag, 55, 1, 1.5)).toThrow('cannot lower');
    expect(() => designLead(lag, 85, 1, 1.6)).toThrow('No peak-centered lead');
    expect(() => designLead(lag, 55, 3, 2)).toThrow('minimum');
  });
});

describe('full-state response and bounded observations', () => {
  it.each([
    [lag, 21.560804842637516, 7.1215, -.0006776908386845193, 1.1670939677896397],
    [manual, 8.347236996358397, 7.806, -.0006966262207828144, .9336945704988219],
    [{ plant: { g: 2, a: 3, k: 6 }, lag: { z: .2, p: .04 } }, 28.13333673286429, 3.692, -.000010351149850817976, .6809087599640147],
  ] as const)('matches the separate Python physical-cascade reference for %j', (loop, overshoot, entry, ending, iae) => {
    const t = stepTrace(analyze(loop), 40);
    expect(t.overshoot).toBeCloseTo(overshoot, 2); expect(Math.abs(t.entry! - entry)).toBeLessThan(.02);
    expect(t.endingError).toBeCloseTo(ending, 8); expect(t.iae).toBeCloseTo(iae, 4);
  });
  it('matches the independent exact baseline step over the whole returned trace', () => {
    const a = analyze(base), trace = stepTrace(a, 40);
    for (const p of trace.points) expect(p.y).toBeCloseTo(1 - Math.exp(-p.x) * (Math.cos(Math.sqrt(3) * p.x) + Math.sin(Math.sqrt(3) * p.x) / Math.sqrt(3)), 7);
    expect(trace.overshoot).toBeCloseTo(100 * Math.exp(-Math.PI / Math.sqrt(3)), 2); expect(trace.entry).toBeGreaterThan(4); expect(trace.entry).toBeLessThan(4.1);
    expect(trace.halfStepDifference).toBeLessThan(.00001); expect(trace.points.length).toBeLessThanOrEqual(901);
  });
  it('retains repeated-mode dynamics without a residue singularity', () => {
    const trace = stepTrace(analyze({ plant: { ...plant, k: 1 } }), 12);
    for (const p of trace.points) expect(p.y).toBeCloseTo(1 - (1 + p.x) * Math.exp(-p.x), 7);
    expect(trace.overshoot).toBe(0); expect(trace.entry).not.toBeNull();
  });
  it('reports a short window as unresolved and never calls an unstable trace settled', () => {
    expect(stepTrace(analyze(lag), .5).entry).toBeNull();
    const a = analyze({ plant, lag: { z: 10, p: .2 } }); expect(stepTrace(a, 1).entry).toBeNull(); expect(a.rampError).toBeNull();
    expect(() => stepTrace(a, 40)).toThrow('grew');
  });
  it('rejects excessive work rather than silently changing the requested model', () => {
    const a = analyze({ ...lag, lead: { z: 1, p: 100 } }); expect(() => stepTrace(a, 200)).toThrow('60,000');
  });
});

describe('domain and numerical guardrails', () => {
  it.each([NaN, Infinity, 0, -.1, 20.01])('rejects unsupported plant gain %s', g => expect(() => analyze({ plant: { ...plant, g } })).toThrow());
  it.each([{ z: .1, p: .2 }, { z: .1, p: 0 }, { z: 10, p: .1 }, { z: .001, p: .0001 }])('rejects unsupported lag corners %j', c => expect(() => analyze({ plant, lag: c })).toThrow());
  it.each([{ z: 2, p: 2 }, { z: 2, p: 1 }, { z: .01, p: 2 }, { z: 1, p: 101 }])('rejects unsupported lead corners %j', c => expect(() => analyze({ ...lag, lead: c })).toThrow());
  it('guards unsupported polynomial forms and invalid frequencies/targets/horizons', () => {
    expect(() => poles([1, 1, 1, 1, 1, 1])).toThrow('degree'); expect(() => poles([2, 1, 1])).toThrow('monic');
    expect(() => poles([1, Infinity, 1])).toThrow('finite'); expect(() => routh([1, 1])).toThrow('degree');
    expect(() => frequency(base, 0)).toThrow('Frequency'); expect(() => requiredRatio(plant, 0)).toThrow('error'); expect(() => stepTrace(analyze(base), 201)).toThrow('horizon');
  });
});
