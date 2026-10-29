import { describe, expect, it } from 'vitest';
import { parsePlant, parseController } from './input';
import { density, metrics, panel, ranking, simulate, stability, uniform, verifyIntegral } from './math';
const base = parsePlant('1/((s+1)(s+2))');
const near = (actual: number, expected: number, tolerance = 2e-7) => expect(Math.abs(actual - expected)).toBeLessThan(tolerance * (1 + Math.abs(expected)));
describe('CF03 independent finite-horizon fixtures', () => {
  it('matches closed first-order error and all five analytic integrals', () => {
    const H = 2, r = simulate(parsePlant('1/(s+1)'), {kp:1,ki:0}, H, 1e-7);
    const e2 = Math.exp(-2*H), e4 = Math.exp(-4*H);
    const expected = {
      IAE:.5*H+.25*(1-e2),
      ISE:.25*H+.25*(1-e2)+.0625*(1-e4),
      ITAE:.25*H*H+.125*(1-(1+2*H)*e2),
      ITSE:.125*H*H+.125*(1-(1+2*H)*e2)+.015625*(1-(1+4*H)*e4),
    };
    r.samples.forEach(s=>near(s.e,.5+.5*Math.exp(-2*s.t),1e-8));
    for (const m of ['IAE','ISE','ITAE','ITSE'] as const) near(r.totals[m],expected[m]);
    near(r.totals.Effort,expected.ISE);
    expect(r.sampledPeakControl).toBe(1);
    expect(r.stability.stable).toBe(true);
  });
  it('matches baseline analytic damped response and exponential-antiderivative costs', () => {
    const r = simulate(base,{kp:4,ki:0},10,1e-7), w=Math.sqrt(15)/2;
    r.samples.forEach(s=>near(s.e,1/3+2/3*Math.exp(-1.5*s.t)*(Math.cos(w*s.t)+1.5/w*Math.sin(w*s.t)),2e-8));
    // Independently evaluated exponential-pair antiderivatives; no RK state or quadrature code used.
    const expected=[3.666666590918936,1.5185184680200159,16.722221469421186,5.645061226527535,24.296295488320254];
    metrics.forEach((m,i)=>near(r.totals[m],expected[i]));
    expect(r.stability.characteristic).toEqual([1,3,6]);
  });
  it('checks a ranking reversal from independent cubic residues, not an optimizer', () => {
    const A=simulate(base,{kp:.5,ki:.5},10,1e-7), B=simulate(base,{kp:2,ki:.25},10,1e-7);
    // E(s)=(s²+3s+2)/[s³+3s²+(2+Kp)s+Ki]. Residue expansion then analytic
    // integrals of exp(λt), t exp(λt), and pairwise products give these values.
    const a=[3.7796985901715963,2.242892549216929,11.044829827238443,4.041792314118543,24.74085301368561];
    const b=[4.055776887555571,1.9147761290106218,16.490048901391503,5.686785677641458,20.24187150642767];
    metrics.forEach((m,i)=>{near(A.totals[m],a[i]);near(B.totals[m],b[i]);});
    expect(ranking(A.totals.IAE,B.totals.IAE)).toBe('A');
    expect(ranking(A.totals.ISE,B.totals.ISE)).toBe('B');
    expect(ranking(A.totals.ITAE,B.totals.ITAE)).toBe('A');
    expect(ranking(A.totals.Effort,B.totals.Effort)).toBe('B');
    expect(A.stability.characteristic).toEqual([1,3,2.5,.5]); // stable cancelled channel mode retained in full state check
    expect(A.stability.stable && B.stability.stable).toBe(true);
  });
  it('handles zero proportional gain and changed plant scaling from closed expressions', () => {
    const zero=simulate(base,parseController('0'),3);
    expect(zero.samples.every(s=>s.y===0&&s.e===1&&s.u===0)).toBe(true);
    near(zero.totals.IAE,3); near(zero.totals.ISE,3);near(zero.totals.ITAE,4.5);near(zero.totals.ITSE,4.5);expect(zero.totals.Effort).toBe(0);
    const changed=simulate(parsePlant('1/(2s+2)'),{kp:1,ki:0},2,1e-7);
    changed.samples.forEach(s=>near(s.y,(1-Math.exp(-1.5*s.t))/3,1e-8));
  });
  it('keeps short unstable trajectories finite but never certifies them as stable', () => {
    const plant=parsePlant('1/(s+1)'), c={kp:-4,ki:0};
    const r=simulate(plant,c,.5,1e-7);
    near(r.samples.at(-1)!.e,-1/3+4/3*Math.exp(1.5));
    expect(r.stability.stable).toBe(false);
    expect(r.stability.characteristic).toEqual([1,-3]);
    expect(()=>simulate(plant,c,10)).toThrow(/magnitude/);
    expect(stability(base,{kp:4,ki:18}).stable).toBe(false); // (s+3)(s²+6)
    expect(stability(base,{kp:4,ki:17}).stable).toBe(true);
  });
  it('uses common horizons and a separately accumulated finer trapezoidal check', () => {
    const r=simulate(parsePlant('1/(s+1)'),{kp:1,ki:0},2,1e-5);
    const check=verifyIntegral(r,'ISE');
    expect(check.intervals).toBeGreaterThanOrEqual(2*r.intervals);
    expect(check.tolerance).toBeCloseTo(r.tolerance/10,12);
    expect(check.consistent).toBe(true);
    near(check.trapezoid,.5+.25*(1-Math.exp(-4))+.0625*(1-Math.exp(-8)),1e-5);
    const longer=simulate(parsePlant('1/(s+1)'),{kp:1,ki:0},4);
    expect(longer.totals.ITAE).toBeGreaterThan(r.totals.ITAE);
  });
  it('exposes Simpson panel arithmetic and cumulative sum as a checked decomposition', () => {
    const r=simulate(base,{kp:4,ki:0},10), p=panel(r,5,'ITAE'), h=r.horizon/r.intervals;
    near(p.contribution,h/3*(density(p.samples[0],'ITAE')+4*density(p.samples[1],'ITAE')+density(p.samples[2],'ITAE')),1e-12);
    near(panel(r,10,'IAE').cumulative,r.totals.IAE,1e-12);
    expect(()=>panel(r,11,'IAE')).toThrow(/inspection/);
    expect(ranking(1,1+1e-10)).toBe('tie');
  });
  it('reports bounded input and resolution failures instead of returning plausible costs', () => {
    for(const h of [NaN,Infinity,0,.01,51]) expect(()=>simulate(base,{kp:4,ki:0},h)).toThrow(/horizon/);
    for(const tol of [0,NaN,1e-10,.1]) expect(()=>simulate(base,{kp:4,ki:0},10,tol)).toThrow(/tolerance/);
    expect(()=>simulate({g:1,a:[1,1000,1]},{kp:1,ki:0},50)).toThrow(/too fast/);
    expect(()=>simulate({g:1000,a:[1,1]},{kp:1000,ki:0},.05)).toThrow(/too fast/);
    expect(()=>uniform(base,{kp:4,ki:0},10,3)).toThrow(/even/);
    expect(()=>simulate({g:NaN,a:[1,3,2]},{kp:4,ki:0},10)).toThrow(/normalized/);
    expect(()=>simulate(base,{kp:4,ki:NaN},10)).toThrow(/finite/);
    expect(()=>verifyIntegral(simulate(base,{kp:4,ki:0},1,1e-8),'IAE')).toThrow(/finest tolerance/);
  });
});
