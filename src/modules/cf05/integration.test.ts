import { describe, expect, it } from 'vitest';
import { parsePolynomial as parse } from './expression';
import { createLoop, equivalentSecondOrder, estimateEligibility, frequencyAnalysis, stepResponse } from './performance';

describe('CF05 independent time/frequency integration fixtures',()=>{
  it('recovers canonical second-order parameters and the analytic step response',()=>{
    const loop=createLoop(parse('4'),parse('s(s+2)')),f=frequencyAnalysis(loop),wc=2*Math.sqrt((Math.sqrt(5)-1)/2);
    expect(f.crossovers).toHaveLength(1);expect(f.crossovers[0].omega).toBeCloseTo(wc,8);
    expect(f.bandwidth).toBeCloseTo(2*Math.sqrt(.5+Math.sqrt(1.25)),8);
    const estimate=equivalentSecondOrder(f.crossovers[0].margin!,wc,'crossover');expect(estimate.zeta).toBeCloseTo(.5,8);expect(estimate.wn).toBeCloseTo(2,8);
    const step=stepResponse(loop,10);for(const point of step.points.filter((_,i)=>i%500===0)){const t=point.t;expect(point.y).toBeCloseTo(1-Math.exp(-t)*(Math.cos(Math.sqrt(3)*t)+Math.sin(Math.sqrt(3)*t)/Math.sqrt(3)),9);}
    expect(step.observedOvershoot).toBeCloseTo(100*Math.exp(-Math.PI/Math.sqrt(3)),3);
    expect(createLoop(parse('4'),parse('s(s+2)'),1,.5).characteristic.map(c=>Number(c.n)/Number(c.d))).toEqual([2,1,2.5,1]);
  });
  it('keeps the continuous phase branch through a RHP conjugate zero pair',()=>{
    const loop=createLoop(parse('2.5(s^2-2s+2)'),parse('(s+1)^3')),f=frequencyAnalysis(loop);expect(f.crossovers).toHaveLength(1);expect(f.crossovers[0].omega).toBeCloseTo(2,8);
    // N(2j)=-5-10j, phase -116.565°; D phase=3 atan(2),
    // continuously reached from DC. A per-root atan2 wrap must not add360°.
    const phase=(Math.atan2(-10,-5)-3*Math.atan(2))*180/Math.PI;expect(f.crossovers[0].phase).toBeCloseTo(phase,6);expect(f.crossovers[0].margin).toBeCloseTo(180+phase,6);
    expect(estimateEligibility(loop,f)).toBeDefined();
  });
  it.each([String.raw`\frac1\;2`,String.raw`\frac\,12`,'\\frac1\u20092',String.raw`\frac1{\left\;2}`,String.raw`\frac1{\left(\left[2\right\;\right)}`])('preflights malformed argument %s',s=>expect(()=>parse(s)).toThrow(/blank space cannot fill a box/));
  it('retains proper boxed fractions and explicit grouping',()=>expect(parse(String.raw`\frac1{\;2}`).map(c=>Number(c.n)/Number(c.d))).toEqual([.5]));
});
