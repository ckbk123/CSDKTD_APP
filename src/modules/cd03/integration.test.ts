import { describe, expect, it } from 'vitest';
import { model, parsePlant } from './model';
import { measure, response } from './response';

describe('CD03 independent lag integration fixtures',()=>{
  it('retains a hand-derived simple-pole response with the full controller zero',()=>{
    const m=model({a:3.5,b:1,k:7.25,lag:true,p:.5,z:40/29});expect(m.denominator).toEqual([1,4,9,10]);
    expect(m.fullRoots.some(p=>Math.abs(p.re+2)<1e-11&&p.im===0)).toBe(true);expect(m.fullRoots.some(p=>Math.abs(p.re+1)<1e-11&&Math.abs(p.im-2)<1e-11)).toBe(true);
    const r=response(m.numerator,m.denominator,m.fullRoots);for(const t of [0,.1,.5,1,4,10]){expect(r.value(t)).toBeCloseTo(1+.45*Math.exp(-2*t)-1.45*Math.exp(-t)*Math.cos(2*t)-.275*Math.exp(-t)*Math.sin(2*t),10);expect(r.slope(t)).toBeCloseTo(-.9*Math.exp(-2*t)+.9*Math.exp(-t)*Math.cos(2*t)+3.175*Math.exp(-t)*Math.sin(2*t),10);}
    expect(measure(r,10,.02).settling).toBeDefined();
  });
  it('checks tracking improvement without mistaking it for full stability',()=>{
    const stable=model({a:2,b:1,k:4,lag:true,p:.1,z:.5});expect(stable.denominator).toEqual([1,2.1,4.2,2]);expect(stable.beta).toBe(5);expect(stable.kv).toBe(10);expect(stable.rampError).toBe(.1);
    const unstable=model({a:2,b:1,k:4,lag:true,p:.5,z:5});expect(unstable.kv).toBe(20);expect(unstable.stability).toBe('unstable');expect(unstable.rampError).toBeUndefined();expect(()=>response(unstable.numerator,unstable.denominator,unstable.fullRoots)).toThrow(/strictly stable/);
  });
  it.each([String.raw`\frac1\;2`,String.raw`\frac\,12`,'\\frac1\u20092',String.raw`\frac1{\left\;2}`,String.raw`\frac1{\left(\left[2\right\;\right)}`])('preflights malformed argument %s',s=>expect(()=>parsePlant(s)).toThrow(/blank space cannot fill a box/));
  it('retains normal fraction products and refuses hidden canceled plant modes',()=>{
    expect(parsePlant(String.raw`\frac12\times\frac1{s(s+2)}`)).toEqual({a:2,b:.5});expect(()=>parsePlant('(s+3)/(s(s+2)(s+3))')).toThrow(/canceled/);
  });
});
