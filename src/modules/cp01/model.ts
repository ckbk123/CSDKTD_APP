import { parsePolynomial, trim, type Polynomial } from './parser';
import { add, compare, decimal, div, mul, ONE, rational, sub, toNumber, ZERO, type Rational } from './rational';

export interface Model {
  readonly order: 1 | 2;
  readonly denominator: Polynomial; readonly numerator: Polynomial;
  readonly b: readonly Rational[]; readonly parallel: Rational; readonly direct: Rational;
  readonly a0: Rational; readonly a1: Rational; readonly alpha: Rational; readonly delta: Rational;
  readonly behavior: 'stable' | 'integrator' | 'double-integrator' | 'oscillator' | 'unstable';
}
export type InputKind = 'step' | 'ramp' | 'impulse' | 'pulse' | 'free';
export interface Excitation { readonly kind: InputKind; readonly amplitude: Rational; readonly width: Rational }
export function bounded(value: Rational, low: string, high: string, label: string): void {
  if (compare(value, decimal(low)) < 0 || compare(value, decimal(high)) > 0) throw new Error(`${label} must be between ${low} and ${high}.`);
  toNumber(value);
}
function coefficient(value: Rational, maximum: string, label: string): void {
  bounded(value, '-' + maximum, maximum, label);
  if (value.d > 1_000_000_000n) throw new Error(`${label} exceeds the normalized rational denominator budget of 10⁹. Use simpler coefficients.`);
}
export function makeModel(numerator: Polynomial, denominator: Polynomial, parallel: Rational = ZERO): Model {
  const d = trim(denominator), n = trim(numerator), order = d.length - 1;
  if (order < 1 || order > 2) throw new Error('Use a nonzero first- or second-order denominator. A pure direct path can use numerator 0 with a parallel direct gain.');
  if (n.length > d.length) throw new Error('The model must be proper: numerator degree cannot exceed denominator degree. Ideal differentiation can contain distributions and is unsupported by this ordinary state realization.');
  const leading = d.at(-1)!;
  const normalizedD = d.map(value => div(value, leading)), normalizedN = n.map(value => div(value, leading));
  const quotient = normalizedN[order] ?? ZERO;
  const b = Array.from({ length: order }, (_, i) => sub(normalizedN[i] ?? ZERO, mul(quotient, normalizedD[i])));
  const a0 = normalizedD[0], a1 = order === 2 ? normalizedD[1] : ZERO, direct = add(parallel, quotient);
  coefficient(a0, '100', 'Normalized constant denominator coefficient');
  coefficient(a1, '20', 'Normalized linear denominator coefficient');
  b.forEach((value, i) => coefficient(value, '50', `Dynamic numerator coefficient b${i}`));
  coefficient(parallel, '10', 'Parallel direct gain'); coefficient(direct, '10', 'Resulting direct gain');
  const alpha = order === 2 ? div(a1, rational(2n)) : a0;
  const delta = order === 2 ? sub(mul(alpha, alpha), a0) : ZERO;
  const behavior: Model['behavior'] = order === 1 ? a0.n > 0n ? 'stable' : a0.n ? 'unstable' : 'integrator'
    : a0.n > 0n && a1.n > 0n ? 'stable'
      : a0.n < 0n || a1.n < 0n ? 'unstable'
        : !a0.n ? a1.n ? 'integrator' : 'double-integrator' : 'oscillator';
  return { order: order as 1 | 2, denominator: normalizedD, numerator: normalizedN, b, parallel, direct, a0, a1, alpha, delta, behavior };
}
export function modelFromText(numerator = '1', denominator = '(s+1)(s+2)', parallel: Rational = ZERO): Model {
  return makeModel(parsePolynomial(numerator), parsePolynomial(denominator), parallel);
}
export function excitation(kind: InputKind, amplitude: Rational = ONE, width: Rational = decimal('.1')): Excitation {
  if (!['step', 'ramp', 'impulse', 'pulse', 'free'].includes(kind)) throw new Error('Choose a supported input shape.');
  bounded(amplitude, '-10', '10', 'Input amplitude or area');
  if (kind === 'pulse') bounded(width, '.001', '10', 'Pulse width in seconds');
  return { kind, amplitude, width };
}
export function initialState(model: Model, values: readonly Rational[]): readonly Rational[] {
  if (values.length !== model.order) throw new Error(`This realization needs ${model.order} initial phase state${model.order === 1 ? '' : 's'}.`);
  values.forEach((value, i) => bounded(value, '-10', '10', `Initial phase state x${i + 1}`)); return [...values];
}
/** Centered coordinates z=[w,w'+alpha*w], without changing the physical state. */
export function centeredInitial(model: Model, x: readonly Rational[]): readonly Rational[] {
  initialState(model, x); return model.order === 1 ? [...x] : [x[0], add(x[1], mul(model.alpha, x[0]))];
}
export function phaseInitial(model: Model, z: readonly Rational[]): readonly Rational[] {
  if (z.length !== model.order) throw new Error('The coordinate dimension must match the model.');
  return initialState(model, model.order === 1 ? [...z] : [z[0], sub(z[1], mul(model.alpha, z[0]))]);
}
export function initialTransformNumerator(model: Model, x: readonly Rational[]): Polynomial {
  initialState(model, x);
  if (model.order === 1) return [mul(model.b[0], x[0])];
  // C(sI-A)^(-1)x0; no particular input is used to define G(s).
  return [add(mul(sub(mul(model.b[0], model.a1), mul(model.b[1], model.a0)), x[0]), mul(model.b[0], x[1])),
    add(mul(model.b[0], x[0]), mul(model.b[1], x[1]))];
}
export function stateMatrix(model: Model, centered = false): number[][] {
  if (model.order === 1) return [[-toNumber(model.a0)]];
  if (centered) return [[-toNumber(model.alpha), 1], [toNumber(model.delta, true), -toNumber(model.alpha)]];
  return [[0, 1], [-toNumber(model.a0), -toNumber(model.a1)]];
}
export function outputCoefficients(model: Model, centered = false): readonly Rational[] {
  return centered && model.order === 2 ? [sub(model.b[0], mul(model.alpha, model.b[1])), model.b[1]] : model.b;
}
