/** Private exact scalar algebra. Polynomial arrays run from constant to highest power. */
export type Q = Readonly<{ n: bigint; d: bigint }>;
export type Poly = readonly Q[];
export type TF = Readonly<{ n: Poly; d: Poly }>;

const magnitude = (a: bigint) => a < 0n ? -a : a;
const bits = (a: bigint) => magnitude(a).toString(2).length;
function integerGcd(a: bigint, b: bigint): bigint {
  a = magnitude(a); b = magnitude(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
export function q(n: bigint | number, d: bigint | number = 1): Q {
  if (typeof n === 'number' && !Number.isSafeInteger(n) || typeof d === 'number' && !Number.isSafeInteger(d)) throw new Error('Exact coefficients require finite integers.');
  let a = BigInt(n), b = BigInt(d);
  if (!b) throw new Error('Division by zero is undefined.');
  if (bits(a) > 4096 || bits(b) > 4096) throw new Error('Exact arithmetic exceeds 4096 bits. Simplify the diagram or coefficients.');
  const common = integerGcd(a, b); a /= common; b /= common;
  return Object.freeze(b < 0n ? { n: -a, d: -b } : { n: a, d: b });
}
export const Z = q(0), U = q(1);
export const negQ = (a: Q): Q => q(-a.n, a.d);
export const addQ = (a: Q, b: Q): Q => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const subQ = (a: Q, b: Q): Q => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const mulQ = (a: Q, b: Q): Q => q(a.n * b.n, a.d * b.d);
export const divQ = (a: Q, b: Q): Q => q(a.n * b.d, a.d * b.n);
export const equalQ = (a: Q, b: Q): boolean => a.n === b.n && a.d === b.d;
export const textQ = (a: Q): string => a.d === 1n ? String(a.n) : `${a.n}/${a.d}`;
export const latexQ = (a: Q): string => a.d === 1n ? String(a.n) : `${a.n < 0n ? '-' : ''}\\frac{${magnitude(a.n)}}{${a.d}}`;

export function trim(a: Poly): Poly {
  let length = a.length;
  while (length && !a[length - 1].n) length--;
  if (length > 25) throw new Error('Exact polynomial work exceeds degree 24. Simplify the diagram.');
  return length ? a.slice(0, length) : [Z];
}
export const zeroP = (a: Poly): boolean => a.every(c => !c.n);
export const degree = (a: Poly): number => zeroP(a) ? -1 : trim(a).length - 1;
export function addP(a: Poly, b: Poly, subtract = false): Poly {
  return trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => subtract ? subQ(a[i] ?? Z, b[i] ?? Z) : addQ(a[i] ?? Z, b[i] ?? Z)));
}
export const scaleP = (a: Poly, k: Q): Poly => trim(a.map(v => mulQ(v, k)));
export function mulP(a: Poly, b: Poly): Poly {
  if (zeroP(a) || zeroP(b)) return [Z];
  if (a.length + b.length - 2 > 24) throw new Error('Exact polynomial work exceeds degree 24. Simplify the diagram.');
  const out = Array<Q>(a.length + b.length - 1).fill(Z);
  a.forEach((v, i) => b.forEach((w, j) => { out[i + j] = addQ(out[i + j], mulQ(v, w)); }));
  return trim(out);
}
export function divideP(a: Poly, b: Poly): { quotient: Poly; remainder: Poly } {
  const divisor = trim(b); if (zeroP(divisor)) throw new Error('Division by the zero polynomial is undefined.');
  let remainder = trim(a);
  const quotient = Array<Q>(Math.max(1, remainder.length - divisor.length + 1)).fill(Z);
  for (let pass = 0; degree(remainder) >= degree(divisor); pass++) {
    if (pass > 24) throw new Error('Polynomial division exceeded its bounded work.');
    const shift = remainder.length - divisor.length, factor = divQ(remainder[remainder.length - 1], divisor[divisor.length - 1]);
    quotient[shift] = factor;
    const before = degree(remainder);
    remainder = addP(remainder, [...Array<Q>(shift).fill(Z), ...scaleP(divisor, factor)], true);
    if (degree(remainder) >= before) throw new Error('Exact polynomial division failed to decrease degree.');
  }
  return { quotient: trim(quotient), remainder };
}
export function gcdP(a: Poly, b: Poly): Poly {
  let x = trim(a), y = trim(b);
  for (let pass = 0; !zeroP(y); pass++) {
    if (pass > 25) throw new Error('Polynomial reduction exceeded its bounded work.');
    [x, y] = [y, divideP(x, y).remainder];
  }
  return zeroP(x) ? [U] : scaleP(x, divQ(U, x[x.length - 1]));
}
export function tf(numerator: Poly, denominator: Poly = [U]): TF {
  const n = trim(numerator), d = trim(denominator);
  if (zeroP(d)) throw new Error('A transfer denominator cannot be zero.');
  if (zeroP(n)) return Object.freeze({ n: [Z], d: [U] });
  const common = gcdP(n, d), rn = divideP(n, common).quotient, rd = divideP(d, common).quotient;
  if (degree(rn) > 12 || degree(rd) > 12) throw new Error('A reduced transfer exceeds degree 12. Simplify the diagram.');
  const leading = divQ(U, rd[rd.length - 1]);
  return Object.freeze({ n: scaleP(rn, leading), d: scaleP(rd, leading) });
}
export const ZERO = tf([Z]), ONE = tf([U]);
export const zeroTF = (a: TF): boolean => zeroP(a.n);
export const constant = (a: Q): TF => tf([a]);
export const negTF = (a: TF): TF => tf(scaleP(a.n, q(-1)), a.d);
export const addTF = (a: TF, b: TF): TF => tf(addP(mulP(a.n, b.d), mulP(b.n, a.d)), mulP(a.d, b.d));
export const subTF = (a: TF, b: TF): TF => tf(addP(mulP(a.n, b.d), mulP(b.n, a.d), true), mulP(a.d, b.d));
export const mulTF = (a: TF, b: TF): TF => tf(mulP(a.n, b.n), mulP(a.d, b.d));
export function divTF(a: TF, b: TF): TF {
  if (zeroTF(b)) throw new Error('Cannot divide by a zero transfer or invert a zero block.');
  return tf(mulP(a.n, b.d), mulP(a.d, b.n));
}
export function equalTF(a: TF, b: TF): boolean {
  return a.n.length === b.n.length && a.d.length === b.d.length && a.n.every((v, i) => equalQ(v, b.n[i])) && a.d.every((v, i) => equalQ(v, b.d[i]));
}
export function evaluateP(a: Poly, at: Q): Q {
  return a.reduceRight((value, coefficient) => addQ(mulQ(value, at), coefficient), Z);
}
export const evaluateTF = (a: TF, at: Q): Q => divQ(evaluateP(a.n, at), evaluateP(a.d, at));
export function latexP(a: Poly): string {
  if (zeroP(a)) return '0';
  return a.map((value, power) => {
    if (!value.n) return '';
    const abs = q(magnitude(value.n), value.d), coefficient = power && equalQ(abs, U) ? '' : latexQ(abs);
    return `${value.n < 0n ? '-' : '+'}${coefficient}${power ? power === 1 ? 's' : `s^{${power}}` : ''}`;
  }).filter(Boolean).reverse().join('').replace(/^\+/, '');
}
export const latexTF = (a: TF): string => a.d.length === 1 ? latexP(a.n) : `\\frac{${latexP(a.n)}}{${latexP(a.d)}}`;
