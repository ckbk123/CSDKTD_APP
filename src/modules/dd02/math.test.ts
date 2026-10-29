import { describe, expect, it } from 'vitest';
import { characteristic, lag, lead, mapTarget, model, outsideCount, rootLocus, zoh, type Controller, type Plant } from './math';
const base=()=>zoh(50,5,.1), target=()=>mapTarget(.707,10,.1);
const close=(actual:number,expected:number,tolerance=1e-11)=>expect(Math.abs(actual-expected)).toBeLessThan(tolerance*Math.max(1,Math.abs(expected)));
describe('original continuous plant and exact ZOH',()=>{
  it('matches independently sampled continuous unit-step coefficients',()=>{
    const p=base(); close(p.r,.6065306597126334); close(p.b1,.21306131942526685); close(p.b0,.18040802086209984);
    const f=(t:number)=>10*t-2+2*Math.exp(-5*t);
    close(p.b1,f(.1)); close(p.b0,f(.2)-(2+p.r)*f(.1)); close((p.b1+p.b0)/(.1*(1-p.r)),10);
  });
  it.each([[100,5,.1],[50,5,.2],[10,2,.05],[.1,.2,.01],[1000,20,.5]])('preserves g=%s,a=%s,T=%s and physical velocity units',(g,a,T)=>{
    const p=zoh(g,a,T); close(p.b1+p.b0,g/a*T*(1-p.r)); close(p.b0,p.h*p.bv-p.r*p.by);
    expect(p.b1).toBeGreaterThan(0); expect(p.b0).toBeGreaterThan(0); expect(p.b0/p.b1).toBeLessThan(1);
  });
  it.each([[0,5,.1],[1,0,.1],[1,5,0],[1,5,NaN],[1,5,1],[Infinity,5,.1]])('rejects unsupported plant data',(g,a,T)=>expect(()=>zoh(g,a,T)).toThrow());
});
describe('mapped pair and full lead design',()=>{
  it('uses the provided .707 exactly and the independent geometric design',()=>{
    const d=lead(base(),target()); close(d.target.z.re,.37485863367741723); close(d.target.z.im,.32038986457595003);
    expect(d.m.c.kind).toBe('corners'); if(d.m.c.kind==='corners'){close(d.m.c.K,1.2541037958644339);close(d.m.c.zero,.6065306597126334);close(d.m.c.pole,.01691827679794633);}
    close(d.other,.6065306597126334); expect(d.m.poles).toHaveLength(3); expect(d.m.stability).toBe('stable'); close(d.check.requiredGain,d.m.c.K);
    close(d.check.value.re,-1); close(d.check.value.im,0); expect(Math.abs(d.check.phaseResidual)).toBeLessThan(1e-8); expect(Math.abs(d.check.magnitudeResidual)).toBeLessThan(1e-10);
    close(d.m.physicalKv,5.019434107709899); close(1/d.m.physicalKv,.19922564546860144);
    close(d.m.c.K*d.m.plant.by,.26720100944709013); // original physical first sample, no added delay
  });
  it('responds to doubled gain and changed sample period',()=>{
    const doubled=lead(zoh(100,5,.1),target()); close(doubled.m.c.K,.6270518979322169); close(doubled.m.physicalKv,5.019434107709899);
    const slower=lead(zoh(50,5,.2),mapTarget(.707,10,.2)); expect(slower.m.c.kind).toBe('corners');
    if(slower.m.c.kind==='corners'){close(slower.m.c.K,.7778518859318746);close(slower.m.c.pole,-.35194990593945);} close(slower.target.z.re,.037869329919504494); close(slower.other,.36787944117144233);
  });
  it('keeps an unstable extra mode even when the desired pair and controller are admissible',()=>{
    const d=lead(base(),target(),-.95); expect(d.m.c.kind).toBe('corners'); if(d.m.c.kind==='corners'){close(d.m.c.zero,.4178000240296565);close(d.m.c.K,4.352298324489035);}
    close(d.other,-1.020493031190213); expect(d.m.stability).toBe('unstable'); expect(d.m.outside).toBe(1); expect(d.check.polynomialResidual).toBeLessThan(1e-10);
  });
  it('accepts a changed manual pole and rejects invalid/non-lead or aliased constructions',()=>{
    const d=lead(base(),target(),.02); expect(d.cancellation).toBe(false); expect(d.m.stability).toBe('stable');
    expect(()=>mapTarget(.707,10,.5)).toThrow(/aliases/); expect(()=>mapTarget(1,10,.1)).toThrow(/damping/);
    expect(()=>lead(base(),mapTarget(.707,.1,.1))).toThrow(/not a lead/); expect(()=>lead(base(),target(),1)).toThrow(/pole/);
  });
});
describe('lag placement and explicit ramp conventions',()=>{
  it('meets the physical ramp goal with corners near +1',()=>{
    const d=lag(base(),1,.95,100,'physical'); expect(d.m.c.kind).toBe('corners'); if(d.m.c.kind==='corners') close(d.m.c.pole,.995);
    close(d.beta,10); close(d.m.physicalKv,100); close(d.m.sampleKv,10); close(d.error!,.01); expect(d.m.stability).toBe('stable');
  });
  it('changes the pole and physical gain for a unit-per-sample convention',()=>{
    const d=lag(base(),1,.95,100,'sample'); if(d.m.c.kind==='corners') close(d.m.c.pole,.9995);
    close(d.beta,100); close(d.m.physicalKv,1000,1e-10); close(d.m.sampleKv,100,1e-10); close(d.error!,.01); expect(d.m.stability).toBe('stable');
  });
  it('does not claim steady tracking from a formal Kv when placement is unstable',()=>{
    const d=lag(base(),1,0,100,'physical'); close(d.achieved,100); expect(d.m.stability).toBe('unstable'); expect(d.m.outside).toBe(2); expect(d.error).toBeNull();
  });
  it('uses a genuine constant controller when the minimum goal is already met',()=>{
    const d=lag(base(),1,.95,5,'physical'); expect(d.needed).toBe(false); expect(d.m.c.kind).toBe('constant'); expect(d.m.closed).toHaveLength(3); expect(d.m.poles).toHaveLength(2); close(d.achieved,10);
    const rounded=lag(zoh(.3,3,.1),1,.95,.1,'physical'); expect(rounded.m.c.kind).toBe('constant');
  });
  it('rejects unresolved boost/pole limits and malformed values',()=>{
    expect(()=>lag(base(),1,.95,1e4,'sample')).toThrow(/boost/); expect(()=>lag(base(),1,.9999,1e4,'physical')).toThrow(/pole/);
    expect(()=>lag(base(),0,.95,100,'physical')).toThrow(/gain/); expect(()=>lag(base(),1,1,100,'physical')).toThrow(/zero/);
    expect(()=>lag(base(),1,.95,NaN,'physical')).toThrow(/velocity/); expect(()=>lag(base(),1,.95,100,'bad' as never)).toThrow(/convention/);
  });
});
describe('complete polynomial, coefficient stability and locus',()=>{
  // Independent physical sampled-state characteristic: [y,v,w], u=K(e+(p-zc)w).
  function physicalCharacteristic(p:Plant,c:Extract<Controller,{kind:'corners'}>){
    const b=p.by*c.K,d=p.bv*c.K,t=c.pole-c.zero;
    const A=[[1-b,p.h,b*t],[-d,p.r,d*t],[-1,0,c.pole]];
    const trace=A[0][0]+A[1][1]+A[2][2], minors=A[0][0]*A[1][1]-A[0][1]*A[1][0]+A[0][0]*A[2][2]-A[0][2]*A[2][0]+A[1][1]*A[2][2]-A[1][2]*A[2][1];
    const det=A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1])-A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0])+A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]);
    return [-det,minors,-trace,1];
  }
  it.each([[50,5,.1,.95,.995,1],[100,3,.2,.8,.95,.5],[50,5,.1,.4178000240296565,-.95,4.352298324489035]])('matches the independent full physical state matrix',(g,a,T,zero,pole,K)=>{
    const p=zoh(g,a,T), c:Controller={kind:'corners',K,zero,pole}; const tf=characteristic(p,c).closed, state=physicalCharacteristic(p,c);
    tf.forEach((v,i)=>close(v,state[i]));
  });
  it.each([[[.08,.66,1.5,1],0],[[-.072,.66,-1.7,1],1],[[.25,0,1],0],[[-1.1,.9,1],1],[[1,-2,1],null]])('checks a separate coefficient count for %s',(p,expected)=>expect(outsideCount(p)).toBe(expected));
  it('retains all three gain branches including the stable cancellation',()=>{
    const d=lead(base(),target()), data=rootLocus(d.m,.1); expect(data.max).toBeGreaterThan(d.m.c.K); expect(data.gains).toContain(d.m.c.K); expect(data.branches).toHaveLength(3);
    expect(data.branches.every(b=>b.length===data.gains.length)).toBe(true);
    for(let i=0;i<data.gains.length;i++) if(data.branches.every(b=>b[i])) expect(data.branches.some(b=>Math.hypot(b[i]!.re-base().r,b[i]!.im)<1e-7)).toBe(true);
  });
  it('has two branches for a constant controller and respects the gain cap',()=>{
    const m=model(base(),{kind:'constant',K:1}), data=rootLocus(m,10); expect(data.branches).toHaveLength(2); expect(data.gains[0]).toBe(0); expect(data.gains.at(-1)).toBe(10);
    const large=model(base(),{kind:'constant',K:1e4}), cap=rootLocus(large,1); expect(cap.max).toBe(1e4); expect(cap.gains).toContain(1e4);
    expect(()=>rootLocus(m,NaN)).toThrow(); expect(()=>rootLocus(m,1e5)).toThrow();
  });
  it('keeps data caller-owned and does not retain a current plant or design',()=>{
    const a=lead(base(),target()), before=[...a.m.closed]; lag(zoh(100,3,.2),.5,.9,100,'physical'); const again=lead(base(),target()); expect(a.m.closed).toEqual(before); expect(again).toEqual(a); expect(again).not.toBe(a);
  });
});
