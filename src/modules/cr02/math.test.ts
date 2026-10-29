import { describe, expect, it } from 'vitest';
import { BASELINE, dcGain, equations, initialPolynomial, odeLatex, parseOde, poles, responseAt, responseSamples, warnings, type Experiment } from './math';

const step: Experiment = { initial: { y: 0, v: 0 }, excitation: 'step', amplitude: 1 };
function close(actual: number, expected: number, relative = 2e-9): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(relative * Math.max(1, Math.abs(expected)));
}
describe('CR02 bounded visual ODE entry', () => {
  it.each(["y''+3y'+2y=u", String.raw`y^{\prime\prime}+3y^{\prime}+2y=u`, String.raw`\ddot{y}+3\dot{y}+2y=u`, "1*y''+3*y'+2*y=1*u+0*u'"])( 'reads equivalent prime/dot forms: %s', text => {
    expect(parseOde(text)).toEqual(BASELINE);
  });
  it('accepts compact and mixed numeric coefficient fractions', () => {
    for (const coefficient of ['\\frac12', '\\frac1{2}', '\\frac{1}2', '\\frac{1}{2}']) expect(parseOde(`${coefficient}y''+3y'+2y=u`)).toEqual({ ...BASELINE, m: .5 });
    expect(parseOde("2y''+5y'+3y=u'+4u")).toEqual({ m: 2, c: 5, k: 3, b: 4, d: 1 });
  });
  it('round trips physical coefficient edits without rounding model input', () => {
    const model = { m: .123456789012345, c: 1e-9, k: 1000, b: -.333333333333333, d: 0 };
    expect(parseOde(odeLatex(model))).toEqual(model);
    expect(parseOde("y''+y'+2y'+y+y=u+u")).toEqual({ ...BASELINE, b: 2 });
  });
  it.each(['', '0=u', "y''+3y'+2y=", "y''+3y'+2y=s", "y''+3y'+2y=u''", "y''+3y'+y*y=u", "-y''+3y'+2y=u", "y''-3y'+2y=u", "y''+3y'-2y=u", "y''+3y'+2y=sin(u)", "y''+3y'+2y=NaN*u", "\\frac10y''+3y'+2y=u", "1e-9999y''+3y'+2y=u", "y''+3y'+2y=0.0000000001u", 'y'.repeat(601)])('rejects unsupported/invalid ODE %s', text => {
    expect(() => parseOde(text)).toThrow();
  });
});

