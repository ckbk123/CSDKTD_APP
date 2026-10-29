import { describe, expect, it } from 'vitest';
import { build, match, simulate } from './math';
import { parsePlant, parseScalar, parseTarget } from './parser';

describe('CD01 independent integration fixtures', () => {
  it('matches four independently chosen poles and coefficient equations', () => {
    const plant={b:1,a1:3,a0:2}, target=[1,23,126,232,128]; // (s+1)(s+2)(s+4)(s+16)
    const controller=match(plant,'PID',target,.05);
    expect(controller.kp).toBeCloseTo(9.28,12); expect(controller.ki).toBeCloseTo(6.4,12); expect(controller.kd).toBeCloseTo(2.736,12);
    const model=build(plant,controller); model.actual.forEach((c,i)=>expect(c).toBeCloseTo(target[i],9));
    expect(model.poles.map(p=>p[0]).sort((a,b)=>a-b)).toEqual(expect.arrayContaining([-16,-4,-2,-1].map(p=>expect.closeTo(p,7))));
    expect(model.stability).toBe('stable');
  });
  it('agrees with the elementary underdamped P step response and effort', () => {
    const model=build({b:1,a1:3,a0:2},{kind:'P',kp:4,ki:0,kd:0,tf:0});
    const run=simulate(model,{initial:[0,0],integral:0,filter:0,reference:1,horizon:4,count:9});
    for(const point of run.samples){const w=Math.sqrt(15)/2,t=point.t,y=2/3*(1-Math.exp(-1.5*t)*(Math.cos(w*t)+3/Math.sqrt(15)*Math.sin(w*t)));expect(point.y).toBeCloseTo(y,11);expect(point.u).toBeCloseTo(4*(1-y),11);}
    expect(run.steadyError).toBeCloseTo(1/3,14);
  });
  it.each([String.raw`\frac1\;2`,'\\frac1\u20092',String.raw`\frac1{\left\;2}`,String.raw`\frac1{\left(\left[2\right\;\right)}`])('preflights malformed argument %s', s=>{
    expect(()=>parseScalar(s)).toThrow(/blank space cannot fill a box/);
    expect(()=>parsePlant(`${s}/(s^2+3s+2)`)).toThrow(/blank space cannot fill a box/);
  });
  it('retains ordinary boxed fractions, visible factors and true powers',()=>{
    expect(parseScalar(String.raw`\frac1{\;2}`)).toBe(.5);
    expect(parsePlant(String.raw`\frac{\;1}{(s+1)(s+2)}`)).toEqual({b:1,a1:3,a0:2});
    expect(parseTarget('(s+1)(s+2)(s+4)(s+16)',4)).toEqual([1,23,126,232,128]);
  });
});
