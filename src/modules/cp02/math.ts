import { add, div, equal, mul, neg, num, one, parseRational, rat, reduceFraction, roots, sub, zero, type Polynomial, type Rational, type Root } from './algebra';
export interface Model { readonly a1: Rational; readonly a0: Rational; readonly b1: Rational; readonly b0: Rational }
export interface Analysis {
  readonly denominator: Polynomial; readonly numerator: Polynomial; readonly reducedDenominator: Polynomial; readonly reducedNumerator: Polynomial; readonly common: Polynomial;
  readonly poles: Root[]; readonly reducedPoles: Root[]; readonly zero?: Rational; readonly kind: 'real' | 'repeated' | 'conjugate';
  readonly internal: 'asymptotically stable' | 'bounded, not asymptotic' | 'unstable'; readonly bibo: boolean;
}
export function baseline(): Model { return { a1: rat(2n), a0: rat(4n), b1: zero, b0: rat(4n) }; }
export function parseModel(a1: string, a0: string, b1: string, b0: string): Model {
  const model = { a1: parseRational(a1), a0: parseRational(a0), b1: parseRational(b1), b0: parseRational(b0) }; inspect(model); return model;
}
function componentBound(value: number, name: string): void {
  if (!Number.isFinite(value) || Math.abs(value) > 10 + 1e-10 || (value !== 0 && Math.abs(value) < 0.001 - 1e-12)) throw new Error(`${name}: use zero or a component with magnitude 0.001–10 s⁻¹.`);
}
export function inspect(model: Model): Analysis {
  for (const value of Object.values(model)) if (value.d <= 0n || value.d > 1000000000000000000n || Math.abs(num(value)) > 100) throw new Error('Use coefficients of magnitude at most 100 and rational denominators at most 10¹⁸.');
  if (Math.abs(num(model.a1)) > 20) throw new Error('Use |a₁| ≤20.');
  const denominator = [model.a0, model.a1, one], numerator = model.b1.n ? [model.b0, model.b1] : [model.b0], poles = roots(denominator);
  poles.forEach(p => { componentBound(p.re, 'Pole real part'); componentBound(p.im, 'Pole imaginary part'); if (Math.hypot(p.re, p.im) > 10 + 1e-10) throw new Error('Pole magnitude must be at most 10 s⁻¹.'); });
  if (poles.length === 2 && Math.hypot(poles[0].re - poles[1].re, poles[0].im - poles[1].im) < 1e-6) throw new Error('Distinct poles are too close for reliable modal weights. Use an exact repeated-root form or separate them.');
  const finiteZero = model.b1.n ? neg(div(model.b0, model.b1)) : undefined;
  if (finiteZero) componentBound(num(finiteZero), 'Finite zero');
  const reduced = reduceFraction(numerator, denominator), reducedPoles = roots(reduced.denominator);
  const internal = model.a1.n > 0n && model.a0.n > 0n ? 'asymptotically stable' : (model.a0.n === 0n && model.a1.n > 0n) || (model.a1.n === 0n && model.a0.n > 0n) ? 'bounded, not asymptotic' : 'unstable';
  const rd = reduced.denominator, bibo = rd.length === 1 || (rd.length === 2 ? rd[0].n * rd[1].n > 0n : rd[0].n > 0n && rd[1].n > 0n);
  return { denominator, numerator, reducedDenominator: reduced.denominator, reducedNumerator: reduced.numerator, common: reduced.common, poles, reducedPoles,
    zero: finiteZero, kind: poles.some(p => p.im !== 0) ? 'conjugate' : poles[0].multiplicity === 2 ? 'repeated' : 'real', internal, bibo };
}
export interface Term { readonly name: string; readonly coefficient: number; readonly rate: number; readonly frequency: number; readonly power: number; readonly wave: 'cos' | 'sin' }
interface ModalTerms { readonly terms: readonly Term[]; readonly form: 'zero' | 'first' | 'conjugate' | 'real' | 'single-zero' | 'repeated' | 'double-zero'; readonly values: readonly number[] }
export interface StepSolution extends ModalTerms { readonly coefficients: readonly [number, number, number, number] }
const term = (name: string, coefficient: number, rate = 0, frequency = 0, power = 0, wave: Term['wave'] = 'cos'): Term => ({ name, coefficient, rate, frequency, power, wave });
export function decompose(model: Model): StepSolution {
  return { ...decomposeModes(model), coefficients: [num(model.a1), num(model.a0), num(model.b1), num(model.b0)] };
}
function decomposeModes(model: Model): ModalTerms {
  const a = inspect(model), denominator = a.reducedDenominator, numerator = a.reducedNumerator;
  if (denominator.length === 1) return { form: 'zero', values: [], terms: [] };
  const b0 = num(numerator[0]), b1 = numerator[1] ? num(numerator[1]) : 0;
  if (denominator.length === 2) {
    const p = a.reducedPoles[0].re, gain = b0 / num(denominator[1]);
    return p === 0 ? { form: 'first', values: [p, gain], terms: [term('Integrator term', gain, 0, 0, 1)] }
      : { form: 'first', values: [p, gain], terms: [term('Constant particular term', -gain / p), term('Visible exponential', gain / p, p)] };
  }
  if (a.zero && a.common.length === 1 && a.poles.some(p => p.im === 0 && Math.abs(p.re - num(a.zero!)) < 1e-9 * Math.max(1, Math.abs(p.re)))) {
    throw new Error('The uncanceled pole and zero are too close for reliable numerical modal weights. Exact algebra retains both; separate them for a trace.');
  }
  const a0 = num(denominator[0]);
  if (a.reducedPoles.some(p => p.im !== 0)) {
    const p = a.reducedPoles[0], w = Math.abs(p.im), constant = b0 / a0, cosine = -constant, sine = (b1 + p.re * constant) / w;
    return { form: 'conjugate', values: [p.re, w, constant, sine], terms: [term('Constant particular term', constant), term('Cosine mode', cosine, p.re, w), term('Sine mode', sine, p.re, w, 0, 'sin')] };
  }
  if (a.reducedPoles[0].multiplicity === 2) {
    const p = a.reducedPoles[0].re;
    if (p === 0) return { form: 'double-zero', values: [b1, b0], terms: [term('Linear step term', b1, 0, 0, 1), term('Quadratic step term', b0 / 2, 0, 0, 2)] };
    const constant = b0 / (p * p), generalized = b1 + b0 / p;
    return { form: 'repeated', values: [p, constant, generalized], terms: [term('Constant particular term', constant), term('Ordinary exponential', -constant, p), term('Generalized t·exp mode', generalized, p, 0, 1)] };
  }
  const [p, q] = a.reducedPoles.map(root => root.re);
  if (p === 0 || q === 0) {
    const r = p === 0 ? q : p, slope = -b0 / r, weight = (b1 + b0 / r) / r;
    return { form: 'single-zero', values: [r, slope, weight], terms: [term('Linear particular term', slope, 0, 0, 1), term('Constant particular term', -weight), term('Nonzero-pole exponential', weight, r)] };
  }
  const cp = (b1 * p + b0) / (p * (p - q)), cq = (b1 * q + b0) / (q * (q - p));
  return { form: 'real', values: [p, q, cp, cq], terms: [term('Constant particular term', b0 / a0), term('First exponential', cp, p), term('Second exponential', cq, q)] };
}
function time(t: number, rates: readonly number[]): void {
  if (!Number.isFinite(t) || t < 0 || t > 20) throw new Error('Use time from 0 to 20 s.');
  if (rates.some(rate => rate * t > 40)) throw new Error('Shorten the horizon to keep exponential growth within exp(40).');
}
export function termAt(t: number, value: Term): number {
  time(t, [value.rate]); return value.coefficient * t ** value.power * Math.exp(value.rate * t) * (value.wave === 'sin' ? Math.sin(value.frequency * t) : Math.cos(value.frequency * t));
}
export function stepAt(solution: StepSolution, t: number): number {
  time(t, solution.terms.map(value => value.rate)); const v = solution.values;
  const [a1, a0, b1, b0] = solution.coefficients;
  if (t * Math.max(1, Math.abs(a1), Math.sqrt(Math.abs(a0))) < 0.05) {
    // Local ODE series: y(0)=0, y′(0)=b1, y″(0)=b0−a1*b1,
    // y⁽ⁿ⁾=−a1*y⁽ⁿ⁻¹⁾−a0*y⁽ⁿ⁻²⁾. Avoid subtracting nearly equal residues.
    let previous = b1 * t, before = 0, value = previous;
    for (let n = 2; n <= 24; n++) {
      const current = n === 2 ? (b0 - a1 * b1) * t * t / 2 : -a1 * t * previous / n - a0 * t * t * before / (n * (n - 1));
      value += current; before = previous; previous = current;
    }
    return value;
  }
  switch (solution.form) {
    case 'zero': return 0;
    case 'first': return v[0] === 0 ? v[1] * t : v[1] / v[0] * Math.expm1(v[0] * t);
    case 'conjugate': {
      const [rate, w, constant, sine] = v, angle = w * t;
      return constant * (-Math.expm1(rate * t) * Math.cos(angle) + 2 * Math.sin(angle / 2) ** 2) + sine * Math.exp(rate * t) * Math.sin(angle);
    }
    case 'real': return v[2] * Math.expm1(v[0] * t) + v[3] * Math.expm1(v[1] * t);
    case 'single-zero': return v[1] * t + v[2] * Math.expm1(v[0] * t);
    case 'repeated': return -v[1] * Math.expm1(v[0] * t) + v[2] * t * Math.exp(v[0] * t);
    case 'double-zero': return v[0] * t + v[1] * t * t / 2;
  }
}
export function modeAt(root: Root, generalized: boolean, t: number): number { time(t, [root.re]); return (generalized ? t : 1) * Math.exp(root.re * t) * Math.cos(root.im * t); }
export function sameDenominator(a: Model, b: Model): boolean { return equal(a.a0, b.a0) && equal(a.a1, b.a1); }
export function initialDescription(model: Model): string {
  const first = num(model.b1), curvature = num(sub(model.b0, mul(model.a1, model.b1)));
  return first > 0 ? 'Starts upward with positive slope.' : first < 0 ? 'Starts downward with negative slope.' : curvature > 0 ? 'Starts upward with a horizontal tangent.' : curvature < 0 ? 'Starts downward with a horizontal tangent.' : 'The zero-state output is identically zero.';
}
function coordinate(value: number, label: string): Rational { componentBound(value, label); return parseRational(value.toFixed(9)); }
export function movePole(model: Model, selected: number, real: number, imaginary: number): Model {
  const a = inspect(model), r = coordinate(real, 'Pole real part'), i = coordinate(imaginary, 'Pole imaginary part');
  let a0: Rational, a1: Rational;
  if (i.n || a.kind === 'conjugate') { a0 = add(mul(r, r), mul(i, i)); a1 = neg(mul(rat(2n), r)); }
  else { const other = a.poles.length === 1 ? a.poles[0].re : a.poles[selected === 0 ? 1 : 0].re, q = coordinate(other, 'Other pole'); a0 = mul(r, q); a1 = neg(add(r, q)); }
  const candidate = { ...model, a0, a1 }; inspect(candidate); return candidate;
}
export function moveZero(model: Model, location: number, preserveDc: boolean): Model {
  const z = coordinate(location, 'Zero location'); let candidate: Model;
  if (preserveDc) {
    if (!z.n || !model.a0.n || !model.b0.n) throw new Error('DC preservation needs a nonzero finite DC gain and nonzero zero location. Disable it to place an origin zero.');
    candidate = { ...model, b1: neg(div(model.b0, z)) };
  } else { const gain = model.b1.n ? model.b1 : one; candidate = { ...model, b1: gain, b0: neg(mul(gain, z)) }; }
  inspect(candidate); return candidate;
}
