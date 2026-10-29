import { plus, scale, trim, type Polynomial } from './parser';
import { add, compare, div, mul, neg, ONE, rational, sub, toNumber, ZERO, type Rational } from './rational';

export { plus, scale, trim, type Polynomial } from './parser';
export const degree = (p: Polynomial): number => trim(p).length - 1;
export const zero = (p: Polynomial): boolean => p.every(c => !c.n);
export const minus = (a: Polynomial, b: Polynomial): Rational[] => plus(a, scale(b, neg(ONE)));
export function product(a: Polynomial, b: Polynomial): Rational[] {
  const result = Array.from({ length: a.length + b.length - 1 }, () => ZERO);
  a.forEach((v, i) => b.forEach((w, j) => { result[i + j] = add(result[i + j], mul(v, w)); }));
  return trim(result);
}
export const derivative = (p: Polynomial): Rational[] => p.length > 1 ? trim(p.slice(1).map((c, i) => mul(c, rational(BigInt(i + 1))))) : [ZERO];
export const monic = (p: Polynomial): Rational[] => { const t = trim(p); if (zero(t)) throw new Error('The zero polynomial has no leading coefficient.'); return scale(t, div(ONE, t.at(-1)!)); };
export function divide(a: Polynomial, b: Polynomial): { quotient: Rational[]; remainder: Rational[] } {
  const divisor = trim(b); if (zero(divisor)) throw new Error('Cannot divide by the zero polynomial.');
  let remainder = trim(a);
  const quotient = Array.from({ length: Math.max(1, remainder.length - divisor.length + 1) }, () => ZERO);
  while (!zero(remainder) && remainder.length >= divisor.length) {
    const shift = remainder.length - divisor.length, coefficient = div(remainder.at(-1)!, divisor.at(-1)!);
    quotient[shift] = add(quotient[shift], coefficient);
    remainder = minus(remainder, [...Array.from({ length: shift }, () => ZERO), ...scale(divisor, coefficient)]);
  }
  return { quotient: trim(quotient), remainder };
}
export function quotient(a: Polynomial, b: Polynomial): Rational[] {
  const result = divide(a, b); if (!zero(result.remainder)) throw new Error('An expected exact polynomial identity failed.'); return result.quotient;
}
export function gcd(a: Polynomial, b: Polynomial): Rational[] {
  let first = trim(a), second = trim(b), work = 0;
  while (!zero(second)) { if (++work > 12) throw new Error('Polynomial factor work exceeded its bound.'); [first, second] = [second, divide(first, second).remainder]; }
  return zero(first) ? [ONE] : monic(first);
}
export function evaluateExact(p: Polynomial, x: Rational): Rational { let result = ZERO; for (let i = p.length - 1; i >= 0; i--) result = add(mul(result, x), p[i]); return result; }
export function numeric(p: Polynomial): number[] { return p.map(c => toNumber(c)); }

export interface RealZero { readonly value: number; readonly lower: Rational; readonly upper: Rational; readonly exact?: Rational }
/** Sturm isolation of distinct real roots. Rational signs establish counts; values are numerical interval midpoints. */
export function realZeros(p: Polynomial): RealZero[] {
  if (zero(p)) throw new Error('An identically zero equation has a family of solutions, not isolated roots.');
  if (degree(p) > 4) throw new Error('Real-root isolation supports degree at most four.');
  if (!degree(p)) return [];
  const squareFree = monic(quotient(p, gcd(p, derivative(p))));
  const sequence: Rational[][] = [squareFree, derivative(squareFree)];
  while (degree(sequence.at(-1)!) > 0) {
    const remainder = divide(sequence.at(-2)!, sequence.at(-1)!).remainder;
    if (zero(remainder)) break;
    // Only positive scaling preserves Sturm signs.
    const max = remainder.reduce((a, b) => compare(mul(b, b), mul(a, a)) > 0 ? b : a, ZERO);
    sequence.push(scale(remainder, div(neg(ONE), max.n < 0n ? neg(max) : max)));
  }
  const variations = (x: Rational): number => {
    let previous = 0, changes = 0;
    for (const row of sequence) { const value = evaluateExact(row, x).n, sign = value < 0n ? -1 : value > 0n ? 1 : 0; if (sign) { if (previous && previous !== sign) changes++; previous = sign; } }
    return changes;
  };
  const coefficients = numeric(squareFree);
  const bound = Math.ceil(2 + Math.max(...coefficients.slice(0, -1).map(Math.abs)));
  if (!Number.isSafeInteger(bound) || bound > 1e6) throw new Error('Real-root isolation needs a root bound below 10⁶. Rescale the model.');
  const start = rational(BigInt(-bound)), end = rational(BigInt(bound));
  const pending = [{ lower: start, upper: end, count: variations(start) - variations(end), depth: 0 }];
  const roots: RealZero[] = []; let work = 0;
  while (pending.length) {
    if (++work > 1024) throw new Error('Real-root isolation exceeded 1024 interval checks. The roots are too close to separate.');
    const { lower, upper, count, depth } = pending.pop()!; if (!count) continue;
    const middle = div(add(lower, upper), rational(2n)), x = toNumber(middle, true);
    if (count === 1 && !evaluateExact(squareFree, middle).n) { roots.push({ value: x, lower: middle, upper: middle, exact: middle }); continue; }
    if (count === 1 && toNumber(sub(upper, lower), true) <= 2e-13 * Math.max(1, Math.abs(x))) { roots.push({ value: x, lower, upper }); continue; }
    if (depth >= 100) throw new Error('Real roots could not be separated within 100 bisections.');
    const leftCount = variations(lower) - variations(middle);
    pending.push({ lower: middle, upper, count: count - leftCount, depth: depth + 1 }, { lower, upper: middle, count: leftCount, depth: depth + 1 });
  }
  return roots.sort((a, b) => a.value - b.value);
}
