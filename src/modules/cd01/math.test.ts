import {describe,expect,it} from 'vitest';
import {build,match,simulate,standard,type Controller,type Kind,type Options} from './math';
import {exponential,roots,type Complex} from './numerics';
const plant={b:1,a1:3,a0:2},base:Controller={kind:'PID',kp:4,ki:2,kd:1,tf:.05};
const options:Options={initial:[0,0],integral:0,filter:0,reference:1,horizon:20,count:801};
const near=(actual:readonly number[],expected:readonly number[],tolerance=1e-9)=>{expect(actual).toHaveLength(expected.length);actual.forEach((v,i)=>expect(Math.abs(v-expected[i])).toBeLessThanOrEqual(tolerance*Math.max(1,Math.abs(expected[i]))));};
function modesNear(actual:Complex[],expected:Complex[],tolerance=1e-8){
  const remaining=[...actual];for(const [a,b]of expected){const distances=remaining.map(([x,y])=>Math.hypot(x-a,y-b)),i=distances.indexOf(Math.min(...distances));expect(distances[i]).toBeLessThan(tolerance);remaining.splice(i,1);}expect(remaining).toHaveLength(0);
}
describe('complete bounded polynomial roots and transitions',()=>{
  it('finds four distinct real modes',()=>modesNear(roots([1,10,35,50,24]),[[-1,0],[-2,0],[-3,0],[-4,0]]));
  it('finds two distinct conjugate pairs',()=>modesNear(roots([1,8,30,56,65]),[[-1,2],[-1,-2],[-3,2],[-3,-2]]));
  it('retains zero, imaginary-axis and right-half-plane modes',()=>modesNear(roots([1,-1,1,-1,0]),[[0,0],[1,0],[0,1],[0,-1]]));
  it('preserves repeated multiplicities with sensitive-root tolerance',()=>{
    modesNear(roots([1,4,6,4,1]),[[-1,0],[-1,0],[-1,0],[-1,0]],1e-6);
    modesNear(roots([1,23,114,212,136]),[[-17,0],[-2,0],[-2,0],[-2,0]],2e-4);
    modesNear(roots([1,0,0,0,0]),[[0,0],[0,0],[0,0],[0,0]]);
  });
  it('handles biquadratics with complex squares and degree1–3',()=>{
    const a=Math.SQRT1_2;modesNear(roots([1,0,0,0,1]),[[a,a],[a,-a],[-a,a],[-a,-a]]);
    modesNear(roots([1,3,3,1]),[[-1,0],[-1,0],[-1,0]],1e-5);modesNear(roots([1,3,2]),[[-1,0],[-2,0]]);modesNear(roots([1,-3]),[[3,0]]);
  });
  it('rejects nonfinite, unsupported order and excessive work',()=>{
    for(const q of [[1,NaN],[2,3,4],[1,1,1,1,1,1],[1,1e20]])expect(()=>roots(q)).toThrow();
    expect(()=>exponential([1e20],1)).toThrow(/scaling/);near(exponential([0,1,0,0],2),[1,1,0,1]);
  });
});
describe('linear P/PI/filtered PD/PID model and independent responses',()=>{
  it('converts the parallel filtered controller to equivalent standard parameters',()=>{
    expect(standard(base)).toEqual({ti:2,td:.25,tf:.05});expect(standard({...base,kp:0})).toBeNull();expect(standard({...base,ki:0,kd:0})).toEqual({ti:null,td:0,tf:0});
  });
  it('matches independent SciPy1.18.1 TF-to-state/expm fixtures for every course comparison',()=>{
    // Reference numerator/denominator were entered independently from the loop:
    // P4/[1,3,6], PI[4,2]/[1,3,6,2], PID[1.2,4.1,2]/[.05,1.15,4.3,6.1,2].
    // Effort numerator is each output numerator times[1,3,2], retaining direct feedthrough.
    const fixtures:{kind:Kind;y:number[];u:number[]}[]=[
      {kind:'P',y:[0,.6122559347216655,.667096000453091,.666666666666593],u:[4,1.550976261113338,1.3316159981876359,1.333333333333628]},
      {kind:'PI',y:[0,.7328586907061303,.9696794914130417,.9999274367869994],u:[4,2.4134468963636975,1.968859715421647,1.9999309652989252]},
      {kind:'PID',y:[0,.7232639601893959,.971128782713998,.9999700109233961],u:[24,1.8964989138990447,1.9759366374534828,1.9999749340840935]},
    ];
    for(const f of fixtures){const r=simulate(build(plant,{...base,kind:f.kind}),options);near([0,40,200,800].map(k=>r.samples[k].y),f.y,1e-9);near([0,40,200,800].map(k=>r.samples[k].u),f.u,1e-9);}
  });
  it('derives every course characteristic polynomial and derivative kick',()=>{
    const p=build(plant,{...base,kind:'P'}),pi=build(plant,{...base,kind:'PI'}),pid=build(plant,base),pd=build(plant,{...base,kind:'PD'});
    near(p.actual,[1,3,6]);near(pi.actual,[1,3,6,2]);near(pd.actual,[1,23,86,120]);near(pid.actual,[1,23,86,122,40]);
    for(const m of [p,pi,pd,pid]){expect(m.stability).toBe('stable');expect(m.poles).toHaveLength(m.order);expect(m.residual).toBeLessThan(1e-12);}
    const first=simulate(pid,options).samples[0];near([first.p,first.i,first.d,first.u],[4,0,20,24]);
    expect(p.dcGain).toBeCloseTo(2/3,12);expect(pi.dcGain).toBe(1);expect(pid.dcGain).toBe(1);
  });
  it('matches analytic P response with a conjugate pair and nonzero DC error',()=>{
    const m=build(plant,{...base,kind:'P'}),r=simulate(m,options),w=Math.sqrt(15)/2;
    for(const s of r.samples){const expected=2/3*(1-Math.exp(-1.5*s.t)*(Math.cos(w*s.t)+1.5/w*Math.sin(w*s.t)));expect(s.y).toBeCloseTo(expected,10);expect(s.u).toBeCloseTo(4*(1-expected),10);}
    expect(r.steadyError).toBeCloseTo(1/3,12);expect(r.inBandAtEnd).toBe(false);
  });
  it('distinguishes command tracking from final-value transients in the course comparison',()=>{
    const p=simulate(build(plant,{...base,kind:'P'}),options),pi=simulate(build(plant,{...base,kind:'PI'}),options);
    expect(p.overshoot).toBe(0);expect(p.overshootFinal).toBeGreaterThan(8);expect(p.inBandAtEnd).toBe(false);expect(p.inFinalBandAtEnd).toBe(true);
    expect(p.lastOutsideFinalBand!).toBeLessThan(pi.lastOutsideFinalBand!);expect(p.steadyError!).toBeGreaterThan(pi.steadyError!);
  });
  it('starts a sampled final-value window at zero when no sample leaves it',()=>{
    const r=simulate(build(plant,{...base,kind:'P'}),{...options,initial:[2/3,0]});expect(r.inFinalBandAtEnd).toBe(true);expect(r.lastOutsideFinalBand).toBeNull();expect(r.observedFinalWindowStart).toBe(0);expect(r.steadyError).toBeCloseTo(1/3,12);
  });
  it('retains the cancelled internal mode in an independently analytic PI fixture',()=>{
    const m=build(plant,{...base,kind:'PI',kp:1,ki:1}),r=simulate(m,options);
    expect(m.order).toBe(3);modesNear(m.poles,[[-1,0],[-1,0],[-1,0]],1e-5);
    for(const s of r.samples){expect(s.y).toBeCloseTo(1-(1+s.t)*Math.exp(-s.t),10);expect(s.u).toBeCloseTo(2-Math.exp(-s.t),10);expect(s.i).toBeCloseTo(2-(s.t+2)*Math.exp(-s.t),10);}
    expect(r.steadyError).toBe(0);expect(r.overshoot).toBe(0);expect(r.inBandAtEnd).toBe(true);expect(r.lastOutsideBand).toBeGreaterThan(5.8);expect(r.lastOutsideBand).toBeLessThan(5.85);
  });
  it('removes only inactive controller terms, preserving plant modes',()=>{
    const p=build(plant,{...base,ki:0,kd:0}),pi=build(plant,{...base,kd:0}),pd=build(plant,{...base,ki:0});
    expect(p.activeKind).toBe('P');expect(p.order).toBe(2);expect(pi.activeKind).toBe('PI');expect(pi.order).toBe(3);expect(pd.activeKind).toBe('PD');expect(pd.order).toBe(3);
    const zero=build(plant,{...base,kp:0,ki:0,kd:0});modesNear(zero.poles,[[-1,0],[-2,0]]);expect(simulate(zero,options).samples.every(s=>s.y===0&&s.u===0)).toBe(true);
  });
  it.each(['P','PI','PD','PID'] as Kind[])('verifies coefficient matching for %s and fixed coefficient constraints',kind=>{
    const original=build(plant,{...base,kind}),suggested=match(plant,kind,original.actual,.05);near([suggested.kp,suggested.ki,suggested.kd],[4,kind.includes('I')?2:0,kind.includes('D')?1:0]);
    const wrong=[...original.actual];wrong[1]+=.25;expect(()=>match(plant,kind,wrong,.05)).toThrow();
  });
  it('checks a changed authored target independently rather than fitting the baseline',()=>{
    const c=match(plant,'PID',[1,23,114,212,136],.05);near([c.kp,c.ki,c.kd],[8.26,6.8,2.187]);const m=build(plant,c);near(m.actual,[1,23,114,212,136]);modesNear(m.poles,[[-17,0],[-2,0],[-2,0],[-2,0]],2e-4);
    const cpi=match(plant,'PI',[1,3,3,1],.05);near([cpi.kp,cpi.ki],[1,1]);
  });
  it('responds to changed numerator with reciprocal gains and the same trajectories',()=>{
    const m=build(plant,base),changed=build({...plant,b:2},{...base,kp:2,ki:1,kd:.5});near(changed.actual,m.actual);
    const a=simulate(m,options),b=simulate(changed,options);for(let k=0;k<a.samples.length;k++){expect(a.samples[k].y).toBeCloseTo(b.samples[k].y,10);expect(a.samples[k].u/2).toBeCloseTo(b.samples[k].u,10);}
  });
  it('keeps nonzero initial data and controller contributions distinct',()=>{
    const r=simulate(build(plant,base),{...options,initial:[.2,-.3],integral:.4,filter:.1,reference:.5});near([r.samples[0].y,r.samples[0].velocity,r.samples[0].error],[.2,-.3,.3]);near([r.samples[0].p,r.samples[0].i,r.samples[0].d,r.samples[0].u],[1.2,.8,4,6]);
    for(const s of r.samples)expect(s.u).toBeCloseTo(s.p+s.i+s.d,12);
  });
  it('separates instability, boundary and insufficient horizons',()=>{
    const unstable=build(plant,{...base,kind:'P',kp:-3});expect(unstable.stability).toBe('unstable');expect(unstable.dcGain).toBeNull();expect(()=>simulate(unstable,{...options,horizon:100})).toThrow(/magnitude/);
    const boundary=build(plant,{...base,kind:'P',kp:-2});expect(boundary.stability).toBe('near boundary');expect(boundary.poles.some(p=>p[0]===0)).toBe(true);
    const short=simulate(build(plant,{...base,kind:'PI',kp:1,ki:1}),{...options,horizon:1});expect(short.inBandAtEnd).toBe(false);expect(short.lastOutsideBand).toBe(1);
    const zeroRef=simulate(build(plant,base),{...options,reference:0});expect(zeroRef.overshoot).toBeNull();expect(zeroRef.lastOutsideBand).toBeNull();
  });
  it('stabilizes an authored unstable plant while simpler comparisons grow beyond the horizon bound',()=>{
    const p={b:1,a1:-1,a0:-1},c={...base,kd:4},m=build(p,c);near(m.actual,[1,19,63,62,40]);expect(m.stability).toBe('stable');expect(simulate(m,{...options,horizon:100}).samples.at(-1)!.y).toBeCloseTo(1,8);
    expect(()=>simulate(build(p,{...c,kind:'P'}),{...options,horizon:100})).toThrow(/magnitude/);
  });
  it('bounds gains, filter, targets, states and horizons',()=>{
    for(const p of [{...plant,b:0},{...plant,a1:Infinity},{...plant,b:101}])expect(()=>build(p,base)).toThrow();
    for(const c of [{...base,kp:101},{...base,tf:0},{...base,tf:.0001}])expect(()=>build(plant,c)).toThrow();
    expect(()=>match(plant,'P',[1,3,-1],.05)).toThrow(/Hurwitz/);expect(()=>match(plant,'PID',[1,23,86,122,0],.05)).toThrow();
    const m=build(plant,base);for(const patch of [{horizon:0},{count:1002},{initial:[101,0]},{reference:NaN}])expect(()=>simulate(m,{...options,...patch} as Options)).toThrow();
  });
});
