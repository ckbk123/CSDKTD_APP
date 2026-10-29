import { parsePolynomial, plus, scale, trim, type Polynomial } from './parser';
import { countRoots, type RootCount } from './roots';
import { compare, decimal, div, mul, neg, sub, toNumber, ONE, ZERO, type Rational } from './rational';

export interface Model {
  readonly order: number; readonly numerator: Polynomial; readonly rawNumerator: Polynomial; readonly denominator: Polynomial; readonly closed: Polynomial;
  readonly gain: Rational; readonly period: Rational; readonly direct: Rational; readonly wellPosed: Rational;
  readonly openRoots: RootCount; readonly closedRoots: RootCount; readonly common: Polynomial; readonly cancelledRoots: RootCount;
}
function divide(a: Polynomial, b: Polynomial): Rational[] {
  let remainder = trim(a); const divisor = trim(b);
  while (remainder.length >= divisor.length && remainder.some(c => c.n)) {
    const shift = remainder.length - divisor.length, ratio = div(remainder.at(-1)!, divisor.at(-1)!);
    remainder = trim(remainder.map((c, i) => i < shift ? c : sub(c, mul(ratio, divisor[i - shift] ?? ZERO))));
  }
  return remainder;
}
export function commonFactor(a: Polynomial, b: Polynomial): Rational[] {
  let left = trim(a), right = trim(b), rounds = 0;
  while (right.some(c => c.n)) { if (++rounds > 4) throw new Error('Polynomial reduction exceeded its bounded degree budget.'); const r = divide(left, right); left = right; right = r; }
  return left.some(c => c.n) ? left.map(c => div(c, left.at(-1)!)) : [ONE];
}
export function bounded(value: Rational, minimum: string, maximum: string, label: string): void {
  if (compare(value, decimal(minimum)) < 0 || compare(value, decimal(maximum)) > 0) throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  toNumber(value);
}
function coefficient(value: Rational, label: string): void {
  bounded(value, '-20', '20', label);
  if (value.d > 1_000_000_000n) throw new Error(`${label} exceeds the normalized fraction denominator budget of 10⁹. Use simpler coefficients.`);
}
export function makeModel(numerator: Polynomial, denominator: Polynomial, gain: Rational = ONE, period: Rational = decimal('.1')): Model {
  const d = trim(denominator), n = trim(numerator), order = d.length - 1;
  if (!d.some(c => c.n)) throw new Error('The denominator must be a nonzero polynomial.');
  if (order > 2 || n.length > d.length) throw new Error('Use a proper real loop with numerator degree no greater than denominator degree, at most two.');
  bounded(gain, '-10', '10', 'Loop gain K'); bounded(period, '.001', '10', 'Sample period T in seconds');
  if (gain.d > 1_000_000_000n) throw new Error('Loop gain K exceeds the exact fraction denominator budget of 10⁹.');
  const leading = d.at(-1)!, normalizedD = d.map(c => div(c, leading)), normalizedN = n.map(c => div(c, leading));
  normalizedD.forEach(c => coefficient(c, 'Normalized denominator coefficient')); normalizedN.forEach(c => coefficient(c, 'Normalized numerator coefficient'));
  const scaledN = scale(normalizedN, gain), direct = scaledN[order] ?? ZERO, wellPosed = plus([ONE], [direct])[0];
  if (!wellPosed.n) throw new Error('The direct feedback loop is singular: 1 + K d = 0. Its retained closed-loop state equation is not well posed; dropping the leading coefficient would hide this.');
  const closed = plus(normalizedD, scaledN), common = commonFactor(normalizedD, scaledN);
  return { order, numerator: scaledN, rawNumerator: normalizedN, denominator: normalizedD, closed, gain, period, direct, wellPosed,
    openRoots: countRoots(normalizedD), closedRoots: countRoots(closed), common, cancelledRoots: countRoots(common) };
}
export function modelFromText(numerator = '.5', denominator = 'z-.8', gain: Rational = ONE, period: Rational = decimal('.1')): Model {
  return makeModel(parsePolynomial(numerator), parsePolynomial(denominator), gain, period);
}
export const magnitude = (value: Rational): Rational => value.n < 0n ? neg(value) : value;
