import { describe, expect, it } from 'vitest';
import { baseline, design, discretize, realTargets, simulate } from './math';
import { scalar, parseMatrix } from './input';

describe('DD06 independent integration/conditioning checks',()=>{
  it('withholds the contaminated unexcited-fast-mode tail before presenting it as state truth',()=>{
    const d=design({A:[[0,1],[0,0]],B:[0,1],C:[1,0],T:1},realTargets(1.5,.5));
    expect(d.feedback!.K).toEqual([-.25,.125]);expect(d.feedback!.closed).toEqual([[1.125,.9375],[.25,.875]]);
    const r=simulate(d,[-99.15,66.1],0,49);expect(r.warning).toMatch(/roundoff amplification.*numerically unresolved/);expect(r.samples.length).toBeLessThan(50);
    r.samples.forEach(s=>{expect(Math.abs(s.x1+99.15*.5**s.k)).toBeLessThan(1e-8);expect(Math.abs(s.x2-66.1*.5**s.k)).toBeLessThan(1e-8);});
  });
  it('does not erase a true fast component or reject a clean long stable baseline',()=>{
    const d=design({A:[[0,1],[0,0]],B:[0,1],C:[1,0],T:1},realTargets(1.5,.5));
    const fast=simulate(d,[2.5,1],0,40);expect(fast.warning).toBe('');expect(fast.samples).toHaveLength(41);
    fast.samples.forEach(s=>{expect(s.x1/(2.5*1.5**s.k)).toBeCloseTo(1,11);expect(s.x2/1.5**s.k).toBeCloseTo(1,11);});
    const perturbed=simulate(d,[-1.649,1.1],0,35);expect(perturbed.warning).toBe('');expect(perturbed.samples.at(-1)!.x1).toBeGreaterThan(100);
    const ordinary=simulate(design(baseline(),realTargets(.7,.8)),[0,0],1,2000);expect(ordinary.warning).toBe('');expect(ordinary.samples).toHaveLength(2001);expect(ordinary.samples.at(-1)!.y).toBeCloseTo(1,10);
  });
  it('matches a changed nilpotent ZOH and independently derived deadbeat gains',()=>{
    const T=.25,plant={A:[[0,1],[0,0]] as const,B:[0,2] as const,C:[2,0] as const,T},m=discretize(plant),d=design(plant,realTargets(0,0));
    expect(m.Ad).toEqual([[1,T],[0,1]]);expect(m.Bd).toEqual([T*T,2*T]);
    expect(d.feedback!.K[0]).toBeCloseTo(1/(2*T*T),12);expect(d.feedback!.K[1]).toBeCloseTo(3/(4*T),12);
    expect(d.tracking!.available).toBe(true);if(d.tracking?.available)expect(d.tracking.N).toBeCloseTo(1/(4*T*T),12);
  });
  it.each([String.raw`\frac1\;2`,String.raw`\frac\,12`,'\\frac1\u20092',String.raw`\frac1{\left2\;}`])('checks spacing before scalar/matrix normalization: %s',source=>{
    expect(()=>scalar(source)).toThrow(/blank space cannot fill a box/);
    expect(()=>parseMatrix(String.raw`\begin{bmatrix}${source}&0\\0&1\end{bmatrix}`,2,2,'A')).toThrow(/blank space cannot fill a box/);
  });
  it('preserves properly scoped numeric fraction spacing',()=>expect(scalar(String.raw`\frac1{\;2}`)).toBe(.5));
});
