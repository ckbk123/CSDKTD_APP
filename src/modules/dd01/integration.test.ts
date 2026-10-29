import { describe, expect, it } from 'vitest';
import { analogStep, discretize, loopAt, readController, simulate, type Complex, type Method } from './math';
import { num, parseRational } from './algebra';
const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const mul = (a: Complex, b: Complex): Complex => ({ re: a.re*b.re-a.im*b.im, im: a.re*b.im+a.im*b.re });
const div = (a: Complex, b: Complex): Complex => { const d=b.re*b.re+b.im*b.im; return {re:(a.re*b.re+a.im*b.im)/d,im:(a.im*b.re-a.re*b.im)/d}; };
const scale = (a: Complex, b: number): Complex => ({ re:a.re*b, im:a.im*b });

describe('DD01 independent integration fixtures', () => {
  it('matches the actual substitution identity at changed complex frequencies', () => {
    const c = readController(['.5', '1.25', '.25', '.75']), T = .125, plantK = 1.5, plantA = .5;
    for (const method of ['forward', 'backward', 'tustin'] as Method[]) for (const prewarp of method === 'tustin' ? [undefined, 2] : [undefined]) {
      const m = discretize(c, { method, T, plantK, plantA, prewarp });
      for (const theta of [.1, .7, 1.8, 3]) {
        const z = { re:Math.cos(theta), im:Math.sin(theta) }, zm1 = add(z,{re:-1,im:0});
        const s = method === 'forward' ? scale(zm1,1/T) : method === 'backward' ? scale(div(zm1,z),1/T) : scale(div(zm1,add(z,{re:1,im:0})),prewarp ? prewarp/Math.tan(prewarp*T/2) : 2/T);
        const controller = div(add(scale(s,.5),{re:1.25,im:0}),add(scale(s,.25),{re:.75,im:0}));
        const ad = Math.exp(-plantA*T), bd = plantK/plantA*(1-ad), expected = mul(controller,div({re:bd,im:0},add(z,{re:-ad,im:0}))), actual = loopAt(m,theta);
        expect(actual.re).toBeCloseTo(expected.re,11); expect(actual.im).toBeCloseTo(expected.im,11);
      }
    }
  });
  it('matches sampled static feedback and its original analog counterpart', () => {
    const T=.125,a=.8,k=.6,g=2,ad=Math.exp(-a*T),bd=k/a*(1-ad),p=ad-bd*g;
    const m=discretize(readController(['0','2','0','1']),{method:'tustin',T,plantK:k,plantA:a}),trace=simulate(m,30),final=k*g/(a+k*g);
    trace.samples.forEach(s=>{expect(s.y).toBeCloseTo(final*(1-p**s.k),12);expect(s.u).toBeCloseTo(g*(1-s.y),12);expect(analogStep(m,s.t)).toBeCloseTo(final*(1-Math.exp(-(a+k*g)*s.t)),12);});
  });
  it('matches independent repeated and separated analog exponentials', () => {
    const settings={method:'backward' as const,T:.1,plantK:1,plantA:1};
    const pi=discretize(readController(['1','1','1','0']),settings), filtered=discretize(readController(['1','0','1','1']),settings), root=Math.sqrt(5);
    for(const t of [.001,.1,1,20]){expect(analogStep(pi,t)).toBeCloseTo(1-Math.exp(-t),12);expect(analogStep(filtered,t)).toBeCloseTo((Math.exp((-3+root)*t/2)-Math.exp((-3-root)*t/2))/root,12);}
  });
  it.each([String.raw`\frac1\;2`, String.raw`\frac\,12`, '\\frac1\u20092', String.raw`\frac1{\left2\;}`])('protects scalar fraction boxes: %s', source=>expect(()=>parseRational(source)).toThrow(/blank space cannot fill a box/));
  it('preserves ordinary and properly braced numeric fractions',()=>{
    for(const source of [String.raw`\frac12`,String.raw`\frac1{\;2}`,String.raw`\left(\frac1{\;2}\right)`])expect(num(parseRational(source))).toBe(.5);
  });
});
