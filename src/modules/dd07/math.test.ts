import { describe, expect, it } from 'vitest';
import { characteristic, currentCorrection, designFeedback, designObserver, simulate, zoh, type Matrix, type Options, type Vector } from './math';
import { parseMatrix, parseScalar, parseTarget } from './parser';
const A: Matrix = [0, 1, -2, -3], B: Vector = [0, 1], C: Vector = [1, 0];
const options: Options = { initial: [1, 0], prior: [0, 0], heldInput: 0, reference: 1, period: .1, steps: 100, timing: 'predictor', noiseAmplitude: 0, noiseFrequency: 20, noisePhase: 0 };
const near = (actual: readonly number[], expected: readonly number[], tolerance = 1e-10) => { expect(actual).toHaveLength(expected.length); actual.forEach((v, i) => expect(Math.abs(v - expected[i])).toBeLessThanOrEqual(tolerance * Math.max(1, Math.abs(expected[i])))); };
const baseline = () => { const model = zoh(A, B, .1); return { ...model, observer: designObserver(model.A, C, [-.7, .12]) }; };
describe('independent sampled observer mathematics', () => {
  it.each([.01, .1, .3, 1])('matches analytic mechanical-plant ZOH at T=%s', T => {
    const p = Math.exp(-T), q = Math.exp(-2 * T), model = zoh(A, B, T);
    near(model.A, [2 * p - q, p - q, -2 * p + 2 * q, -p + 2 * q]); near(model.B, [.5 - p + .5 * q, p - q]);
  });
  it('handles singular continuous A without using inverse(A)', () => {
    const model = zoh([0, 1, 0, 0], [0, 1], .2); near(model.A, [1, .2, 0, 1]); near(model.B, [.02, .2]);
    const zero = zoh([0, 0, 0, 0], [2, -3], .5); near(zero.A, [1, 0, 0, 1]); near(zero.B, [1, -1.5]);
  });
  it('derives baseline matching and checks rounded quoted gain rather than using it as the solver', () => {
    const { A: Ad, observer: o } = baseline(), p = Math.exp(-.1), q = Math.exp(-.2);
    const l1 = p + q - .7, l2 = ((-p + 2 * q) * l1 - (p * q - .12)) / (p - q);
    near(o.L, [l1, l2]); expect(o.L[0]).toBeCloseTo(1.023568, 6); expect(o.L[1]).toBeCloseTo(1.498984, 6);
    near(o.observability, [1, 0, Ad[0], Ad[1]]); near(o.actual, [-.7, .12]); near(o.poles.flat().sort((a,b)=>a-b), [0, 0, .3, .4]);
    const rounded: Matrix = [Ad[0] - 1.023568, Ad[1], Ad[2] - 1.498984, Ad[3]], actual = characteristic(rounded);
    expect(Math.abs(actual[0] + .7)).toBeGreaterThan(1e-8); expect(Math.abs(actual[1] - .12)).toBeGreaterThan(1e-8);
    expect(o.residual).toBeLessThan(1e-12);
  });
  it('keeps the separate rounded CH9 input model and recomputes its targets', () => {
    const o = designObserver([.967, .148, -.297, .522], [1, 3], [-.49, .0468]);
    near(o.L, [-.83745424, .61215141], 1e-8); near(o.actual, [-.49, .0468]);
    near(o.poles.map(p=>p[0]).sort(), [.13, .36]);
  });
  it('checks changed velocity sensor and negative/fraction sensor equivalence', () => {
    const { A: Ad } = baseline(), velocity = designObserver(Ad, [0, 1], [-.7, .12]), half = designObserver(Ad, [-.5, 0], [-.7, .12]), standard = designObserver(Ad, C, [-.7, .12]);
    expect(Math.abs(velocity.scaledDet)).toBeGreaterThan(1e-9); near(velocity.actual, [-.7, .12]); near(half.L, standard.L.map(v=>-2*v)); near(half.closed, standard.closed);
  });
  it.each(([ [0, 0], [-1.2, .36], [-.8, .25], [.3, -.1] ] as Vector[]).map(target=>({target})))('handles deadbeat, repeated, conjugate or signed targets $target', ({target}) => {
    const o = designObserver([.8, .2, 0, .5], C, target); near(o.actual, target); expect(o.poles.every(p=>Math.hypot(...p)<1)).toBe(true);
  });
  it('distinguishes predictor and current correction gain/matrices', () => {
    const o = designObserver([.8, .2, 0, .5], C, [-.3, .02]), current = currentCorrection(o);
    near(o.L, [1, .6]); near(current.M, [.95, 1.2]); near(current.priorMatrix, [-.2, .2, -.6, .5]); near(current.correctedMatrix, [.04, .01, -.96, .26]); near(characteristic(current.correctedMatrix), [-.3, .02]);
    const predictor = simulate(o, [0, 1], { ...options, initial: [1, 2], steps: 2 }), corrected = simulate(o, [0, 1], { ...options, initial: [1, 2], steps: 2, timing: 'current' });
    near(predictor.samples[0].estimate, [0, 0]); near(predictor.samples[1].x, [1.2, 1]); near(predictor.samples[1].estimate, [1, .6]); near(predictor.samples[1].error, [.2, .4]);
    near(corrected.samples[0].estimate, [.95, 1.2]); near(corrected.samples[0].error, [.05, .8]); near(corrected.samples[1].prior, [1, .6]); near(corrected.samples[1].estimate, [1.19, .84]); near(corrected.samples[1].error, [.01, .16]);
  });
  it('checks baseline discrete error trajectories independently by Cayley-Hamilton recurrence', () => {
    const { observer: o, B: Bd } = baseline(), run = simulate(o, Bd, options);
    // Every component obeys e[k+2]=.7 e[k+1]−.12 e[k].
    let previous: Vector = [1, 0], current: Vector = [o.A[0] - o.L[0], o.A[2] - o.L[1]];
    for (let k=1;k<15;k++) { near(run.samples[k].error, current, 1e-10); const next: Vector = [.7*current[0]-.12*previous[0], .7*current[1]-.12*previous[1]]; previous=current;current=next; }
    for (const s of run.samples) near(s.x, [2*Math.exp(-s.t)-Math.exp(-2*s.t), -2*Math.exp(-s.t)+2*Math.exp(-2*s.t)], 1e-10);
  });
  it.each(['predictor','current'] as const)('keeps zero initial error under a known held input (%s)', timing => {
    const { observer:o,B:Bd }=baseline(), run=simulate(o,Bd,{...options,initial:[0,0],heldInput:1,timing});
    for(const s of run.samples){near(s.error,[0,0]);near(s.x,[.5*(1-2*Math.exp(-s.t)+Math.exp(-2*s.t)),Math.exp(-s.t)-Math.exp(-2*s.t)]);}
  });
  it('retains actual four-mode feedback and independently checked step recurrence', () => {
    const Ad: Matrix=[0,1,-.2,.9],Bd:Vector=[0,1], o=designObserver(Ad,C,[-.3,.02]),f=designFeedback(Ad,Bd,C,[-.5,.06]);
    near(f.K,[-.14,.4]);expect(f.prefilter).toBeCloseTo(.56,12);
    for(const timing of ['predictor','current'] as const){const run=simulate(o,Bd,{...options,initial:[0,0],steps:50,timing},f);near(run.samples.slice(0,5).map(s=>s.cleanOutput),[0,0,.56,.84,.9464]);near(run.allPoles.map(p=>p[0]).sort(),[.1,.2,.2,.3]);expect(run.samples[50].cleanOutput).toBeCloseTo(1,10);}
  });
  it('matches quoted sampled feedback independently and redesigns after period edits',()=>{
    const m=zoh(A,B,.1),f=designFeedback(m.A,m.B,C,[-1.5,.56]);near(f.K,[4.956502,2.335770],1e-6);expect(f.prefilter).toBeCloseTo(6.956502,5);
    const changed=zoh(A,B,.2),o=designObserver(changed.A,C,[-.7,.12]);expect(o.L[0]).not.toBeCloseTo(baseline().observer.L[0],4);near(o.actual,[-.7,.12]);
  });
  it('estimates from measurement only and exposes noise read/correct timing',()=>{
    const o=designObserver([.8,.2,0,.5],C,[-.3,.02]);
    const p=simulate(o,[0,1],{...options,initial:[0,0],steps:2,noiseAmplitude:1,noiseFrequency:0,noisePhase:Math.PI/2});
    const c=simulate(o,[0,1],{...options,initial:[0,0],steps:2,noiseAmplitude:1,noiseFrequency:0,noisePhase:Math.PI/2,timing:'current'});
    near(p.samples[0].estimate,[0,0]);near(p.samples[1].estimate,[1,.6]);near(c.samples[0].estimate,[.95,1.2]);
    for(const s of [...p.samples,...c.samples]){near(s.x,[0,0]);expect(s.measuredOutput).toBeCloseTo(1,12);}
  });
  it('preserves state-coordinate invariance with connected feedback and noise',()=>{
    const {A:Ad,B:Bd,observer:o}=baseline(), f=designFeedback(Ad,Bd,C,[-1.5,.56]);
    const As:Matrix=[Ad[0],2/3*Ad[1],3/2*Ad[2],Ad[3]],Bs:Vector=[2*Bd[0],3*Bd[1]],Cs:Vector=[.5,0],os=designObserver(As,Cs,[-.7,.12]),fs=designFeedback(As,Bs,Cs,[-1.5,.56]);
    near(os.L,[2*o.L[0],3*o.L[1]]);near(fs.K,[f.K[0]/2,f.K[1]/3]);
    for(const timing of ['predictor','current'] as const){const r=simulate(o,Bd,{...options,steps:30,timing,noiseAmplitude:.03},f),rs=simulate(os,Bs,{...options,initial:[2,0],steps:30,timing,noiseAmplitude:.03},fs);r.samples.forEach((s,i)=>{expect(s.cleanOutput).toBeCloseTo(rs.samples[i].cleanOutput,10);expect(s.effort).toBeCloseTo(rs.samples[i].effort,9);});}
  });
  it('rejects current conversion for singular Ad without invalidating predictor design',()=>{
    const o=designObserver([0,1,0,.5],C,[-.3,.02]);expect(()=>currentCorrection(o)).toThrow(/singular/);expect(simulate(o,B,{...options,steps:3}).samples).toHaveLength(4);
  });
  it('retains checked K when the sensor DC gain is zero',()=>{const m=zoh(A,B,.1),f=designFeedback(m.A,m.B,[0,1],[-1.5,.56]);expect(f.prefilter).toBeNull();near(f.actual,[-1.5,.56]);});
  it.each(([[1,0,0,.5],[1,1e-12,0,.5]] as Matrix[]).map(Ad=>({Ad})))('rejects rank loss and near loss',({Ad})=>{expect(()=>designObserver(Ad,C,[-.3,.02])).toThrow(/rank/);});
  it.each(([[0,1],[0,-1],[-2,1],[-1.5,.5],[NaN,0]] as Vector[]).map(q=>({q})))('rejects unsupported target $q',({q})=>{expect(()=>designObserver([.8,.2,0,.5],C,q)).toThrow();});
  it('bounds inputs, work, growth and exponential accuracy',()=>{
    expect(()=>zoh(A,B,0)).toThrow(/period/);expect(()=>zoh([1000,0,0,1000],B,10)).toThrow();expect(()=>zoh([-1000,0,0,-1000],B,10)).toThrow(/underflow/);
    expect(()=>designObserver([NaN,1,0,0],C,[0,0])).toThrow(/finite/);expect(()=>designFeedback([.8,.2,0,.5],[0,0],C,[-.3,.02])).toThrow(/rank/);
    const o=designObserver([1.1,.2,0,1.2],C,[-.3,.02]);expect(()=>simulate(o,B,{...options,steps:1000})).toThrow(/magnitude/);
    for(const patch of [{steps:1.5},{steps:1001},{noiseAmplitude:-1},{period:1e-999},{prior:[101,0]}])expect(()=>simulate(o,B,{...options,...patch} as Options)).toThrow();
  });
  it('shows noise aliases at the discrete Nyquist boundary',()=>{const {observer:o,B:Bd}=baseline();expect(simulate(o,Bd,{...options,noiseAmplitude:.1,noiseFrequency:Math.PI/.1}).aliasedNoise).toBe(true);expect(simulate(o,Bd,{...options,noiseAmplitude:0,noiseFrequency:100}).aliasedNoise).toBe(false);});
  it('rejects mixed sampled models rather than combining unrelated gains',()=>{const m=baseline(),f=designFeedback(m.A,m.B,C,[-1.5,.56]);expect(()=>simulate(m.observer,[1,0],options,f)).toThrow(/same sampled/);});
});
describe('visual z notation preserves displayed meaning',()=>{
  it.each([String.raw`\frac1\,2`,String.raw`\frac\,12`,String.raw`\dfrac1\;2`,String.raw`\frac\!12`,String.raw`\frac1\ 2`,String.raw`\frac{\frac1\:2}{2}`])('rejects spacing atoms as unbraced fraction arguments: %s',s=>{
    expect(()=>parseScalar(s)).toThrow(/spacing command/);expect(()=>parseMatrix(`C=\\begin{bmatrix}${s}&0\\end{bmatrix}`,1,2,'C')).toThrow(/spacing command/);
  });
  it.each([String.raw`z^\,2-.7z+.12`,String.raw`z^ \;2-.7z+.12`,String.raw`z^\ 2-.7z+.12`,String.raw`z^2+\frac1\,2z+.12`])('rejects spacing atoms as unbraced target arguments: %s',s=>expect(()=>parseTarget(s)).toThrow(/spacing command/));
  it('retains literal spaces and spacing inside braced arguments',()=>{
    for(const s of [String.raw`\frac 1 2`,String.raw`\frac{1\,}{2}`,String.raw`\frac{\,1}{\;2}`,String.raw`\frac{1}{2\,}`])expect(parseScalar(s)).toBe(.5);
    near(parseTarget(String.raw`z^{\,2}-.7z+.12`),[-.7,.12]);near(parseTarget('z^ 2-.7z+.12'),[-.7,.12]);
  });
  it.each(['(z-.3)(z-.4)','q(z)=z^2-.7z+.12','z^{2}-\\frac7{10}z+\\frac3{25}'])('parses %s',s=>near(parseTarget(s),[-.7,.12]));
  it('accepts signed compact fractions and spaced matrix rows',()=>{expect(parseScalar('-\\frac12')).toBe(-.5);near(parseMatrix(String.raw`A=\begin{bmatrix}0&1\\ -2&-3\end{bmatrix}`,2,2,'A'),A);expect(parseScalar('\\frac{\\frac12}{2}')).toBe(.25);});
  it.each(['z^12','z^02','z^2.0','z^-2','z^{0}2','z^{12}','1e-2z+z²','2\\frac12z+z^2','{z+2}z','z^2+1{+2}','s^2+1','z^3','z^2+\\frac10','z^2+',''])('rejects unsupported/ambiguous %s',s=>expect(()=>parseTarget(s)).toThrow());
  it.each(['2\\frac12','1{+2}','1e-2','\\frac10','\\frac12+1',''])('rejects scalar %s',s=>expect(()=>parseScalar(s)).toThrow());
});
