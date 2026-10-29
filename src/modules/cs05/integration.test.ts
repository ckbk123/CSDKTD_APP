import { describe, expect, it } from 'vitest';
import { rat } from './exact';
import { parsePolynomial as parse } from './expression';
import { characteristic, cutNumber, intervalLatex, isStable, numericRoots, rationalCut, solveRegions } from './gains';

describe('CS05 independent complete-region integration fixtures',()=>{
  it('finds both stable intervals of a quadratic Hurwitz condition',()=>{
    // a2=a1=1+K, a0=5K, hence h=K^2-3K+1 and K>0.
    const region=solveRegions(parse('s^2+s+5'),parse('s^3+s^2+s'));
    expect(region.intervals).toHaveLength(2);const [first,second]=region.intervals;
    expect(cutNumber(first.lower)).toBe(0);expect(first.includeZero).toBe(false);
    expect(cutNumber(first.upper!)).toBeCloseTo((3-Math.sqrt(5))/2,13);expect(cutNumber(second.lower)).toBeCloseTo((3+Math.sqrt(5))/2,13);expect(second.upper).toBeUndefined();
    for(const [k,want] of [[0,false],[.1,true],[.5,false],[2,false],[3,true]] as const)expect(isStable(region,rationalCut(rat(Math.round(k*10),10)))).toBe(want);
  });
  it('handles lower-order gain boundaries and an unchanged zero-numerator loop',()=>{
    expect(solveRegions(parse('1'),parse('s-2')).intervals.map(intervalLatex)).toEqual(['(2,\\infty)']);
    const quadratic=solveRegions(parse('s+5'),parse('s^2-3s+2'));expect(quadratic.intervals.map(intervalLatex)).toEqual(['(3,\\infty)']);
    const roots=numericRoots(characteristic(quadratic.model,rationalCut(rat(3))));expect(roots).toHaveLength(2);expect(Math.abs(roots[0].im)).toBeCloseTo(Math.sqrt(17),12);expect(roots[0].re).toBeCloseTo(0,13);
    expect(solveRegions(parse('0',true),parse('(s+1)(s+2)')).intervals.map(intervalLatex)).toEqual(['[0,\\infty)']);
  });
  it.each([String.raw`\frac1\;2`,String.raw`\frac\,12`,'\\frac1\u20092',String.raw`\frac1{\left\;2}`,String.raw`\frac1{\left(\left[2\right\;\right)}`])('preflights malformed argument %s',s=>expect(()=>parse(s)).toThrow(/blank space cannot fill a box/));
  it('retains true fraction scope before removing display declarations',()=>{
    expect(()=>parse(String.raw`\frac\displaystyle 12`)).toThrow();expect(()=>parse(String.raw`\frac1\textstyle 2`)).toThrow();
    expect(parse(String.raw`\frac1{\displaystyle 2}`)).toEqual([rat(1,2)]);expect(parse(String.raw`\frac1{\;2}`)).toEqual([rat(1,2)]);expect(()=>parse(String.raw`1\;2`)).toThrow(/explicit/);
    expect(parse(String.raw`N(s)=\frac12(s+1)`)).toEqual([rat(1,2),rat(1,2)]);
  });
});
