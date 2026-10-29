import { describe, expect, it } from 'vitest';
import { designObserver, simulate, type Options } from './math';
import { allowanceStepper } from './roundoff';
const A=[0,1,-1,8.125] as const,initial=[1.1,.1375] as const;
const options:Options={initial,estimate:initial,heldInput:0,reference:0,noiseAmplitude:0,noiseFrequency:1,noisePhase:0,filterTau:0,horizon:5,count:201};
describe('CD09 propagated roundoff qualification',()=>{
  it('rejects shared fabricated truth rather than reporting accurate estimation of it',()=>expect(()=>simulate(designObserver(A,[1,0],[5,6]),[0,0],options)).toThrow(/roundoff|Roundoff/));
  it('preserves the resolvable slow eigenmode over a shorter horizon',()=>{
    for(const p of simulate(designObserver(A,[1,0],[5,6]),[0,0],{...options,horizon:1}).samples){expect(p.x[0]).toBeCloseTo(1.1*Math.exp(p.t/8),10);expect(p.x[1]).toBeCloseTo(.1375*Math.exp(p.t/8),10);}
  });
  it('preserves genuine fast growth with an independently known trajectory',()=>{
    const initial=[.001,.008] as const;for(const p of simulate(designObserver(A,[1,0],[5,6]),[0,0],{...options,horizon:.5,initial,estimate:initial}).samples){expect(p.x[0]).toBeCloseTo(.001*Math.exp(8*p.t),11);expect(p.x[1]).toBeCloseTo(.008*Math.exp(8*p.t),11);}
  });
  it('does not invent exponential roundoff growth for a signed rotation',()=>{
    const c=Math.cos(.5),s=Math.sin(.5),advance=allowanceStepper([c,-s,s,c],[1e-14,1e-14],2);let bounds=[0,0];for(let k=0;k<1000;k++)bounds=advance([1e-16,1e-16]);expect(Math.max(...bounds)).toBeLessThan(1e-10);
  });
  it.each([0,.1])('preserves a fast deterministic measurement with filter tau=%s',filterTau=>{
    const r=simulate(designObserver([0,1,-2,-3],[1,0],[13,42]),[0,1],{...options,initial:[1,0],estimate:[0,0],noiseAmplitude:.05,noiseFrequency:80,filterTau,horizon:1,count:401});expect(r.samples).toHaveLength(401);for(const p of r.samples)expect(p.noise).toBeCloseTo(.05*Math.sin(80*p.t),10);
  });
});
