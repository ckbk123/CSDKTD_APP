/** Exact scalar coefficients, with a bounded integer representation. */
export interface Q { readonly n: bigint; readonly d: bigint }
const abs = (n: bigint) => n < 0n ? -n : n;
export function q(n: bigint | number, d: bigint | number = 1n): Q {
  let a = BigInt(n), b = BigInt(d);
  if (b === 0n) throw new Error('A fraction denominator cannot be zero.');
  if (abs(a).toString(2).length > 4096 || abs(b).toString(2).length > 4096) throw new Error('The exact fraction calculation exceeds its size bound. Simplify the coefficients.');
  if (b < 0n) { a = -a; b = -b; }
  let x = abs(a), y = b;
  while (y) [x, y] = [y, x % y];
  a /= x; b /= x;
  if (abs(a).toString(2).length > 2048 || b.toString(2).length > 2048) throw new Error('The reduced exact fraction exceeds 2048 bits. Simplify the coefficients.');
  return { n: a, d: b };
}
export const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const neg = (a: Q) => q(-a.n, a.d);
export const sub = (a: Q, b: Q) => add(a, neg(b));
export const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
export const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
export const equal = (a: Q, b: Q) => a.n === b.n && a.d === b.d;
export function number(a: Q): number {
  if (a.n === 0n) return 0;
  const n = abs(a.n).toString(), d = a.d.toString(), nl = Math.min(16, n.length), dl = Math.min(16, d.length);
  const value = (a.n < 0n ? -1 : 1) * Number(n.slice(0, nl)) / Number(d.slice(0, dl)) * 10 ** (n.length - nl - d.length + dl);
  if (!Number.isFinite(value) || value === 0) throw new Error('A nonzero exact value cannot be represented by the numerical view. Rescale the input.');
  return value;
}
export function decimal(text: string, native = false): Q {
  const m = (native ? /^([+-]?)(\d*(?:\.\d*)?)(?:[eE]([+-]?\d+))?$/ : /^([+-]?)(\d*(?:\.\d*)?)$/).exec(text);
  if (!m || !/\d/.test(m[2])) throw new Error('Use a finite decimal or fraction coefficient.');
  const digits = m[2].replace('.', '');
  if (digits.length > 24) throw new Error('Keep a decimal coefficient within 24 digits.');
  const n = BigInt(digits), sign = m[1] === '-' ? -1n : 1n;
  if (n === 0n) return q(0);
  const exponent = Number(m[3] ?? 0) - (m[2].split('.')[1]?.length ?? 0);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 48) throw new Error('Keep decimal scaling within 48 powers of ten.');
  return exponent >= 0 ? q(sign * n * 10n ** BigInt(exponent)) : q(sign * n, 10n ** BigInt(-exponent));
}

/** Polynomial arrays are ascending: [constant, z, z²]. No tolerance snapping. */
export type Poly = Q[];
export function trim(p: Poly): Poly {
  const r = p.slice();
  while (r.length > 1 && r.at(-1)!.n === 0n) r.pop();
  return r.length ? r : [q(0)];
}
export const zero = (p: Poly) => p.every(a => a.n === 0n);
export function plus(a: Poly, b: Poly): Poly {
  return trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => add(a[i] ?? q(0), b[i] ?? q(0))));
}
export const scale = (a: Poly, b: Q) => trim(a.map(c => mul(c, b)));
export function times(a: Poly, b: Poly): Poly {
  if (a.length + b.length > 10) throw new Error('An intermediate polynomial exceeds degree eight.');
  const result = Array.from({ length: a.length + b.length - 1 }, () => q(0));
  a.forEach((x, i) => b.forEach((y, j) => { result[i + j] = add(result[i + j], mul(x, y)); }));
  return trim(result);
}
export function at(a: Poly, x: Q): Q { return a.reduceRight((v, c) => add(mul(v, x), c), q(0)); }
export function divide(a: Poly, b: Poly): { quotient: Poly; remainder: Poly } {
  if (zero(b)) throw new Error('A polynomial divisor cannot be zero.');
  let remainder = trim(a);
  const quotient = Array.from({ length: Math.max(1, a.length - b.length + 1) }, () => q(0));
  for (let step = 0; !zero(remainder) && remainder.length >= b.length; step++) {
    if (step > 8) throw new Error('Polynomial division exceeded its degree bound.');
    const offset = remainder.length - b.length, factor = div(remainder.at(-1)!, b.at(-1)!);
    quotient[offset] = factor;
    const term = [...Array.from({ length: offset }, () => q(0)), ...scale(b, neg(factor))];
    remainder = plus(remainder, term);
  }
  return { quotient: trim(quotient), remainder };
}
export function cancel(a: Poly, b: Poly): { numerator: Poly; denominator: Poly } {
  let x = trim(a), y = trim(b);
  for (let i = 0; !zero(y); i++) {
    if (i > 8) throw new Error('Exact scalar cancellation exceeded its degree bound.');
    [x, y] = [y, divide(x, y).remainder];
  }
  return { numerator: divide(a, x).quotient, denominator: divide(b, x).quotient };
}
export function factorsAtOne(p: Poly): { order: number; coefficient: Q; remainder: Poly } {
  if (zero(p)) return { order: Infinity, coefficient: q(0), remainder: [q(0)] };
  let r = trim(p), order = 0;
  while (r.length > 1 && at(r, q(1)).n === 0n) { r = divide(r, [q(-1), q(1)]).quotient; order++; }
  return { order, coefficient: at(r, q(1)), remainder: r };
}
