import { c, distance, residual, type Complex } from './complex';
import { derivative, degree, gcd, monic, numeric, quotient, zero, type Polynomial } from './polynomial';
import { add, div, mul, neg, rational, sub, toNumber, ZERO } from './rational';

export interface Root extends Complex { readonly multiplicity: number }
const r = (value: number) => rational(BigInt(value));
function simpleRoots(p: Polynomial): Complex[] {
  const normalized = monic(p), coefficients = numeric(normalized), n = degree(p);
  if (!n) return [];
  if (n === 1) return [c(-coefficients[0])];
  if (n === 2) {
    const [d, b] = normalized, delta = sub(mul(b, b), mul(r(4), d));
    const center = -coefficients[1] / 2;
    if (delta.n < 0n) { const im = Math.sqrt(toNumber(neg(delta))) / 2; return [c(center, im), c(center, -im)]; }
    if (!delta.n) return [c(center), c(center)];
    const root = Math.sqrt(toNumber(delta)), large = -.5 * (coefficients[1] + (coefficients[1] < 0 ? -root : root));
    return [c(large), c(large ? coefficients[0] / large : 0)];
  }
  const [cr, br, ar] = normalized, [cn, bn, an] = coefficients;
  const depressedP = sub(br, div(mul(ar, ar), r(3)));
  const depressedQ = add(sub(div(mul(r(2), mul(mul(ar, ar), ar)), r(27)), div(mul(ar, br), r(3))), cr);
  const discriminant = sub(neg(mul(r(4), mul(mul(depressedP, depressedP), depressedP))), mul(r(27), mul(depressedQ, depressedQ)));
  const pn = toNumber(depressedP, true), qn = toNumber(depressedQ, true), center = -an / 3;
  if (discriminant.n > 0n) {
    const radius = 2 * Math.sqrt(-pn / 3), cosine = -qn / (2 * Math.sqrt(-pn * pn * pn / 27));
    const theta = Math.acos(Math.max(-1, Math.min(1, cosine))) / 3;
    return [0, 1, 2].map(k => {
      let value = center + radius * Math.cos(theta - 2 * Math.PI * k / 3);
      for (let i = 0; i < 3; i++) { const slope = (3 * value + 2 * an) * value + bn; if (!slope) break; const next = value - (((value + an) * value + bn) * value + cn) / slope; if (Number.isFinite(next)) value = next; }
      return c(value);
    });
  }
  if (!discriminant.n) throw new Error('Repeated cubic factors were not separated exactly.');
  const h = Math.sqrt(toNumber(neg(discriminant))) / Math.sqrt(108);
  const u = Math.cbrt(-qn / 2 - (qn < 0 ? -h : h)), v = u ? -pn / (3 * u) : 0;
  let real = center + u + v;
  // Refine the isolated real root, then use the product for a cancellation-prone small root.
  for (let i = 0; i < 3; i++) { const slope = (3 * real + 2 * an) * real + bn; if (!slope) break; const next = real - (((real + an) * real + bn) * real + cn) / slope; if (Number.isFinite(next)) real = next; }
  const pairRe = -(an + real) / 2;
  // Product of the conjugate pair; synthetic division is safer when the real root is tiny.
  const pairProduct = real && Math.abs(real) > 1e-8 ? -cn / real : bn + real * (an + real);
  const imSquared = pairProduct - pairRe * pairRe;
  if (!(imSquared > 0)) throw new Error('The cubic conjugate pair is too close to resolve numerically. Rescale or change the data.');
  const im = Math.sqrt(imSquared); return [c(real), c(pairRe, im), c(pairRe, -im)];
}

/** Exact square-free multiplicities; distinct roots are numerical and guarded by separation, residual and Vieta checks. */
export function roots(p: Polynomial): Root[] {
  const n = degree(p); if (zero(p)) throw new Error('The zero polynomial has no isolated finite roots.');
  if (n > 3) throw new Error('Closed-loop roots support degree at most three.');
  const normalized = monic(p); let repeated = gcd(normalized, derivative(normalized)), distinct = quotient(normalized, repeated), multiplicity = 1;
  const result: Root[] = [];
  while (degree(distinct)) {
    const overlap = gcd(distinct, repeated), factor = quotient(distinct, overlap);
    const values = simpleRoots(factor);
    values.forEach((point, i) => {
      if (![point.re, point.im].every(Number.isFinite) || Math.hypot(point.re, point.im) > 1e6) throw new Error('A root lies outside the numerical range |s| ≤ 10⁶. Rescale the model.');
      if (values.some((other, j) => j !== i && distance(point, other) < 2e-7 * Math.max(1, Math.hypot(point.re, point.im), Math.hypot(other.re, other.im)))) throw new Error('Distinct roots are too close to resolve (relative separation below 2×10⁻⁷). Exact repeated factors are handled separately.');
      if (residual(factor, point) > 2e-10) throw new Error('A numerical root failed its polynomial residual check. Rescale the data.');
      result.push({ ...point, multiplicity });
    });
    distinct = overlap; repeated = quotient(repeated, overlap); multiplicity++;
    if (multiplicity > 4) throw new Error('Root multiplicity work exceeded its bound.');
  }
  // Reconstruct all coefficients, including the full multiplicity, independently of root order.
  let reconstructed: Complex[] = [c(1)];
  for (const point of result) for (let count = 0; count < point.multiplicity; count++) {
    const next = Array.from({ length: reconstructed.length + 1 }, () => c(0));
    reconstructed.forEach((value, i) => { next[i] = c(next[i].re - value.re * point.re + value.im * point.im, next[i].im - value.re * point.im - value.im * point.re); next[i + 1] = c(next[i + 1].re + value.re, next[i + 1].im + value.im); }); reconstructed = next;
  }
  const expected = numeric(normalized), scale = Math.max(1, ...expected.map(Math.abs));
  if (reconstructed.length !== expected.length || reconstructed.some((value, i) => Math.hypot(value.re - expected[i], value.im) > 1e-9 * scale)) throw new Error('The root set failed its coefficient reconstruction check. Rescale the data.');
  return result.sort((a, b) => a.re - b.re || a.im - b.im);
}
export function expandRoots(values: readonly Root[]): Complex[] { return values.flatMap(value => Array.from({ length: value.multiplicity }, () => c(value.re, value.im))); }
export const constantPolynomial: Polynomial = [ZERO];