describe('CR02 independent response and Laplace fixtures', () => {
  it('baseline step response agrees with partial fractions at changed times', () => {
    for (const t of [0, .01, .1, .5, 1, 2, 10, 30]) {
      const result = responseAt(BASELINE, step, t);
      close(result.total, .5 - Math.exp(-t) + .5 * Math.exp(-2 * t));
      close(result.velocity, Math.exp(-t) - Math.exp(-2 * t));
      expect(result.free).toBe(0);
    }
    expect(poles(BASELINE).roots.map(p => p.re).sort()).toEqual([-1, -2]);
    expect(dcGain(BASELINE)).toEqual({ kind: 'finite', value: .5, cancellation: false });
  });
  it('worksheet mass normalization gives poles -1,-1.5 and DC gain 1/3', () => {
    const model = parseOde("2y''+5y'+3y=u");
    expect(poles(model).roots.map(p => p.re).sort()).toEqual([-1, -1.5]);
    expect(dcGain(model)).toEqual({ kind: 'finite', value: 1/3, cancellation: false });
    for (const t of [0, .2, 1, 3, 10]) close(responseAt(model, step, t).total, 1/3 - Math.exp(-t) + 2/3 * Math.exp(-1.5 * t));
    expect(equations(model, { y: 0, v: 0 }).normalized).toBe("y''+2.5y'+1.5y=0.5u");
  });
  it('nonzero displacement produces the independently derived free response and leaves G unchanged', () => {
    const initial = { y: 1, v: 0 }, before = equations(BASELINE, { y: 0, v: 0 }).transfer;
    expect(initialPolynomial(BASELINE, initial)).toEqual([1, 3]);
    expect(equations(BASELINE, initial).transfer).toBe(before);
    for (const t of [0, .1, 1, 2, 7]) {
      const result = responseAt(BASELINE, { ...step, initial }, t);
      close(result.free, 2 * Math.exp(-t) - Math.exp(-2*t));
      close(result.total, .5 + Math.exp(-t) - .5 * Math.exp(-2*t));
      close(result.total, result.free + result.forced);
    }
  });
  it('nonzero initial velocity contributes m v0 in Laplace and correct homogeneous motion', () => {
    const initial = { y: 2, v: -3 };
    expect(initialPolynomial({ ...BASELINE, m: 2 }, initial)).toEqual([4, 0]);
    // y=exp(-t)+exp(-2t) has y0=2, v0=-3.
    for (const t of [0, .3, 1, 4]) close(responseAt(BASELINE, {initial,excitation:'zero',amplitude:0}, t).total, Math.exp(-t)+Math.exp(-2*t));
  });
  it('critical and undamped cases match repeated-pole and trigonometric formulas', () => {
    for (const t of [0, .1, 1, 3, 12]) {
      close(responseAt({ ...BASELINE, c: 2, k: 1 }, step, t).total, 1 - (1+t) * Math.exp(-t));
      close(responseAt({ ...BASELINE, c: 0, k: 4 }, step, t).total, (1-Math.cos(2*t))/4);
    }
    expect(poles({ ...BASELINE, c: 2, k: 1 }).roots).toEqual([{re:-1,im:0},{re:-1,im:0}]);
    expect(poles({ ...BASELINE, c: 0, k: 4 }).roots).toEqual([{re:-0,im:2},{re:-0,im:-2}]);
  });
  it('singular stiffness and the free mass work without an inverse of A', () => {
    for (const t of [0, .1, 1, 10, 60]) {
      close(responseAt({ ...BASELINE, c: 2, k: 0 }, step, t).total, t/2 - (1-Math.exp(-2*t))/4);
      close(responseAt({ ...BASELINE, m: 2, c: 0, k: 0 }, step, t).total, t*t/4);
    }
  });
  it('input derivative is the same scalar input and gives the correct step velocity jump', () => {
    const model = { ...BASELINE, b: 4, d: 1 };
    const initial = responseAt(model, step, 0);
    expect(initial.total).toBe(0); expect(initial.velocity).toBe(1);
    for (const t of [0, .1, 1, 5]) {
      close(responseAt(model, step, t).total, 2-3*Math.exp(-t)+Math.exp(-2*t));
      close(responseAt(model, {...step,excitation:'ramp'},t).total, 2*t-2.5+3*Math.exp(-t)-.5*Math.exp(-2*t));
    }
    expect(equations(model,{y:0,v:0}).state).toContain('\\begin{bmatrix}1\\\\1\\end{bmatrix}u');
  });
  it('free-mass ramp with input derivative has the independently integrated cubic', () => {
    const model = { m: 2, c: 0, k: 0, b: 3, d: 4 }, experiment: Experiment = {initial:{y:1,v:2},excitation:'ramp',amplitude:2};
    for (const t of [0, .5, 2, 10]) {
      const result = responseAt(model,experiment,t);
      close(result.total, 1+2*t+2*t*t+.5*t*t*t);
      close(result.velocity, 2+4*t+1.5*t*t);
    }
  });
  it('stiff damping and maximum horizon remain checked against an elementary solution', () => {
    const model = { m: .01, c: 1000, k: 0, b: 1, d: 0 };
    for (const t of [0, .001, 1, 60]) close(responseAt(model,step,t).total, t/1000 - .01/(1000**2)*(1-Math.exp(-100000*t)), 1e-7);
    const maximum = responseAt({m:.01,c:0,k:0,b:1000,d:1000},{...step,excitation:'ramp',amplitude:100},60);
    close(maximum.total, 1e7*60**2/2 + 1e7*60**3/6, 1e-7);
  });
  it('finite DC limits after a true zero factor are explicit while original poles remain', () => {
    const model = {m:1,c:2,k:0,b:0,d:4};
    expect(dcGain(model)).toEqual({kind:'finite',value:2,cancellation:true});
    expect(poles(model).roots.some(p=>p.re===0)).toBe(true);
    expect(dcGain({...model,b:1}).kind).toBe('no-finite-limit');
    expect(dcGain({...model,c:0,d:0})).toEqual({kind:'finite',value:0,cancellation:true});
  });
  it('samples are bounded and warnings distinguish horizon and spacing limitations', () => {
    const samples = responseSamples(BASELINE,step,2,5);
    expect(samples.map(s=>s.t)).toEqual([0,.5,1,1.5,2]);
    close(samples[2].total,.5-Math.exp(-1)+.5*Math.exp(-2));
    expect(warnings(BASELINE,1,301).join()).toContain('horizon');
    expect(warnings({...BASELINE,c:0,k:1000},60,2).join()).toContain('spacing');
    expect(warnings({...BASELINE,k:0},60,301).join()).toContain('zero real part');
  });
  it('rejects invalid experiment and computational resource requests', () => {
    expect(()=>responseAt(BASELINE,{...step,amplitude:Infinity},1)).toThrow(/finite/);
    expect(()=>responseAt(BASELINE,{...step,initial:{y:101,v:0}},1)).toThrow(/100/);
    expect(()=>responseAt(BASELINE,step,-1)).toThrow(/time/);
    expect(()=>responseAt(BASELINE,step,61)).toThrow(/time/);
    expect(()=>responseSamples(BASELINE,step,0)).toThrow(/horizon/);
    expect(()=>responseSamples(BASELINE,step,1,1002)).toThrow(/samples/);
  });
});
