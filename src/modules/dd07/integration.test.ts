import {describe,expect,it} from 'vitest';
import {designObserver,designFeedback,simulate,zoh,type Options} from './math';
import {parseScalar,parseMatrix,parseTarget} from './parser';
const options=(extra:Partial<Options>={}):Options=>({initial:[1,2],prior:[0,0],heldInput:0,reference:0,noiseAmplitude:0,noiseFrequency:0,noisePhase:0,period:1,steps:20,timing:'predictor',...extra});
describe('DD07 independent integration/conditioning fixtures',()=>{
 it('withholds fabricated truth in the unexcited-fast-mode fixture',()=>{
  const observer=designObserver([1.125,.9375,.25,.875],[1,0],[-.5,.06]);
  expect(()=>simulate(observer,[0,0],options({initial:[-99.15,66.1],steps:49}))).toThrow(/Roundoff amplification.*numerically unresolved/);
 });
 it('retains a true fast component and a nearby genuinely excited state',()=>{
  const observer=designObserver([1.125,.9375,.25,.875],[1,0],[-.5,.06]);
  const fast=simulate(observer,[0,0],options({initial:[2.5,1],steps:15}));fast.samples.forEach(s=>{expect(s.x[0]/(2.5*1.5**s.k)).toBeCloseTo(1,11);expect(s.x[1]/1.5**s.k).toBeCloseTo(1,11);});
  const perturbed=simulate(observer,[0,0],options({initial:[-1.649,1.1],steps:20}));
  perturbed.samples.forEach(s=>expect(s.x[0]).toBeCloseTo(2.5/4000*1.5**s.k-1.5*(1.1-1/4000)*.5**s.k,10));
 });
 it('matches changed analytic plant/error modes under predictor and current timing',()=>{
  const observer=designObserver([.75,.25,0,.5],[1,0],[-.375,.03125]);expect(observer.L[0]).toBeCloseTo(.875,13);expect(observer.L[1]).toBeCloseTo(.375,13);
  for(const timing of ['predictor','current'] as const){const r=simulate(observer,[0,0],options({timing}));r.samples.forEach(s=>{
   const e=[2*.25**s.k-.125**s.k,3*.25**s.k-.125**s.k];expect(s.x[0]).toBeCloseTo(3*.75**s.k-2*.5**s.k,12);expect(s.x[1]).toBeCloseTo(2*.5**s.k,12);
   expect(s.priorError[0]).toBeCloseTo(e[0],12);expect(s.priorError[1]).toBeCloseTo(e[1],12);
   expect(s.error[0]).toBeCloseTo(timing==='current'?e[0]/12:e[0],12);expect(s.error[1]).toBeCloseTo(timing==='current'?e[1]-.75*e[0]:e[1],12);
  });}
 });
 it('matches independently expanded estimated-feedback response and preserves a1000-step baseline',()=>{
  const A=[0,1,-.25,1] as const,B=[0,1] as const,C=[1,0] as const,o=designObserver(A,C,[-.3,.02]),f=designFeedback(A,B,C,[-.75,.125]);
  expect(f.K[0]).toBeCloseTo(-.125,13);expect(f.K[1]).toBeCloseTo(.25,13);expect(f.prefilter).toBeCloseTo(.375,13);
  for(const timing of ['predictor','current'] as const){const r=simulate(o,B,options({initial:[0,0],reference:1,timing}),f);[0,0,.375,.65625,.8203125].forEach((y,k)=>expect(r.samples[k].x[0]).toBeCloseTo(y,12));}
  const base=zoh([0,1,-2,-3],[0,1],.1),ob=designObserver(base.A,[1,0],[-.7,.12]);expect(simulate(ob,base.B,options({initial:[1,0],period:.1,steps:1000})).samples).toHaveLength(1001);
 });
 it.each([String.raw`\frac1\;2`,String.raw`\frac\,12`,String.raw`2^\;2`,'\\frac1\u20092',String.raw`\frac1{\left2\;}`])('checks spacing scope at scalar/matrix/target entry: %s',source=>{
  expect(()=>parseScalar(source)).toThrow(/blank space cannot fill a box/);expect(()=>parseMatrix(String.raw`\begin{bmatrix}${source}&0\end{bmatrix}`,1,2,'C')).toThrow(/blank space cannot fill a box/);expect(()=>parseTarget('z^2+'+source)).toThrow(/blank space cannot fill a box/);
 });
 it('preserves properly braced fractions',()=>expect(parseScalar(String.raw`\frac1{\;2}`)).toBe(.5));
});
