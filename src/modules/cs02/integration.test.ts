import { describe, expect, it } from 'vitest';
import { q, textQ } from './algebra';
import { analyzeCoefficients } from './math';
import { parseAnswer, parseCharacteristic } from './parser';

// Factors encode known real roots/conjugate pairs. This convolution does not
// use the Routh recurrence, symbolic epsilon, Sturm count or Hurwitz routines.
const product=(factors:number[][])=>factors.reduce((a,b)=>{const c=Array(a.length+b.length-1).fill(0) as number[];a.forEach((x,i)=>b.forEach((y,j)=>c[i+j]+=x*y));return c;},[1]);
describe('CS02 independent factor-root integration fixtures',()=>{
  it.each([
    {f:[[-2,1],[3,1]],want:[1,0,1]},
    {f:[[-1,1],[-1,1],[2,1],[2,1]],want:[2,0,2]},
    {f:[[0,0,1],[9,0,1],[-4,0,1]],want:[1,4,1]},
    {f:[[1,0,1],[1,0,1],[1,0,1]],want:[0,6,0]},
    {f:[[5,-2,1],[8,4,1],[1,1]],want:[2,0,3]},
    {f:[[4,0,1],[-1,1],[-1,1],[-1,1]],want:[3,2,0]},
    {f:[[-2,0,1],[3,0,1],[5,4,1]],want:[1,2,3]},
    {f:[[0,1],[-2,1],[3,1],[2,2,1]],want:[1,1,3]},
    {f:Array.from({length:6},()=>[-1,1]),want:[6,0,0]},
    {f:Array.from({length:6},()=>[1,1]),want:[0,0,6]},
  ])('counts all roots of known factors %#',({f,want})=>{
    const coefficients=product(f);for(const scale of [1,-3]){const result=analyzeCoefficients(coefficients.map(c=>q(scale*c)));expect([result.right,result.axis,result.left]).toEqual(want);expect(result.strict).toBe(want[0]===0&&want[1]===0);}
  });
  it('matches hand-derived cubic Hurwitz minors',()=>expect(analyzeCoefficients([13,11,7,1].map(c=>q(c))).minors.map(textQ)).toEqual(['7','64','832']));
  it.each([String.raw`\frac1\;2`,String.raw`\frac\,12`,'\\frac1\u20092',String.raw`\frac1{\left\;2}`,String.raw`\frac1{\left(\left[2\right\;\right)}`])('preflights malformed argument %s',s=>{
    expect(()=>parseAnswer(s)).toThrow(/blank space cannot fill a box/);expect(()=>parseCharacteristic(`s^2+${s}s+1`,0)).toThrow(/blank space cannot fill a box/);
  });
  it('retains supported boxed fractions and exact polynomial grouping',()=>{
    expect(textQ(parseAnswer(String.raw`\frac1{\;2}`))).toBe('1/2');expect(parseCharacteristic('(s+1)^2',0).map(textQ)).toEqual(['1','2','1']);
  });
});
