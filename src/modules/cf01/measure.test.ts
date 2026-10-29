import { describe, expect, it } from 'vitest';
import { buildResponse } from './response';
import { assess, deriveTargets, measure, pairPrediction } from './measure';
const near = (a: number | undefined, b: number, e = 1e-7) => { expect(a).toBeDefined(); expect(Math.abs(a! - b)).toBeLessThan(e); };
const baseline = () => buildResponse({ g: 4, a1: 2, a0: 4 });
describe('CF01 transient measurements and target guidelines', () => {
  it('matches independent roots of the closed baseline formula rather than a rounded source caption', () => {
    const m = measure(baseline(), 10, 2);
    near(m.riseStart, .24411464790369086); near(m.riseEnd, 1.0629011215678648);
    near(m.riseTime, .8187864736641739); near(m.peakTime, 1.8137993642342178);
    near(m.overshootPercent, 16.303353482158048); near(m.settlingTime, 4.038174486963996);
    expect(m.peakEstablished).toBe(true); expect(m.envelope).toBeLessThan(.02);
    expect(m.refinementChange).toBeLessThanOrEqual(m.tolerance);
    // A first-inside 1ms grid rounds this crossing up to4.039s.
    expect(m.settlingTime).toBeGreaterThan(4.038); expect(m.settlingTime).toBeLessThan(4.039);
  });
  it('changes band and rise definition using independently solved crossings', () => {
    const m = measure(baseline(), 10, 5, '0-100');
    near(m.riseTime, 1.2091995761561454); near(m.settlingTime, 2.6445466101521538);
    near(measure(baseline(),10,1).settlingTime,4.390282361937942);
    expect(m.settlingTime).toBeLessThan(measure(baseline(), 10, 2).settlingTime!);
  });
  it('never labels a short apparently in-band endpoint as established settling', () => {
    const m = measure(baseline(), 1.21, 2);
    expect(Math.abs(m.samples.at(-1)!.value - 1)).toBeLessThan(.02);
    expect(m.settlingTime).toBeUndefined(); expect(m.envelope).toBeGreaterThan(.02);
    const unknown = assess(m, deriveTargets(20, 4, 2));
    expect(unknown.settling).toBeUndefined(); expect(unknown.overshoot).toBeUndefined();
  });
  it('handles critical and triple factors, with no fictitious finite100% rise/peak', () => {
    const critical = measure(buildResponse({ g: 1, a1: 2, a0: 1 }), 15);
    near(critical.riseTime, 3.3579085614778172); near(critical.settlingTime, 5.833921701917387);
    expect(critical.overshootPercent).toBe(0); expect(critical.peakTime).toBeUndefined(); expect(critical.peakEstablished).toBe(true);
    near(measure(buildResponse({ g: 1, a1: 2, a0: 1, pole: 1 }), 15).settlingTime, 7.516603875609476);
    expect(measure(buildResponse({ g: 1, a1: 2, a0: 1 }), 100, 2, '0-100').riseTime).toBeUndefined();
  });
  it('keeps the target pair fixed while a slow pole changes performance', () => {
    const full = buildResponse({ g: 4, a1: 2, a0: 4, pole: .2 });
    const short = measure(full, 10), longer = measure(full, 40);
    expect(full.poles.slice(0, 2)).toEqual(baseline().poles);
    expect(short.settlingTime).toBeUndefined(); expect(longer.settlingTime).toBeGreaterThan(15);
    expect(short.noOvershoot).toBe(true); expect(longer.noOvershoot).toBe(true);
    expect(longer.overshootPercent).toBe(0);
    const noOvershoot = measure(buildResponse({ g: 4, a1: 2, a0: 4, pole: 1 }), 15, 2, '0-100');
    expect(noOvershoot.noOvershoot).toBe(true); expect(noOvershoot.riseTime).toBeUndefined();
  });
  it('derives the requirement region but checks actual full-model performance separately', () => {
    const target = deriveTargets(20, 4, 2), r = baseline();
    near(target.dampingMinimum, .4559498107691261); near(target.decayMinimum, 1);
    expect(pairPrediction(r, target).inRegion).toBe(true); near(pairPrediction(r, target).settlingGuideline, 4);
    expect(assess(measure(r, 10), target)).toEqual({ overshoot: true, settling: false });
    expect(assess(measure(r,10),deriveTargets(16.303353482158048,4.038174486963996,2))).toEqual({overshoot:undefined,settling:undefined});
    expect(deriveTargets(0, 4, 2).dampingMinimum).toBe(1);
    expect(assess(measure(buildResponse({g:1,a1:2,a0:1}),15),deriveTargets(0,6,2))).toEqual({overshoot:true,settling:true});
  });
  it('reports bounded setting/work failures and a changed frequency instead of reusing baseline data', () => {
    for (const h of [NaN, 0, .01, 101]) expect(() => measure(baseline(), h)).toThrow(/horizon/);
    expect(() => measure(baseline(), 10, 3 as 2)).toThrow(/band/);
    expect(() => measure(baseline(), 10, 2, '10-90', 1e-8)).toThrow(/tolerance/);
    expect(() => measure(buildResponse({ g: 400, a1: 40, a0: 400, pole: 50 }), 100)).toThrow(/bounded/);
    expect(() => deriveTargets(100, 4, 2)).toThrow(/overshoot/);
    expect(() => deriveTargets(20, 0, 2)).toThrow(/settling/);
    const twice = measure(buildResponse({ g: 16, a1: 4, a0: 16 }), 5);
    near(twice.settlingTime, 4.038174486963996 / 2); near(twice.overshootPercent, 16.303353482158048);
  });
});
