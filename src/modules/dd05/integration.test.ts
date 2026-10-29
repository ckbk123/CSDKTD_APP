import { describe, expect, it } from 'vitest';
import { design, desiredRoots, simulate, type Settings } from './math';
import { parsePlant } from './input';

describe('DD05 independent integration checks', () => {
  it('matches independently expanded changed PI/PID targets and their first outputs for different sensors and plant gains', () => {
    for (const structure of ['pi','pid'] as const) for (const gain of [.5,2]) for (const sensor of [.25,1,2]) for (const preweight of ['raw','calibrated'] as const) {
      const settings: Settings={plant:{gain,tau:1},sensor,T:Math.log(2),structure,reference:1,preweight}, hb=sensor*gain/2;
      const result=design(settings,{mode:'discrete',re:.4,im:.2},-.5,'comparator',false),m=result.model,r=simulate(m,20),scale=(preweight==='raw'?1:sensor)/sensor;
      const q=structure==='pi'?[.7/hb,-.3/hb]:[1.2/hb,-.7/hb,.1/hb];
      q.forEach((v,i)=>expect(m.q[i]).toBeCloseTo(v,11)); expect(result.compatible).toBe(true);
      expect(m.gains.kp).toBeCloseTo((structure==='pi'?.3:.5)/hb,11); expect(m.gains.ki*settings.T).toBeCloseTo((structure==='pi'?.4:.6)/hb,11);
      expect(m.gains.kd/settings.T).toBeCloseTo(structure==='pi'?0:.1/hb,11);
      const outputs=structure==='pi'?[0,.7,.96,1.028]:[0,1.2,.86,1.098];
      outputs.forEach((v,k)=>expect(r.samples[k].output).toBeCloseTo(scale*v,10));
      for(let k=0;k<3;k++)expect(r.samples[k].control).toBeCloseTo(2/gain*scale*(outputs[k+1]-.5*outputs[k]),10);
      expect(r.limit).toBeCloseTo(scale,12); expect(r.physicalLimit).toBeCloseTo(1-scale,12);
      expect(m.poles).toHaveLength(structure==='pi'?2:3);
      expect(m.poles!.filter(z=>Math.abs(z.re-.4)<1e-10&&Math.abs(Math.abs(z.im)-.2)<1e-10)).toHaveLength(2);
      if(structure==='pid')expect(m.poles!.some(z=>Math.abs(z.re+.5)<1e-10&&Math.abs(z.im)<1e-10)).toBe(true);
    }
  });
  it('maps continuous targets with physical seconds and rejects aliasing',()=>{
    const d=desiredRoots({mode:'continuous',zeta:.6,wn:2},.2,'pi',0),radius=Math.exp(-.24),angle=.32;
    expect(d.pair[0].re).toBeCloseTo(radius*Math.cos(angle),13);expect(d.pair[0].im).toBeCloseTo(radius*Math.sin(angle),13);
    expect(()=>desiredRoots({mode:'continuous',zeta:.1,wn:20},1,'pi',0)).toThrow(/Nyquist/);
  });
  it.each([String.raw`\frac1\;2`, String.raw`\frac\,12`, String.raw`2^\;2`, '\\frac1\u20092', String.raw`\frac1{\left2\;}`])('checks spacing argument scope: %s',source=>expect(()=>parsePlant(source)).toThrow(/blank space cannot fill a box/));
  it('preserves complete numeric fraction/power boxes in the supported plant',()=>{
    expect(parsePlant(String.raw`\frac1{\;2}/(s+1)`)).toEqual({gain:.5,tau:1});
    expect(parsePlant(String.raw`2^{\;2}/(s+1)`)).toEqual({gain:4,tau:1});
  });
});
