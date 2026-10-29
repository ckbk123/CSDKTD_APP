/** Exact low-degree algebra on the binary numeric entries used by the
 * simulation. This is not an exact-decimal parser or a general CAS.
 * Degree≤2; every rational numerator/denominator is bounded to 8192 bits. */
interface Q { n: bigint; d: bigint }
export interface MatrixModel { A: number[][]; B: number[]; C: number[]; D: number }
export interface Transfer { numerator: number[]; denominator: number[]; reducedNumerator: number[]; reducedDenominator: number[]; cancellations: number }
const zero: Q = { n: 0n, d: 1n }, one: Q = { n: 1n, d: 1n };
const abs = (n: bigint): bigint => n < 0n ? -n : n;
const fail = (): never => { throw new Error('The exact channel algebra exceeds its 8192-bit or numeric coefficient range (nonzero magnitudes 10⁻³⁰⁰–10³⁰⁰). Rescale the matrix entries.'); };
function gcd(a: bigint, b: bigint): bigint { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a; }
function q(n: bigint, d = 1n): Q {
  if (!d) return fail();
  if (!n) return zero;
  if (abs(n).toString(2).length > 8192 || abs(d).toString(2).length > 8192) return fail();
  const g = gcd(n, d), sign = d < 0n ? -1n : 1n; return { n: sign * n / g, d: sign * d / g };
}
const add = (a: Q, b: Q): Q => q(a.n * b.d + b.n * a.d, a.d * b.d);
const neg = (a: Q): Q => ({ n: -a.n, d: a.d });
const sub = (a: Q, b: Q): Q => add(a, neg(b));
const mul = (a: Q, b: Q): Q => q(a.n * b.n, a.d * b.d);
const div = (a: Q, b: Q): Q => q(a.n * b.d, a.d * b.n);
const sum = (...values: Q[]): Q => values.reduce(add, zero);

/** IEEE-754 decomposition, with no decimal stringify/round-trip. */
function fromNumber(value: number): Q {
  if (!Number.isFinite(value)) return fail();
  if (value === 0) return zero;
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value, false);
  const bits = view.getBigUint64(0, false), sign = bits >> 63n ? -1n : 1n;
  const exponent = Number((bits >> 52n) & 2047n), fraction = bits & ((1n << 52n) - 1n);
  const mantissa = exponent === 0 ? fraction : (1n << 52n) + fraction;
  const power = exponent === 0 ? -1074 : exponent - 1023 - 52;
  return power >= 0 ? q(sign * (mantissa << BigInt(power))) : q(sign * mantissa, 1n << BigInt(-power));
}
function toNumber(value: Q): number {
  if (!value.n) return 0;
  const n = abs(value.n), nShift = Math.max(0, n.toString(2).length - 60), dShift = Math.max(0, value.d.toString(2).length - 60);
  const ratio = Number(n >> BigInt(nShift)) / Number(value.d >> BigInt(dShift)), exponent = nShift - dShift;
  const magnitude = exponent < -1022 ? ratio * 2 ** -1022 * 2 ** (exponent + 1022) : ratio * 2 ** exponent;
  if (!Number.isFinite(magnitude) || magnitude < 1e-300 || magnitude > 1e300) return fail();
  return value.n < 0n ? -magnitude : magnitude;
}
const trim = (p: Q[]): Q[] => { while (p.length > 1 && !p[0].n) p.shift(); return p; };
function dividePolynomial(a: Q[], b: Q[]): { quotient: Q[]; remainder: Q[] } {
  a = trim([...a]); b = trim([...b]);
  if (b.every(v => !v.n) || a.length > 3 || b.length > 3) return fail();
  const initial = a.length - b.length, quotient = Array(Math.max(1, initial + 1)).fill(zero) as Q[];
  let steps = 0;
  while (a.length >= b.length && a.some(v => v.n)) {
    if (++steps > 3) return fail();
    const degree = a.length - b.length, factor = div(a[0], b[0]);
    quotient[initial - degree] = factor;
    a = trim(a.map((v, i) => i < b.length ? sub(v, mul(factor, b[i])) : v));
  }
  return { quotient: trim(quotient), remainder: a };
}
function polynomialGcd(a: Q[], b: Q[]): Q[] {
  a = trim([...a]); b = trim([...b]); let steps = 0;
  while (b.some(v => v.n)) {
    if (++steps > 4) return fail();
    [a, b] = [b, dividePolynomial(a, b).remainder];
  }
  const leading = a[0]; return a.map(v => div(v, leading));
}
function raw(m: MatrixModel): { a: Q[]; b: Q[]; discriminant: Q; trace: Q } {
  const A = m.A.map(row => row.map(fromNumber)), B = m.B.map(fromNumber), C = m.C.map(fromNumber), D = fromNumber(m.D);
  if (A.length === 1) return { a: [one, neg(A[0][0])], b: [D, sub(mul(C[0], B[0]), mul(D, A[0][0]))], discriminant: zero, trace: A[0][0] };
  const [[a, b], [c, d]] = A, trace = add(a, d), determinant = sub(mul(a, d), mul(b, c));
  const denominator = [one, neg(trace), determinant];
  return {
    a: denominator,
    b: [D, sum(mul(D, denominator[1]), mul(C[0], B[0]), mul(C[1], B[1])),
      sum(mul(D, determinant), neg(mul(mul(C[0], d), B[0])), mul(mul(C[0], b), B[1]), mul(mul(C[1], c), B[0]), neg(mul(mul(C[1], a), B[1])))],
    discriminant: sub(mul(trace, trace), mul(fromNumber(4), determinant)), trace,
  };
}
export function characteristic(m: MatrixModel): { coefficients: number[]; discriminant: number; trace: number } {
  const value = raw(m); return { coefficients: value.a.map(toNumber), discriminant: toNumber(value.discriminant), trace: toNumber(value.trace) };
}
export function channel(m: MatrixModel): Transfer {
  const { a, b } = raw(m), factor = polynomialGcd(a, b);
  const reducedA = dividePolynomial(a, factor), reducedB = dividePolynomial(b, factor);
  if (reducedA.remainder.some(v => v.n) || reducedB.remainder.some(v => v.n)) return fail();
  return { denominator: a.map(toNumber), numerator: b.map(toNumber),
    reducedDenominator: reducedA.quotient.map(toNumber), reducedNumerator: reducedB.quotient.map(toNumber), cancellations: factor.length - 1 };
}
