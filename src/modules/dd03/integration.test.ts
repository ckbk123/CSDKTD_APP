import { describe, expect, it } from 'vitest';
import { analyzeFrequency, createModel, designDirect, frequency, fromWarped, sampledResponse, warpedPlantFrequency } from './math';
import { parsePlant } from './input';

describe('DD03 independent sampled/w-plane integration fixtures',()=>{
  it('matches ZOH moments from direct integration and the first two held updates',()=>{
    const p={gain:2,p:3},T=.2,m=createModel(p,T,{kind:'constant',K:2}),a=Math.exp(-.6),h=1-a,b1=2/9*(.6-h),b0=2/9*(h-.6*a);
    expect(m.b1).toBeCloseTo(b1,14);expect(m.b0).toBeCloseTo(b0,14);
    const response=sampledResponse(m,20);expect(response.values[1]).toBeCloseTo(2*b1,14);expect(response.values[2]).toBeCloseTo(4*b1-4*b1*b1+2*p.gain*h*h/(p.p*p.p),13);
  });
  it('preserves exact bilinear frequency mapping at changed physical frequencies',()=>{
    const m=createModel({gain:2,p:3},.2,{kind:'constant',K:1});for(const nu of [.1,1,8,50]){const axis=fromWarped(nu,m.T),actual=frequency(m,axis.angle,m.T),w=warpedPlantFrequency(m,nu);expect(w.re).toBeCloseTo(actual.value!.re,10);expect(w.im).toBeCloseTo(actual.value!.im,10);expect(axis.omega).toBeCloseTo(2*Math.atan(nu*m.T/2)/m.T,13);}
  });
  it('designs physical crossover2/PM60 and rechecks the full unit-circle loop',()=>{
    const design=designDirect({gain:1,p:2},.1,2,60),at=frequency(design.model,.2,.1);expect(at.magnitude).toBeCloseTo(1,12);expect(at.phase).toBeCloseTo(-120,11);
    const analysis=analyzeFrequency(design.model);expect(analysis.gain.points.some(p=>Math.abs(p.angle-.2)<1e-7)).toBe(true);expect(analysis.phaseMargins.some(p=>Math.abs(p.degrees-60)<1e-6)).toBe(true);
    expect(design.warped).toBeCloseTo(20*Math.tan(.1),13);expect(design.warped).not.toBe(2);
  });
  it.each([String.raw`\frac1\;2`,String.raw`\frac\,12`,'\\frac1\u20092',String.raw`\frac1{\left\;2}`,String.raw`\frac1{\left(\left[2\right\;\right)}`])('preflights malformed argument %s',s=>expect(()=>parsePlant(String.raw`\frac{${s}}{s(s+2)}`)).toThrow(/blank space cannot fill a box/));
  it('retains ordinary compact fractions and valid visual powers',()=>expect(parsePlant(String.raw`\frac12\times\frac1{s(s+2)}`)).toEqual({gain:.5,p:2}));
});
