import { fraction } from './format';
import { trim, type Polynomial } from './parser';
import { add, compare, div, mul, neg, rational, sub, toNumber, ONE, ZERO, type Rational } from './rational';

export type Location = 'inside' | 'outside' | 'boundary';
export interface Root {
  readonly re: number; readonly im: number; readonly multiplicity: 1 | 2;
  readonly location: Location; readonly exact: string; readonly nearCircle: boolean;
}
export interface RootCount { readonly degree: number; readonly inside: number; readonly outside: number; readonly boundary: number; readonly roots: readonly Root[] }
const two = rational(2n), four = rational(4n);
const sign = (v: Rational): number => v.n < 0n ? -1 : v.n ? 1 : 0;
/** Sign(sqrt(delta)-s), decided without a rounded square root. */
function radicalCompare(delta: Rational, s: Rational): number {
  if (s.n < 0n) return 1;
  if (!s.n) return sign(delta);
  return compare(delta, mul(s, s));
}
function integerRoot(n: bigint): bigint | undefined {
  if (n < 0n) return undefined;
  if (n < 2n) return n;
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) { const next = (x + n / x) / 2n; if (next >= x) return x * x === n ? x : undefined; x = next; }
}
function exactRoot(value: Rational): Rational | undefined {
  const n = integerRoot(value.n), d = integerRoot(value.d);
  return n === undefined || d === undefined ? undefined : rational(n, d);
}
function realLocation(lower: number, upper: number): Location { return !lower || !upper ? 'boundary' : lower > 0 && upper < 0 ? 'inside' : 'outside'; }
/** Multiplicities and locations are exact for rational coefficients, not tolerance tests. */
export function countRoots(coefficients: Polynomial): RootCount {
  const p = trim(coefficients), degree = p.length - 1;
  if (degree > 2) throw new Error('Root accounting supports polynomials of degree at most two.');
  if (!p.some(c => c.n)) throw new Error('The zero polynomial has no finite isolated root count.');
  const a = p.at(-1)!, c = div(p[0], a), b = degree === 2 ? div(p[1], a) : ZERO;
  const roots: Root[] = [];
  function record(re: number, im: number, multiplicity: 1 | 2, location: Location, exact: string): void {
    if (!Number.isFinite(re) || !Number.isFinite(im)) throw new Error('A root exceeds the finite numerical display range. Rescale the model.');
    roots.push({ re, im, multiplicity, location, exact, nearCircle: location !== 'boundary' && Math.abs(Math.hypot(re, im) - 1) < 1e-8 });
  }
  if (degree === 1) {
    const r = neg(c); record(toNumber(r, true), 0, 1, realLocation(compare(r, neg(ONE)), compare(r, ONE)), fraction(r));
  } else if (degree === 2) {
    const delta = sub(mul(b, b), mul(four, c)), center = div(neg(b), two);
    if (!delta.n) record(toNumber(center, true), 0, 2, realLocation(compare(center, neg(ONE)), compare(center, ONE)), fraction(center));
    else if (delta.n < 0n) {
      const radiusSquared = c, radiusSign = compare(radiusSquared, ONE), location = radiusSign < 0 ? 'inside' : radiusSign > 0 ? 'outside' : 'boundary';
      const re = toNumber(center, true), im = Math.sqrt(toNumber(neg(delta), true)) / 2;
      for (const s of [1, -1]) record(re, s * im, 1, location, `${fraction(center)}${s > 0 ? '+' : '-'}\\frac{\\sqrt{${fraction(neg(delta))}}}{2}\\mathrm{j}`);
    } else {
      const sqrt = Math.sqrt(toNumber(delta, true)), bn = toNumber(b, true), cn = toNumber(c, true);
      // The large root is evaluated without cancellation; the product supplies the small root.
      const large = -.5 * (bn + (bn < 0 ? -sqrt : sqrt)), other = large ? cn / large : 0;
      const exactSqrt = exactRoot(delta);
      for (const branch of [1, -1]) {
        const cmp = (at: Rational): number => { const s = add(mul(two, at), b); return branch > 0 ? radicalCompare(delta, s) : -radicalCompare(delta, neg(s)); };
        const re = branch > 0 ? bn < 0 ? large : other : bn < 0 ? other : large;
        const exact = exactSqrt ? fraction(div(add(neg(b), branch > 0 ? exactSqrt : neg(exactSqrt)), two)) : `\\frac{${fraction(neg(b))}${branch > 0 ? '+' : '-'}\\sqrt{${fraction(delta)}}}{2}`;
        record(re, 0, 1, realLocation(cmp(neg(ONE)), cmp(ONE)), exact);
      }
    }
  }
  const amount = (location: Location): number => roots.filter(r => r.location === location).reduce((sum, r) => sum + r.multiplicity, 0);
  return { degree, roots, inside: amount('inside'), outside: amount('outside'), boundary: amount('boundary') };
}
