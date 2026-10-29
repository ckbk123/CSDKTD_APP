import { describe,it,expect } from 'vitest';
import { readController,discretize,zoh,simulate,closedPoles,stability,analogStep,loopAt,margins,magnitude, type Settings } from './math';
import { parseRational,textRat } from './algebra';

const base:Settings={method:'tustin',T:.1,plantK:1,plantA:1};
const lead=readController(['12','32','1','6']);
const make=(values:readonly string[]=['12','32','1','6'],settings:Partial<Settings>={})=>discretize(readController(values),{...base,...settings});
describe('displayed scalar meaning and mathematical domain',()=>{
  it('preserves compact, mixed-brace, signed/grouped fraction meanings',()=>{
    for(const s of ['\\frac12','\\frac{1}2','\\frac1{2}','\\frac{1}{2}','(1/2)','{.5}'])expect(textRat(parseRational(s))).toBe('1/2');
    for(const s of ['-\\frac12','\\frac{-1}2','(-\\frac{1}{2})','\\frac1{-2}'])expect(textRat(parseRational(s))).toBe('-1/2');
  });
  it.each(['','1e-2','1E2','2\\frac12','-2\\frac12','(2\\frac12)','1{+2}','2^{12}','2^12','1+2','2\\times\\frac12','\\sqrt2','\\frac{\\frac12}2','1/0','\\frac1{}','s','0.0000000001','1'.repeat(513)])('rejects unsupported/ambiguous %s',s=>expect(()=>parseRational(s)).toThrow());
  it('validates signs, zero denominator, nonzero range and properness',()=>{
    for(const s of [['-1','1','1','1'],['1','1','0','0'],['0','0','1','1'],['1','0','0','1'],['.0001','1','1','1'],['101','0','1','1']])expect(()=>readController(s)).toThrow();
    expect(readController(['0','1','1','0']).a0.n).toBe(0n);
    expect(()=>readController(['999999999999999/1000000000000000000','1','1','1'])).toThrow();
    expect(()=>parseRational('100000000000000000001/1000000000000000000')).toThrow();
  });
  it('enforces periods, plant bounds and method-specific prewarping',()=>{
    for(const T of [0,.0009,2.1,Infinity,.1000000001])expect(()=>make(undefined,{T})).toThrow();
    expect(()=>make(undefined,{plantK:0})).toThrow();expect(()=>make(undefined,{plantA:101})).toThrow();
    for(const prewarp of [0,NaN,32,1001])expect(()=>make(undefined,{prewarp})).toThrow();
    expect(()=>make(undefined,{method:'forward',prewarp:1})).toThrow();
  });
});
describe('independent substitution and recurrence fixtures',()=>{
  it.each([
    ['tustin',.1,[136n,-104n,13n,-7n]],['tustin',.2,[38n,-22n,4n,-1n]],
    ['forward',.1,[60n,-44n,5n,-2n]],['backward',.1,[76n,-60n,8n,-5n]],
  ] as const)('%s T=%s derives primitive course coefficients', (method,T,expected)=>{
    const m=make(undefined,{method,T});expect(m.primitive).toEqual(expected);
    expect((m.n1+m.n0)/(m.d1+m.d0)).toBeCloseTo(16/3,12);
  });
  it('derives current and previous error gains independently',()=>{
    const m=make();expect(m.alpha).toBeCloseTo(7/13,14);expect(m.beta0).toBeCloseTo(136/13,14);expect(m.beta1).toBe(-8);
    const errors=[1,1,0],outputs:number[]=[];let oldE=0,oldU=0;
    for(const e of errors){const u=m.alpha*oldU+m.beta0*e+m.beta1*oldE;outputs.push(u);oldE=e;oldU=u;}
    expect(outputs).toEqual([136/13,expect.closeTo(136*7/169+32/13,12),expect.closeTo((136*7/169+32/13)*7/13-8,12)]);
  });
  it('maps PI integration rules with correct present/previous indexing',()=>{
    const c=['1','2','1','0'];
    expect(make(c,{method:'forward'})).toMatchObject({alpha:1,beta0:1,beta1:-.8});
    expect(make(c,{method:'backward'})).toMatchObject({alpha:1,beta0:1.2,beta1:-1});
    expect(make(c)).toMatchObject({alpha:1,beta0:1.1,beta1:-.9});
  });
  it('retains a derivative filter and finite Nyquist gain',()=>{
    const m=make(['1','0','.05','1']);expect(m.primitive).toEqual([10n,-10n,1n,0n]);
    expect(m.alpha).toBe(0);expect(m.beta0).toBe(10);expect(m.beta1).toBe(-10);
    // C(e^jπ)=20; Gd(-1)=-Bd/(1+Ad).
    expect(loopAt(m,Math.PI).re).toBeCloseTo(-20*zoh(m).bd/(1+zoh(m).ad),13);
  });
  it('reduces only exact static cancellations before realizing histories',()=>{
    for(const method of ['forward','backward','tustin'] as const){const m=make(['2','4','1','2'],{method});expect(m.staticGain).toBe(2);expect(m.alpha).toBe(0);expect(m.beta1).toBe(0);expect(closedPoles(m)).toHaveLength(1);}
    expect(make(['2','4.000000001','1','2']).staticGain).toBeUndefined();
    expect(make(['0','4','0','2'],{method:'forward'}).staticGain).toBe(2);
  });
  it('prewarps at the requested physical frequency rather than using 2/T',()=>{
    const omega=5,m=make(undefined,{prewarp:omega}),z=loopAt(m,omega*base.T);
    const {ad,bd}=zoh(m),theta=omega*base.T,gr=bd*(Math.cos(theta)-ad),gi=-bd*Math.sin(theta),den=(Math.cos(theta)-ad)**2+Math.sin(theta)**2;
    // Analog C(j5)=(32+j60)/(6+j5)=(492+j200)/61.
    expect(z.re).toBeCloseTo(((492/61)*gr-(200/61)*gi)/den,11);
    expect(z.im).toBeCloseTo(((492/61)*gi+(200/61)*gr)/den,11);expect(m.exact).toBeUndefined();
  });
  it('pure API validates forged inputs as well as edited fields',()=>expect(()=>discretize({...lead,b0:parseRational('-1')},base)).toThrow());
});
describe('actual sampled loop and independent continuous reference',()=>{
  it('uses exact first-order ZOH and sample-before-hold timing',()=>{
    const m=make(),{ad,bd}=zoh(m),s=simulate(m,20);
    expect(ad).toBeCloseTo(.9048374180359595,15);expect(bd).toBeCloseTo(.09516258196404043,15);
    expect(s.samples[0]).toMatchObject({k:0,y:0,e:1,u:136/13,oldU:0,oldE:0});
    const y1=bd*136/13,u1=(7/13)*(136/13)+(136/13)*(1-y1)-8;
    expect(s.samples[1].y).toBeCloseTo(y1,14);expect(s.samples[1].u).toBeCloseTo(u1,13);
    expect(s.samples[2].y).toBeCloseTo(ad*y1+bd*u1,13);
    expect(s.held[4].y).toBeCloseTo((1-Math.exp(-.05))*136/13,14);
  });
  it('recovers analytic closed-loop poles and eventual DC value',()=>{
    const m=make(),{ad,bd}=zoh(m),p=closedPoles(m);
    // Monic denominator z²+(-7/13-Ad+136Bd/13)z+(7Ad/13-8Bd).
    const b=-7/13-ad+136*bd/13,c=7*ad/13-8*bd;
    for(const z of p){expect(z.im).toBe(0);expect(z.re*z.re+b*z.re+c).toBeCloseTo(0,13);}
    expect(stability(m)).toBe('stable');expect(simulate(m,500).samples.at(-1)!.y).toBeCloseTo(16/19,12);
    // Analog denominator s²+19s+38; final=16/19; y'(0)=12.
    expect(analogStep(m,0)).toBe(0);expect(analogStep(m,1e-8)/1e-8).toBeCloseTo(12,5);
    const r1=(-19+Math.sqrt(209))/2,r2=(-19-Math.sqrt(209))/2,final=16/19,c1=(12+final*r2)/(r1-r2);
    expect(analogStep(m,1)).toBeCloseTo(final+c1*Math.exp(r1)+(-final-c1)*Math.exp(r2),13);
  });
  it('matches scalar static-feedback closed form at every sample',()=>{
    const m=make(['0','2','0','1']),{ad,bd}=zoh(m),p=ad-2*bd,s=simulate(m,40);
    for(const row of s.samples)expect(row.y).toBeCloseTo(2*bd*(1-p**row.k)/(1-p),12);
    expect(analogStep(m,1)).toBeCloseTo(2/3*(1-Math.exp(-3)),13);
  });
  it('checks repeated and underdamped analog roots against analytic references',()=>{
    const repeated=make(['1','1','1','0']),oscillating=make(['0','1','1','0']);
    for(const t of [0,1e-8,.01,1,10]){
      expect(analogStep(repeated,t)).toBeCloseTo(-Math.expm1(-t),12);
      expect(analogStep(oscillating,t)).toBeCloseTo(1-Math.exp(-t/2)*(Math.cos(Math.sqrt(3)*t/2)+Math.sin(Math.sqrt(3)*t/2)/Math.sqrt(3)),12);
    }
  });
  it('reveals unstable emulation and safely truncates a growing trace',()=>{
    const m=make(undefined,{method:'forward',T:.5});expect(stability(m)).toBe('unstable');
    const s=simulate(m,500);expect(s.stopped).toContain('10¹²');expect(s.samples.length).toBeLessThan(500);expect(s.samples.length).toBeGreaterThan(5);
  });
  it('distinguishes the numerical unit-circle boundary',()=>{
    const T=.1,ad=Math.exp(-T),bd=1-ad,g=(1+ad)/bd;
    const m=make(['0',g.toFixed(9),'0','1']);expect(Math.abs(closedPoles(m)[0].re+1)).toBeLessThan(1e-10);expect(stability(m)).toBe('boundary');
  });
  it('bounds simulation counts and analog times',()=>{
    for(const n of [19,501,20.5,NaN])expect(()=>simulate(make(),n)).toThrow();expect(()=>analogStep(make(),-1)).toThrow();
  });
});
describe('actual unit-circle margins from algebraic crossings',()=>{
  it('gives independently derived static-controller gain and phase margins',()=>{
    const m=make(['0','2','0','1']),{ad,bd}=zoh(m),r=margins(m);
    // |2Bd/(e^jθ-Ad)|=1 => cosθ=(1+Ad²-4Bd²)/(2Ad).
    const theta=Math.acos((1+ad*ad-4*bd*bd)/(2*ad)),phase=-Math.atan2(Math.sin(theta),Math.cos(theta)-ad)*180/Math.PI;
    expect(r.qualified).toBe(true);expect(r.gainCrossings).toHaveLength(1);
    expect(r.gainCrossings[0].theta).toBeCloseTo(theta,13);expect(r.gainCrossings[0].margin).toBeCloseTo(180+phase,10);
    expect(r.phaseCrossings).toHaveLength(1);expect(r.phaseCrossings[0].omega).toBeCloseTo(Math.PI/.1,12);
    expect(r.phaseCrossings[0].margin).toBeCloseTo((1+ad)/(2*bd),12);
  });
  it('validates all reported course-loop crossings against direct z substitution',()=>{
    for(const method of ['forward','backward','tustin'] as const)for(const T of [.01,.1,.5]){
      const m=make(undefined,{method,T}),r=margins(m),{ad,bd}=zoh(m);
      for(const x of [...r.gainCrossings,...r.phaseCrossings]){
        const ct=Math.cos(x.theta),st=Math.sin(x.theta),nr=m.n1*ct+m.n0,ni=m.n1*st,dr=m.d1*ct+m.d0,di=m.d1*st;
        const rden=dr*(ct-ad)-di*st,iden=dr*st+di*(ct-ad),den=rden*rden+iden*iden;
        const real=bd*(nr*rden+ni*iden)/den,imag=bd*(ni*rden-nr*iden)/den,actual=loopAt(m,x.theta);
        expect(actual.re).toBeCloseTo(real,8);expect(actual.im).toBeCloseTo(imag,8);
        if(r.gainCrossings.includes(x))expect(Math.hypot(real,imag)).toBeCloseTo(1,7);else{expect(real).toBeLessThan(0);expect(Math.abs(imag)).toBeLessThan(1e-7);}
      }
    }
  });
  it('handles no unity crossing, PI DC pole and Nyquist pole explicitly',()=>{
    expect(margins(make(['0','.1','0','1'])).gainCrossings).toHaveLength(0);
    expect(margins(make(['1','1','1','0'])).notes.join()).toContain('DC is an open-loop pole');
    expect(margins(make(['1','1','1','20'],{method:'forward'})).notes.join()).toContain('Nyquist is an open-loop pole');
    expect(()=>loopAt(make(),NaN)).toThrow();expect(()=>loopAt(make(),4)).toThrow();
  });
  it('captures a near-Nyquist gain crossing without a sampled frequency search',()=>{
    const m=make(['1','0','.05','1'],{plantK:1.001});const r=margins(m);
    for(const x of r.gainCrossings)expect(magnitude(loopAt(m,x.theta))).toBeCloseTo(1,8);
    expect(r.gainCrossings.length).toBeGreaterThan(0);
  });
  it('reports both band-pass unity crossings for a filtered derivative',()=>{
    const m=make(['1','0','.05','1'],{T:.01,plantK:1.1}),r=margins(m);expect(r.gainCrossings).toHaveLength(2);
    for(const x of r.gainCrossings)expect(magnitude(loopAt(m,x.theta))).toBeCloseTo(1,9);
    expect(magnitude(loopAt(m,Math.PI))).toBeLessThan(1);expect(magnitude(loopAt(m,0))).toBe(0);
  });
});
