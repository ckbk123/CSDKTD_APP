import { describe, expect, it } from 'vitest';
import { recoverBase, recurrenceSamples, run, zohBaseline, type Experiment } from './math';
import { parseModel } from './parser';
const experiment=(extra:Partial<Experiment>={}):Experiment=>({T:.1,count:20,delay:0,amplitude:1,kind:'step',pastY:[0,0],pastU:[0,0],...extra});

describe('DR03 independent integration checks',()=>{
  it('matches a closed-form changed first-order convolution with prehistory for every supported delay',()=>{
    const p=.25,d=.5,b=-.75,history=2,model=parseModel('(.5z-.75)/(z-.25)');
    for(let delay=0;delay<=4;delay++){
      const pastU=[-1,3,4,5,6].slice(0,1+delay),e=experiment({count:20,delay,amplitude:1.5,kind:'alternating',pastY:[history],pastU}),r=run(model,e);
      const u=(k:number)=>k<0?pastU[-k-1]:1.5*(-1)**k;
      const expected=Array.from({length:20},(_,k)=>{let y=p**(k+1)*history;for(let j=0;j<=k;j++)y+=p**(k-j)*(d*u(j-delay)+b*u(j-delay-1));return y;});
      for(const rows of [r.rows,r.controller!.rows,r.observer!.rows])rows.forEach((row,k)=>expect(row.y).toBeCloseTo(expected[k],11));
    }
  });
  it('matches distinct-pole impulse samples and an independently expanded arbitrary-state resolvent',()=>{
    const r=run(parseModel('1/((z-.5)(z-.25))'),experiment({kind:'pulse'}));
    r.rows.forEach((row,k)=>expect(row.y).toBeCloseTo(k<2?0:(.5**(k-1)-.25**(k-1))/.25,12));
    expect(recoverBase({A:[[2,3],[-1,4]],B:[1,2],C:[-2,1],D:.5,labels:['x1','x2']})).toEqual({a:[1,-6,11],b:[.5,-3,-3.5]});
  });
  it('withholds a rounded trajectory whose exactly absent fast mode would contaminate the history tail',()=>{
    const model=parseModel('1/(z^2-2.1z+.9)'),e=experiment({T:1,count:81,amplitude:0,pastY:[.66,1.1]});
    // (z-1.5)(z-.6), y[-2]=1.1,y[-1]=.66 imply y80=1.1*.6^82.
    expect(1.1*.6**82).toBeLessThan(1e-18);
    expect(()=>run(model,e)).toThrow(/Roundoff amplification.*numerically unresolved/);
    expect(()=>recurrenceSamples(model,0,e.pastY,e.pastU,Array(81).fill(0))).toThrow(/Roundoff amplification/);
  });
  it('retains a genuinely excited fast component without clipping it to the slow mode',()=>{
    const r=run(parseModel('1/(z^2-2.1z+.9)'),experiment({T:1,count:40,amplitude:0,pastY:[.661,1.1]}));
    const fast=1/900,slow=1.1-fast;
    r.rows.forEach((row,k)=>expect(Math.abs(row.y-(fast*1.5**(k+2)+slow*.6**(k+2)))/Math.max(1,Math.abs(row.y))).toBeLessThan(1e-9));
    expect(r.rows.at(-1)!.y).toBeGreaterThan(100);
  });
  it('keeps the ordinary stable baseline supported through all120 samples',()=>{
    const r=run(zohBaseline(.1).model,experiment({count:120}));expect(r.rows).toHaveLength(120);
    r.rows.forEach((row,k)=>expect(row.y).toBeCloseTo(.5-Math.exp(-k*.1)+.5*Math.exp(-2*k*.1),10));
  });
  it.each([String.raw`\frac1\;2`,String.raw`\frac\,12`,String.raw`2^\;2`,'\\frac1\u20092',String.raw`\frac1{\left2\;}`])('checks argument scope before formatting removal: %s',source=>expect(()=>parseModel(source)).toThrow(/blank space cannot fill a box/));
  it('preserves complete fraction and exponent boxes',()=>{
    expect(parseModel(String.raw`\frac1{\;2}/(z-.5)`)).toEqual({a:[1,-.5],b:[0,.5]});
    expect(parseModel(String.raw`2^{\;2}/(z-.5)`)).toEqual({a:[1,-.5],b:[0,4]});
  });
});
