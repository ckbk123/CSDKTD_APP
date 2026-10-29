import { describe, expect, it } from 'vitest';
import { run, type Model } from './math';
import { parseConstant, parseMatrix } from './parser';

describe('CR06 independent integration fixtures',()=>{
  it('decomposes a singular double integrator without inverse A, including feedthrough',()=>{
    const model:Model={A:[[0,1],[0,0]],B:[0,2],C:[3,4],D:.5};
    const result=run(model,{horizon:2,count:21,input:3,initial1:[1,-1],initial2:[-2,2]});
    expect(result.transfer.numerator).toEqual([.5,8,6]);expect(result.transfer.denominator).toEqual([1,0,0]);
    for(const point of result.points){const t=point.t;expect(point.phi[0][1]).toBeCloseTo(t,13);expect(point.forced[0]).toBeCloseTo(3*t*t,12);expect(point.forced[1]).toBeCloseTo(6*t,12);expect(point.y1).toBeCloseTo(.5+21*t+9*t*t,11);expect(point.y2).toBeCloseTo(3.5+30*t+9*t*t,11);expect(point.difference[0]).toBeCloseTo(-3+3*t,12);}
  });
  it('keeps an unstable hidden state even though the zero-state channel reduces',()=>{
    const result=run({A:[[-1,0],[0,2]],B:[1,0],C:[1,0],D:0},{horizon:1,count:21,input:0,initial1:[0,.01],initial2:[0,0]});
    expect(result.transfer.reducedNumerator).toEqual([1]);expect(result.transfer.reducedDenominator).toEqual([1,1]);expect(result.modes.map(p=>p.real).sort()).toEqual([-1,2]);
    for(const point of result.points){expect(point.y1).toBe(0);expect(point.total1[1]).toBeCloseTo(.01*Math.exp(2*point.t),12);}
  });
  it.each([String.raw`\frac1\;2`,String.raw`\frac\,12`,'\\frac1\u20092',String.raw`\frac1{\left\;2}`,String.raw`\frac1{\left(\left[2\right\;\right)}`])('rejects a blank argument before entry and matrix normalization: %s',s=>{
    expect(()=>parseConstant(s)).toThrow(/blank space cannot fill a box/);expect(()=>parseMatrix(String.raw`\begin{bmatrix}${s}&1\\0&1\end{bmatrix}`,2,2,'A')).toThrow(/blank space cannot fill a box/);
  });
  it('retains braced numeric fractions and genuine matrix row delimiters',()=>{
    expect(parseConstant(String.raw`\frac1{\;2}`)).toBe(.5);expect(parseMatrix(String.raw`\begin{bmatrix}\frac{\;1}2&1\\0&1\end{bmatrix}`,2,2,'A')).toEqual([[.5,1],[0,1]]);
  });
});
