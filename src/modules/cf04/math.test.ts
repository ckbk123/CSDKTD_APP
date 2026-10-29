import { describe,it,expect } from 'vitest';
import { readModel,analyze,at,abs,phase,bandwidthCrossings } from './math';
import { num,textRat,parseRational } from './algebra';
const model=(values=['1','2','4','0','0'])=>readModel(values);
describe('CF04 independent course and changed-data fixtures',()=>{
  it('distinguishes touching the bandwidth level from leaving the DC passband',()=>{
    const grazing=bandwidthCrossings(['-4','9','-6','1'].map(s=>parseRational(s)));
    expect(grazing.map(r=>r.direction)).toEqual(['touch','down']);expect(grazing[0].omega).toBeCloseTo(1,10);expect(grazing[1].omega).toBeCloseTo(2,10);
    const alternating=bandwidthCrossings(['-36','49','-14','1'].map(s=>parseRational(s)));
    expect(alternating.map(r=>r.direction)).toEqual(['down','up','down']);
  });
  it('recovers scalar-compensated second-order formulas independently',()=>{
    const r=analyze(model()),wc=Math.sqrt(-2+2*Math.sqrt(5));
    expect(r.state).toBe('stable');expect(r.gainCrossings).toHaveLength(1);expect(r.gainCrossings[0].omega).toBeCloseTo(wc,10);
    expect(r.gainCrossings[0].pm).toBeCloseTo(Math.atan(2/wc)*180/Math.PI,10);expect(r.gainCrossings[0].pm).toBeCloseTo(51.82729237,6);
    expect(r.phaseCrossings).toHaveLength(0);expect(textRat(r.kv)).toBe('2');
    expect(r.performance!.peakOmega).toBeCloseTo(Math.sqrt(2),10);expect(r.performance!.peak).toBeCloseTo(2/Math.sqrt(3),10);
    expect(r.performance!.bandwidth).toBeCloseTo(Math.sqrt(2+2*Math.sqrt(5)),10);
  });
  it('verifies the rounded course lead at ω=2, same Kv and changed final margin',()=>{
    const r=analyze(model(['1','2','4','.7071067812','.3535533906']));
    expect(r.gainCrossings[0].omega).toBeCloseTo(2,9);expect(r.gainCrossings[0].pm).toBeCloseTo(64.47122063,6);expect(num(r.kv)).toBe(2);
    // At ω=2 the plant is -1/8-j/8. Controller magnitude=4√2; loop unity.
    expect(abs(at(r.model,'G',2))).toBeCloseTo(1/Math.sqrt(32),13);expect(abs(at(r.model,'L',2))).toBeCloseTo(1,9);
    expect(r.phaseCrossings).toHaveLength(0);expect(r.performance!.bandwidth).toBeGreaterThan(0);
  });
  it('checks changed plant/gain against analytic second-order specifications',()=>{
    const r=analyze(model(['2','3','5','0','0'])),q=10,a=3,x=(-a*a+Math.sqrt(a**4+4*q*q))/2;
    expect(r.gainCrossings[0].omega).toBeCloseTo(Math.sqrt(x),10);expect(num(r.kv)).toBeCloseTo(10/3,13);
    expect(r.performance!.peakOmega).toBeCloseTo(Math.sqrt(q-a*a/2),10);
    const wr=r.performance!.peakOmega;expect(r.performance!.peak).toBeCloseTo(q/Math.sqrt((q-wr*wr)**2+a*a*wr*wr),10);
  });
  it('distinguishes DC maximum from an interior resonance at the threshold',()=>{
    const r=analyze(model(['1','2','2','0','0']));expect(r.performance!.peak).toBe(1);expect(r.performance!.peakOmega).toBe(0);expect(r.performance!.stationary).toHaveLength(0);
    expect(r.performance!.bandwidth).toBeCloseTo(Math.sqrt(2),10);
  });
  it('provides finite lag gain margin and exact boundary/unstable classifications',()=>{
    for(const K of ['1','2','3']){
      const r=analyze(model(['1','1',K,'0','1']));expect(r.phaseCrossings[0].omega).toBeCloseTo(1,12);expect(r.phaseCrossings[0].gm).toBeCloseTo(2/Number(K),12);
      expect(r.state).toBe(K==='1'?'stable':K==='2'?'boundary':'unstable');
      if(K!=='1'){expect(r.performance).toBeUndefined();expect(r.performanceIssue).toContain('undefined as stable performance');}
    }
    expect(()=>at(model(['1','1','2','0','1']),'T',1)).toThrow('singular');
  });
  it('does not round a near boundary rational inequality into exact equality',()=>{
    const below=analyze(model(['1','1','1999999999999999999/1000000000000000000','0','1']));expect(below.state).toBe('stable');expect(below.performance).toBeUndefined();expect(below.performanceIssue).toContain('singular');
    const above=analyze(model(['1','1','2000000000000000001/1000000000000000000','0','1']));expect(above.state).toBe('unstable');
  });
  it('preserves exactly cancelled compensators and rejects near equality reduction',()=>{
    const a=analyze(model()),b=analyze(model(['1','2','4','.5','.5']));expect(b.algebra.p.n).toBe(0n);expect(b.gainCrossings[0].omega).toBeCloseTo(a.gainCrossings[0].omega,12);
    expect(analyze(model(['1','2','4','.500000000001','.5'])).algebra.p.n).not.toBe(0n);
  });
  it('keeps G, L and T distinct, including DC and positive-frequency phase',()=>{
    const m=model(),G=at(m,'G',1),L=at(m,'L',1),T=at(m,'T',1);
    expect(G.re).toBeCloseTo(-.2,14);expect(G.im).toBeCloseTo(-.4,14);expect(L.re).toBeCloseTo(-.8,14);expect(L.im).toBeCloseTo(-1.6,14);
    // T=4/(3+j2)=(12-j8)/13.
    expect(T.re).toBeCloseTo(12/13,14);expect(T.im).toBeCloseTo(-8/13,14);expect(phase(m,'L',1)).toBeCloseTo(-90-Math.atan(.5)*180/Math.PI,13);
    expect(()=>at(m,'G',0)).toThrow('DC');expect(()=>at(m,'L',0)).toThrow('DC');expect(at(m,'T',0)).toEqual({re:1,im:0});
  });
  it('preserves small closed-loop phase at large loop gain and small T at high frequency',()=>{
    const large=at(model(['100','.001','100','0','0']),'T',1e-9);expect(Math.abs(large.im/(-1e-16)-1)).toBeLessThan(1e-12);
    const tiny=at(model(['.001','100','.001','0','0']),'T',1e6),q=1e-6,dr=q-1e12,di=1e8,den=dr*dr+di*di;
    expect(Math.abs(tiny.re/(q*dr/den)-1)).toBeLessThan(1e-12);expect(Math.abs(tiny.im/(-q*di/den)-1)).toBeLessThan(1e-12);
  });
  it('checks all isolated performance candidates by transfer residuals on varied lead/lag models',()=>{
    for(const values of [['.5','3','7','.8','.2'],['3','1','1','.1','2'],['1','5','10','0','.2']]){
      const r=analyze(model(values));for(const c of r.gainCrossings)expect(abs(at(r.model,'L',c.omega))).toBeCloseTo(1,7);
      if(r.performance)for(const w of r.performance.bandwidths)expect(abs(at(r.model,'T',w))).toBeCloseTo(Math.SQRT1_2,7);
    }
  });
});
describe('CF04 input grammar and bounded failures',()=>{
  it('accepts compact fraction buttons and outer signs/groups without mixed-number reinterpretation',()=>{
    for(const s of ['\\frac12','\\frac{1}2','\\frac1{2}','(1/2)','{.5}'])expect(textRat(parseRational(s))).toBe('1/2');
    expect(textRat(parseRational('(-\\frac12)'))).toBe('-1/2');expect(textRat(parseRational('.7071067812'))).toBe('1767766953/2500000000');
    expect(textRat(parseRational('\\left(-\\frac12\\right)'))).toBe('-1/2');
  });
  it.each(['\\frac\\,12','\\frac1\\!2','\\frac\\;12','\\frac 12','\\frac\\left 12','\\frac{1\\,}{2}'])('preserves argument boundaries by rejecting blank tokens in %s',s=>expect(()=>parseRational(s)).toThrow());
  it.each(['2\\frac12','1e-2','1E2','1{+2}','2^12','2^{12}','1+2','\\sqrt2','\\frac{\\frac12}2','','1/0','0.0000000000001','1'.repeat(513)])('rejects unsupported/incomplete %s',s=>expect(()=>parseRational(s)).toThrow());
  it('rejects zero/negative/under-bounded/improper and excessive coefficients',()=>{
    for(const entries of [['0','2','4','0','0'],['1','-2','4','0','0'],['1','2','4','.5','0'],['.0001','2','4','0','0'],['101','2','4','0','0']])expect(()=>model(entries)).toThrow();
    for(const w of [-1,NaN,Infinity,1e7,1e-13])expect(()=>at(model(),'G',w)).toThrow();
  });
});
