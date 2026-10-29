import { abs, add, divide, evaluateExact, isZero, minus, multiply, neg, numeric, one, over, plus, primitive, rat, same, times, trim, validatePolynomial, zero, type Poly, type Rational } from './exact';

export interface Factor { readonly polynomial: Poly; readonly multiplicity: number }
export interface Factorization { readonly scale: Rational; readonly factors: readonly Factor[] }
export interface Root { readonly re: number; readonly im: number; readonly multiplicity: number; readonly residual: number }
export interface Complex { readonly re: number; readonly im: number }
const cadd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const csub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const cmul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
function cdiv(a: Complex, b: Complex): Complex { const d = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }; }
const norm = (z: Complex) => Math.hypot(z.re, z.im);
export function complexValue(p: Poly, z: Complex): Complex { return p.reduceRight((v, c) => cadd(cmul(v, z), { re: numeric(c), im: 0 }), { re: 0, im: 0 }); }
export function residual(p: Poly, z: Complex): number {
  const scale = p.reduceRight((v, c) => v * norm(z) + Math.abs(numeric(c)), 0);
  return norm(complexValue(p, z)) / (scale || 1);
}
function sqrtInteger(n: bigint): bigint {
  if (n < 0n) return -1n; if (n < 2n) return n;
  let x = n, y = (x + 1n) / 2n; while (y < x) { x = y; y = (x + n / x) / 2n; } return x;
}

/** Exhaustive rational-root / integer quadratic-factor search, with an explicit work bound. */
export function factorPolynomial(input: Poly): Factorization {
  const p = validatePolynomial(input), scale = p.at(-1)!; let work = 0;
  const step = () => { if (++work > 100000) throw new Error('Exact factoring reached its 100,000-candidate limit. Use smaller coefficients.'); };
  function divisors(n: bigint): bigint[] {
    n = abs(n); if (n > 1000000n) throw new Error('An exact factor exceeded the intermediate integer height limit of 1,000,000.');
    const found: bigint[] = []; for (let x = 1n; x * x <= n; x++) { step(); if (n % x === 0n) { found.push(x); if (x * x !== n) found.push(n / x); } }
    return found;
  }
  function split(q: Poly): Poly | undefined {
    if (!q[0].n) return [zero, one];
    const c = primitive(q), n = c.length - 1, constants = divisors(c[0]), leads = divisors(c[n]);
    for (const a of constants) for (const b of leads) for (const sign of [1n, -1n]) {
      step(); const root = rat(sign * a, b); if (!evaluateExact(q, root).n) return [neg(root), one];
    }
    if (n !== 4) return;
    // Gauss' lemma: a reducible primitive quartic without a rational linear factor
    // has an integer quadratic pair. Compare all five coefficients exactly.
    for (const a of leads) for (const constant of constants) for (const sign of [1n, -1n]) {
      step(); const d = c[4] / a, v = constant * sign, f = c[0] / v, determinant = d * v - a * f;
      const candidates: bigint[] = [];
      if (determinant) {
        const numerator = c[3] * v - a * c[1]; if (numerator % determinant === 0n) candidates.push(numerator / determinant);
      } else {
        const k = c[2] - a * f - v * d, discriminant = c[3] * c[3] - 4n * d * a * k, r = sqrtInteger(discriminant);
        if (r >= 0n && r * r === discriminant) for (const signB of [1n, -1n]) { const num = c[3] + signB * r; if (num % (2n * d) === 0n) candidates.push(num / (2n * d)); }
      }
      for (const b of candidates) {
        if ((c[3] - d * b) % a) continue; const e = (c[3] - d * b) / a;
        if (b * f + v * e === c[1] && a * f + b * e + v * d === c[2]) return [rat(v, a), rat(b, a), one];
      }
    }
    return;
  }
  const raw: Poly[] = [];
  function recurse(q: Poly): void {
    if (q.length === 1) return;
    if (q.length === 2) { raw.push(q.map(c => over(c, q.at(-1)!))); return; }
    const found = split(q);
    if (!found) { raw.push(q.map(c => over(c, q.at(-1)!))); return; }
    const divided = divide(q, found); if (!isZero(divided.remainder)) throw new Error('Exact factor verification failed.');
    recurse(found); recurse(divided.quotient);
  }
  recurse(p.map(c => over(c, scale)));
  const factors: { polynomial: Poly; multiplicity: number }[] = [];
  for (const q of raw) { const prior = factors.find(f => same(f.polynomial, q)); if (prior) prior.multiplicity++; else factors.push({ polynomial: q, multiplicity: 1 }); }
  let expanded: Poly = [scale]; for (const f of factors) for (let i = 0; i < f.multiplicity; i++) expanded = multiply(expanded, f.polynomial);
  if (!same(expanded, p)) throw new Error('Exact re-expansion failed.');
  return { scale, factors };
}
export function discriminant(q: Poly): Rational {
  if (trim(q).length !== 3) throw new Error('A discriminant needs a nonzero quadratic coefficient.');
  return minus(times(q[1], q[1]), times(rat(4), times(q[2], q[0])));
}
/** Analytic roots for degrees1–2, simultaneous iteration for squarefree degrees3–4.
 * Exact factorization determines multiplicity; clustering never invents it. */
