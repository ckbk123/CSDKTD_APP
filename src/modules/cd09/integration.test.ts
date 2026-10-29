import { describe, expect, it } from 'vitest';
import { characteristic3, designFeedback, designObserver, simulate, type Options } from './math';
import { parseMatrix, parseScalar, parseTarget } from './parser';

const options:Options={initial:[0,0],estimate:[0,0],heldInput:0,reference:1,noiseAmplitude:0,noiseFrequency:1,noisePhase:0,filterTau:0,horizon:4,count:17};
describe('CD09 independent integration fixtures',()=>{
  it('derives a diagonal-plant observer and its single-mode error analytically',()=>{
    const observer=designObserver([-1,0,0,-2],[1,1],[7,12]);expect(observer.L[0]).toBeCloseTo(6,12);expect(observer.L[1]).toBeCloseTo(-2,12);
    const run=simulate(observer,[0,0],{...options,initial:[-3,2]});
    for(const point of run.samples){expect(point.x[0]).toBeCloseTo(-3*Math.exp(-point.t),11);expect(point.x[1]).toBeCloseTo(2*Math.exp(-2*point.t),11);expect(point.error[0]).toBeCloseTo(-3*Math.exp(-3*point.t),11);expect(point.error[1]).toBeCloseTo(2*Math.exp(-3*point.t),11);}
    expect(()=>designObserver([-1,0,0,-2],[0,1],[7,12])).toThrow(/rank/);
  });
  it('checks changed-input feedback and physical step response',()=>{
    const A=[0,1,-2,-3] as const,B=[0,2] as const,C=[1,0] as const,observer=designObserver(A,C,[13,42]),feedback=designFeedback(A,B,C,[7,10]);
    expect(feedback.K[0]).toBeCloseTo(4,12);expect(feedback.K[1]).toBeCloseTo(2,12);expect(feedback.prefilter).toBeCloseTo(5,12);
    for(const point of simulate(observer,B,options,feedback).samples){const t=point.t;expect(point.cleanOutput).toBeCloseTo(1-5/3*Math.exp(-2*t)+2/3*Math.exp(-5*t),10);expect(point.effort).toBeCloseTo(1+4*Math.exp(-5*t),10);}
    const filtered=simulate(observer,B,{...options,filterTau:.2});expect(characteristic3(filtered.errorMatrix)).toEqual([8,67,210]);
  });
  it.each([String.raw`\frac1\;2`,String.raw`\frac\,12`,'\\frac1\u20092',String.raw`\frac1{\left\;2}`,String.raw`\frac1{\left(\left[2\right\;\right)}`])('rejects incomplete spacing arguments in scalar, matrix and target: %s',s=>{
    expect(()=>parseScalar(s)).toThrow(/blank space cannot fill a box/);
    expect(()=>parseMatrix(String.raw`C=\begin{bmatrix}${s}&1\end{bmatrix}`,1,2,'C')).toThrow(/blank space cannot fill a box/);
    expect(()=>parseTarget(`s^2+${s}s+1`)).toThrow(/blank space cannot fill a box/);
  });
  it('retains boxed fractions and actual matrix row separators',()=>{
    expect(parseScalar(String.raw`\frac1{\;2}`)).toBe(.5);
    expect(parseMatrix(String.raw`A=\begin{bmatrix}\frac1{\;2}&1\\ -2&-3\end{bmatrix}`,2,2,'A')).toEqual([.5,1,-2,-3]);
    expect(parseTarget('s^{2}+7s+12')).toEqual([7,12]);
  });
});
