import { describe, expect, it } from 'vitest';
import { run, type Experiment, type Model } from './math';
const model:Model={A:[[0,1],[-1,8.125]],B:[0,0],C:[1,0],D:0};
const experiment:Experiment={horizon:5,count:201,input:0,initial1:[1.1,.1375],initial2:[0,0]};
describe('CR06 rounded exponential projection qualification',()=>{
  it('rejects the inaccurate slow eigenvector projection instead of displaying [0,-12]',()=>expect(()=>run(model,experiment)).toThrow(/projection.*numerically unresolved/));
  it('preserves the exact slow-mode response on a resolvable shorter horizon',()=>{
    for(const p of run(model,{...experiment,horizon:1}).points){expect(p.total1[0]).toBeCloseTo(1.1*Math.exp(p.t/8),10);expect(p.total1[1]).toBeCloseTo(.1375*Math.exp(p.t/8),10);}
  });
  it('preserves genuine fast-mode growth and stable fast decay',()=>{
    for(const p of run(model,{...experiment,horizon:1,initial1:[.001,.008]}).points){expect(p.total1[0]).toBeCloseTo(.001*Math.exp(8*p.t),9);expect(p.total1[1]).toBeCloseTo(.008*Math.exp(8*p.t),9);}
    const stable=run({...model,A:[[-50,0],[0,-3]]},{...experiment,horizon:1,initial1:[1,1]});expect(stable.points.at(-1)!.total1[0]).toBeCloseTo(Math.exp(-50),25);expect(stable.points.at(-1)!.total1[1]).toBeCloseTo(Math.exp(-3),12);
  });
  it('retains a well-resolved nonnormal stable projection',()=>{
    for(const p of run({...model,A:[[-2,50],[0,-3]]},{...experiment,horizon:1,initial1:[1,-1]}).points)expect(p.total1[0]).toBeCloseTo(-49*Math.exp(-2*p.t)+50*Math.exp(-3*p.t),10);
  });
});