export function roots(input: Poly, factored = factorPolynomial(input), iterations = 600): Root[] {
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 600) throw new Error('Root iteration limit must be 1–600.');
  const result: Root[] = [];
  for (const f of factored.factors) {
    const p = f.polynomial, degree = p.length - 1; let values: Complex[];
    if (degree === 1) values = [{ re: -numeric(over(p[0], p[1])), im: 0 }];
    else if (degree === 2) {
      const a = numeric(p[2]), b = numeric(p[1]), c = numeric(p[0]), delta = numeric(discriminant(p));
      if (delta < 0) values = [{ re: -b / (2 * a), im: Math.sqrt(-delta) / (2 * a) }, { re: -b / (2 * a), im: -Math.sqrt(-delta) / (2 * a) }];
      else if (!delta) values = [{ re: -b / (2 * a), im: 0 }];
      else { const t = -.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(delta)); values = [{ re: t / a, im: 0 }, { re: c / t, im: 0 }]; }
    } else {
      const radius = Math.max(1, ...p.slice(0, -1).map((c, i) => 2 * Math.abs(numeric(c)) ** (1 / (degree - i))));
      const scaled = p.map((c, i) => numeric(c) / radius ** (degree - i));
      let solved: Complex[] | undefined;
      for (const offset of [.173, .397, .719]) {
        let candidates = Array.from({ length: degree }, (_, i) => ({ re: Math.cos(2 * Math.PI * (i + offset) / degree), im: Math.sin(2 * Math.PI * (i + offset) / degree) }));
        for (let iteration = 0; iteration < iterations; iteration++) {
          let maxStep = 0;
          const next = candidates.map((z, i) => {
            let denominator: Complex = { re: 1, im: 0 }; candidates.forEach((w, j) => { if (i !== j) denominator = cmul(denominator, csub(z, w)); });
            const value = scaled.reduceRight((v, c) => cadd(cmul(v, z), { re: c, im: 0 }), { re: 0, im: 0 }), correction = cdiv(value, denominator);
            maxStep = Math.max(maxStep, norm(correction)); return csub(z, correction);
          });
          candidates = next;
          if (candidates.some(z => !Number.isFinite(norm(z)))) break;
          if (maxStep < 1e-12 && candidates.every(z => residual(p, { re: z.re * radius, im: z.im * radius }) < 1e-10)) { solved = candidates.map(z => ({ re: z.re * radius, im: z.im * radius })); break; }
        }
        if (solved) break;
      }
      if (!solved) throw new Error('Numerical roots did not converge within three starts of 600 iterations. Exact algebra remains valid; use better-scaled coefficients.');
      values = solved;
    }
    for (const z of values) {
      const error = residual(input, z); if (!Number.isFinite(error) || error > 1e-10) throw new Error('Numerical root residual exceeds 10⁻¹⁰. Rescale the polynomial.');
      result.push({ ...z, multiplicity: f.multiplicity, residual: error });
    }
  }
  return result.sort((a, b) => a.re - b.re || a.im - b.im);
}
export function expandedFactors(f: Factorization): Poly[] {
  const result: Poly[] = [[f.scale]]; for (const item of f.factors) for (let i = 0; i < item.multiplicity; i++) result.push(item.polynomial); return result;
}
export function coefficientContributions(factors: readonly Poly[], power: number): { choices: readonly number[]; value: Rational }[] {
  const rows: { choices: number[]; value: Rational }[] = [];
  function visit(i: number, degree: number, value: Rational, choices: number[]): void {
    if (i === factors.length) { if (degree === power && value.n) rows.push({ choices, value }); return; }
    factors[i].forEach((c, exponent) => { if (degree + exponent <= power && c.n) visit(i + 1, degree + exponent, times(value, c), [...choices, exponent]); });
  }
  visit(0, 0, one, []); return rows;
}
export function compareRational(n1: Poly, d1: Poly, n2: Poly, d2: Poly) {
  if (isZero(d1) || isZero(d2)) throw new Error('A denominator polynomial cannot be zero.');
  const difference = add(multiply(n1, d2), multiply(n2, d1).map(neg));
  const f1 = factorPolynomial(d1), f2 = factorPolynomial(d2);
  const sameDomain = f1.factors.every(f => f2.factors.some(g => same(f.polynomial, g.polynomial))) && f2.factors.every(f => f1.factors.some(g => same(f.polynomial, g.polynomial)));
  return { equalOnCommonDomain: isZero(difference), sameDomain, difference, exclusions1: roots(d1, f1), exclusions2: roots(d2, f2) };
}
/** Entered real/conjugate poles define an exact rational polynomial. */
export function fromPoles(poles: readonly { re: Rational; im: Rational; multiplicity: number }[], scale = one): Poly {
  if (!scale.n) throw new Error('Leading scale cannot be zero.'); let p: Poly = [scale]; let degree = 0;
  for (const z of poles) {
    if (z.im.n < 0n || !Number.isInteger(z.multiplicity) || z.multiplicity < 1 || z.multiplicity > 4) throw new Error('Use nonnegative imaginary parts and multiplicities1–4.');
    degree += (z.im.n ? 2 : 1) * z.multiplicity; if (degree > 4) throw new Error('The selected real roots/conjugate pairs exceed degree four.');
    const factor = z.im.n ? [plus(times(z.re, z.re), times(z.im, z.im)), times(rat(-2), z.re), one] : [neg(z.re), one];
    for (let i = 0; i < z.multiplicity; i++) p = multiply(p, factor);
  }
  return validatePolynomial(p);
}
