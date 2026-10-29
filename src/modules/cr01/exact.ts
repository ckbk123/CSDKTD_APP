/** Exact rational arithmetic. Coefficients ascend in s; all arrays are caller-owned. */
export interface Rational { readonly n: bigint; readonly d: bigint }
export type Poly = readonly Rational[];
export const zero: Rational = { n: 0n, d: 1n }, one: Rational = { n: 1n, d: 1n };
export const abs = (n: bigint) => n < 0n ? -n : n;
export function gcd(a: bigint, b: bigint): bigint { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a; }
export function rat(n: bigint | number, d: bigint | number = 1): Rational {
  n = BigInt(n); d = BigInt(d);
  if (!d) throw new Error('Division by zero is undefined.');
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d); n /= g; d /= g;
  if (abs(n).toString().length > 30 || d.toString().length > 30) throw new Error('Exact coefficients exceeded the 30-digit arithmetic limit. Use smaller numbers.');
  return { n, d };
}
export const plus = (a: Rational, b: Rational) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const neg = (a: Rational) => rat(-a.n, a.d);
export const minus = (a: Rational, b: Rational) => plus(a, neg(b));
export const times = (a: Rational, b: Rational) => rat(a.n * b.n, a.d * b.d);
export const over = (a: Rational, b: Rational) => rat(a.n * b.d, a.d * b.n);
export const equal = (a: Rational, b: Rational) => a.n === b.n && a.d === b.d;
export const numeric = (a: Rational) => Number(a.n) / Number(a.d);
export const textR = (a: Rational) => a.d === 1n ? String(a.n) : `${a.n}/${a.d}`;
export const latexR = (a: Rational): string => a.d === 1n ? String(a.n) : `${a.n < 0n ? '-' : ''}\\frac{${abs(a.n)}}{${a.d}}`;

/** Native numeric controls have a distinct exponent grammar from visual math. */
export function decimal(raw: string, nativeExponent = false): Rational {
  const m = /^([+-]?)(\d*(?:\.\d*)?)(?:[eE]([+-]?\d+))?$/.exec(raw.trim());
  if (!m || !/\d/.test(m[2]) || (!nativeExponent && m[3])) throw new Error('Use a decimal number or a visual fraction.');
  const digits = m[2].replace('.', '');
  if (digits.length > 15) throw new Error('Use at most 15 digits in each decimal.');
  if (!/[1-9]/.test(digits)) return zero;
  const exponent = Number(m[3] ?? 0) - (m[2].split('.')[1]?.length ?? 0);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 15) throw new Error('Use decimal scales between 10⁻¹⁵ and 10¹⁵.');
  const n = BigInt(digits) * (m[1] === '-' ? -1n : 1n);
  return exponent >= 0 ? rat(n * 10n ** BigInt(exponent)) : rat(n, 10n ** BigInt(-exponent));
}
export function trim(p: Poly): Rational[] { const q = [...p]; while (q.length > 1 && q.at(-1)!.n === 0n) q.pop(); return q.length ? q : [zero]; }
export const isZero = (p: Poly) => trim(p).length === 1 && p[0].n === 0n;
export const same = (a: Poly, b: Poly) => { const p = trim(a), q = trim(b); return p.length === q.length && p.every((x, i) => equal(x, q[i])); };
export function add(a: Poly, b: Poly): Rational[] { return trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => plus(a[i] ?? zero, b[i] ?? zero))); }
export function multiply(a: Poly, b: Poly): Rational[] {
  if (a.length + b.length > 18) throw new Error('Intermediate polynomial degree exceeds 16.');
  const c: Rational[] = Array.from({ length: a.length + b.length - 1 }, () => zero);
  a.forEach((x, i) => b.forEach((y, j) => { c[i + j] = plus(c[i + j], times(x, y)); })); return trim(c);
}
export function divide(a: Poly, b: Poly): { quotient: Rational[]; remainder: Rational[] } {
  b = trim(b); if (isZero(b)) throw new Error('A denominator polynomial cannot be zero.');
  const remainder = trim(a), quotient = Array.from({ length: Math.max(1, remainder.length - b.length + 1) }, () => zero);
  for (let i = remainder.length - 1; i >= b.length - 1; i--) {
    const k = i - b.length + 1, c = over(remainder[i], b.at(-1)!); quotient[k] = c;
    b.forEach((x, j) => { remainder[k + j] = minus(remainder[k + j], times(c, x)); });
  }
  return { quotient: trim(quotient), remainder: trim(remainder) };
}
export const evaluateExact = (p: Poly, x: Rational) => p.reduceRight((v, c) => plus(times(v, x), c), zero);
export function primitive(p: Poly): bigint[] {
  let lcm = 1n; for (const c of p) lcm = lcm / gcd(lcm, c.d) * c.d;
  const ints = p.map(c => c.n * (lcm / c.d)); let g = 0n; for (const c of ints) g = gcd(g, c);
  if (!g) return [0n]; if (ints.at(-1)! < 0n) g = -g; return ints.map(c => c / g);
}
export function validatePolynomial(p: Poly, allowZero = false): Rational[] {
  const q = trim(p);
  if (q.length > 5) throw new Error('Use a polynomial of degree at most four.');
  if (!allowZero && isZero(q)) throw new Error('The zero polynomial has no finite root list or factorization.');
  if (q.some(c => Math.abs(numeric(c)) > 1e6)) throw new Error('Coefficient magnitude must be at most 1,000,000.');
  if (primitive(q).some(c => abs(c) > 10000n)) throw new Error('After clearing fractions and common scale, integer coefficients must have magnitude at most 10,000.');
  return q;
}
export function polynomialLatex(p: Poly): string {
  const terms: string[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const c = p[i]; if (!c.n) continue;
    const sign = c.n < 0n ? '-' : terms.length ? '+' : '', magnitude = rat(abs(c.n), c.d);
    terms.push(`${sign}${i && equal(magnitude, one) ? '' : latexR(magnitude)}${i ? i === 1 ? 's' : `s^{${i}}` : ''}`);
  }
  return terms.join('') || '0';
}
