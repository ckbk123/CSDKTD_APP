import { abs, add, equal, latexR, minus, multiply, neg, numeric, one, over, plus, polynomialLatex, rat, times, trim, validatePolynomial, zero, type Poly, type Rational } from './exact';

/** A rational number plus a rational multiple of one square root. */
export interface Cut { readonly base: Rational; readonly coefficient: Rational; readonly radicand: Rational }
export interface Condition { readonly name: string; readonly polynomial: Poly }
export interface Interval { readonly lower: Cut; readonly upper?: Cut; readonly includeZero: boolean; readonly test: Rational }
export interface GainModel { readonly n: Poly; readonly d: Poly }
export interface Region { readonly model: GainModel; readonly conditions: readonly Condition[]; readonly cuts: readonly Cut[]; readonly intervals: readonly Interval[] }
const signR = (r: Rational) => r.n < 0n ? -1 : r.n > 0n ? 1 : 0;
export const rationalCut = (r: Rational): Cut => ({ base: r, coefficient: zero, radicand: zero });
function sqrtInteger(n: bigint): bigint { if (n < 2n) return n; let x = n, y = (x + 1n) / 2n; while (y < x) { x = y; y = (x + n / x) / 2n; } return x; }
export function cut(base: Rational, coefficient = zero, radicand = zero): Cut {
  if (radicand.n < 0n) throw new Error('A real gain endpoint needs a nonnegative radicand.');
  if (!radicand.n || !coefficient.n) return rationalCut(base);
  const a = sqrtInteger(radicand.n), b = sqrtInteger(radicand.d);
  return a * a === radicand.n && b * b === radicand.d ? rationalCut(plus(base, times(coefficient, rat(a, b)))) : { base, coefficient, radicand };
}
/** Exact sign of a+b sqrt(d); no floating comparison determines a gain interval. */
function signSurd(a: Rational, b: Rational, d: Rational): number {
  if (!b.n || !d.n) return signR(a); if (!a.n) return signR(b);
  if (signR(a) === signR(b)) return signR(a);
  const comparison = signR(minus(times(a, a), times(times(b, b), d))); return signR(a) * comparison;
}
export function compareCuts(a: Cut, b: Cut): number {
  if (a.coefficient.n && b.coefficient.n && !equal(a.radicand, b.radicand)) throw new Error('Only one quadratic gain condition is supported.');
  const d = a.coefficient.n ? a.radicand : b.radicand;
  return signSurd(minus(a.base, b.base), minus(a.coefficient, b.coefficient), d);
}
export const cutNumber = (a: Cut) => numeric(a.base) + numeric(a.coefficient) * Math.sqrt(numeric(a.radicand));
export function cutLatex(a: Cut): string {
  if (!a.coefficient.n) return latexR(a.base);
  return `${a.base.n ? latexR(a.base) : ''}${a.coefficient.n < 0n ? '-' : a.base.n ? '+' : ''}${equal(rat(abs(a.coefficient.n), a.coefficient.d), one) ? '' : latexR(rat(abs(a.coefficient.n), a.coefficient.d))}\\sqrt{${latexR(a.radicand)}}`;
}
export function signAt(p: Poly, x: Cut): number {
  const [c, b, a] = [p[0] ?? zero, p[1] ?? zero, p[2] ?? zero];
  const rational = plus(plus(c, times(b, x.base)), times(a, plus(times(x.base, x.base), times(times(x.coefficient, x.coefficient), x.radicand))));
  const radical = plus(times(b, x.coefficient), times(rat(2), times(a, times(x.base, x.coefficient))));
  return signSurd(rational, radical, x.radicand);
}
export function conditionRoots(p: Poly): Cut[] {
  p = trim(p); if (p.length === 1) return [];
  if (p.length === 2) return [rationalCut(over(neg(p[0]), p[1]))];
  if (p.length !== 3) throw new Error('Gain inequalities must have degree at most two.');
  const delta = minus(times(p[1], p[1]), times(rat(4), times(p[2], p[0])));
  if (delta.n < 0n) return [];
  const denominator = times(rat(2), p[2]), base = over(neg(p[1]), denominator), coefficient = over(one, denominator);
  if (!delta.n) return [rationalCut(base)];
  return [cut(base, neg(coefficient), delta), cut(base, coefficient, delta)].sort(compareCuts);
}
export function validateModel(n: Poly, d: Poly): GainModel {
  n = validatePolynomial(n, true); d = validatePolynomial(d);
  if (d.length < 2 || d.length > 4 || n.length >= d.length) throw new Error('Use denominator degree1–3 and a strictly lower numerator degree.');
  const leading = d.at(-1)!; const model = { n: n.map(c => over(c, leading)), d: d.map(c => over(c, leading)) };
  if ([...model.n, ...model.d].some(c => Math.abs(numeric(c)) > 1e6)) throw new Error('Normalized coefficient magnitude must be at most1,000,000.');
  return model;
}
export function gainConditions(model: GainModel): Condition[] {
  const degree = model.d.length - 1, coefficient = (i: number): Poly => trim([model.d[i] ?? zero, model.n[i] ?? zero]);
  const result: Condition[] = [];
  for (let i = degree - 1; i >= 0; i--) result.push({ name: `a${i}(K)`, polynomial: coefficient(i) });
  if (degree === 3) result.push({ name: 'a2(K)a1(K)−a0(K)', polynomial: add(multiply(coefficient(2), coefficient(1)), coefficient(0).map(neg)) });
  return result;
}
function between(a: Cut, b?: Cut): Rational {
  let upper = rat(1);
  while (compareCuts(rationalCut(upper), a) <= 0) upper = times(upper, rat(2));
  if (!b) return upper;
  while (compareCuts(rationalCut(upper), b) < 0) upper = times(upper, rat(2));
  let lower = zero;
  for (let i = 0; i < 64; i++) {
    const middle = over(plus(lower, upper), rat(2)), x = rationalCut(middle);
    if (compareCuts(x, a) <= 0) lower = middle; else if (compareCuts(x, b) >= 0) upper = middle; else return middle;
  }
  throw new Error('Gain boundaries cannot be separated within64 exact bisections. Use less closely spaced coefficients.');
}
export function solveRegions(n: Poly, d: Poly): Region {
  const model = validateModel(n, d), conditions = gainConditions(model), raw = [rationalCut(zero), ...conditions.flatMap(c => conditionRoots(c.polynomial))];
  const cuts: Cut[] = [];
  for (const endpoint of raw.filter(c => compareCuts(c, rationalCut(zero)) >= 0).sort(compareCuts)) {
    if (!Number.isFinite(cutNumber(endpoint)) || Math.abs(cutNumber(endpoint)) > 1e12) throw new Error('A gain boundary exceeds the supported magnitude10¹². Rescale the loop.');
    if (!cuts.length || compareCuts(endpoint, cuts.at(-1)!) !== 0) cuts.push(endpoint);
  }
  const intervals: Interval[] = [];
  cuts.forEach((lower, i) => {
    const upper = cuts[i + 1], test = between(lower, upper);
    if (conditions.every(c => signAt(c.polynomial, rationalCut(test)) > 0)) intervals.push({ lower, upper, includeZero: !i && conditions.every(c => signAt(c.polynomial, rationalCut(zero)) > 0), test });
  });
  return { model, conditions, cuts, intervals };
}
export const isStable = (region: Region, gain: Cut): boolean => compareCuts(gain, rationalCut(zero)) >= 0 && region.conditions.every(c => signAt(c.polynomial, gain) > 0);
export function intervalLatex(interval: Interval): string { return `${interval.includeZero ? '[' : '('}${cutLatex(interval.lower)},${interval.upper ? cutLatex(interval.upper) : '\\infty'})`; }
export const gainPolynomialLatex = (p: Poly) => polynomialLatex(p).replaceAll('s', 'K');
export function characteristic(model: GainModel, gain: Cut): number[] {
  const k = cutNumber(gain); if (!Number.isFinite(k) || k < 0 || k > 1e12) throw new Error('Choose a finite nonnegative gain within10¹².');
  return model.d.map((c, i) => numeric(c) + k * numeric(model.n[i] ?? zero));
}
export interface Root { readonly re: number; readonly im: number; readonly residual: number }
export function numericRoots(input: readonly number[]): Root[] {
  if (input.length < 2 || input.length > 4 || input.some(x => !Number.isFinite(x)) || input.at(-1) === 0) throw new Error('Root evaluation needs a finite degree1–3 polynomial.');
  if (input[0] === 0) {
    let count = 1; while (count < input.length - 1 && input[count] === 0) count++;
    const rest = input.slice(count), remaining = rest.length > 1 ? numericRoots(rest) : [];
    return [...Array.from({ length: count }, () => ({ re: 0, im: 0, residual: 0 })), ...remaining].sort((a, b) => a.re - b.re || a.im - b.im);
  }
  const degree = input.length - 1, leading = input.at(-1)!, monic = input.map(x => x / leading);
  const radius = Math.max(1, ...monic.slice(0, -1).map((c, i) => 2 * Math.abs(c) ** (1 / (degree - i))));
  const p = monic.map((c, i) => c / radius ** (degree - i)); let raw: { re: number; im: number }[];
  if (degree === 1) raw = [{ re: -p[0], im: 0 }];
  else if (degree === 2) {
    const delta = p[1] * p[1] - 4 * p[0];
    if (delta < 0) raw = [{ re: -p[1] / 2, im: Math.sqrt(-delta) / 2 }, { re: -p[1] / 2, im: -Math.sqrt(-delta) / 2 }];
    else if (!delta) raw = [{ re: -p[1] / 2, im: 0 }, { re: -p[1] / 2, im: 0 }];
    else { const q = -.5 * (p[1] + (p[1] < 0 ? -1 : 1) * Math.sqrt(delta)); raw = [{ re: q, im: 0 }, { re: p[0] / q, im: 0 }]; }
  } else {
    const a = p[2], b = p[1] - a * a / 3, c = 2 * a * a * a / 27 - a * p[1] / 3 + p[0], delta = c * c / 4 + b * b * b / 27;
    if (delta >= 0) {
      // Choose the larger Cardano radical, avoiding subtraction of nearly equal
      // terms when the depressed linear coefficient approaches zero.
      const u = Math.cbrt(-c / 2 - (c < 0 ? -1 : 1) * Math.sqrt(delta)), v = u ? -b / (3 * u) : 0, sum = u + v, difference = Math.sqrt(3) * (u - v) / 2;
      raw = [{ re: sum - a / 3, im: 0 }, { re: -sum / 2 - a / 3, im: difference }, { re: -sum / 2 - a / 3, im: -difference }];
    } else {
      const r = 2 * Math.sqrt(-b / 3), angle = Math.acos(Math.max(-1, Math.min(1, -c / (2 * Math.sqrt(-(b * b * b) / 27))))) / 3;
      raw = [0, 1, 2].map(i => ({ re: r * Math.cos(angle - 2 * Math.PI * i / 3) - a / 3, im: 0 }));
    }
  }
  const result = raw.map(z => {
    const re = z.re * radius, im = z.im * radius; let real = 0, imaginary = 0, scale = 0;
    for (let i = monic.length - 1; i >= 0; i--) { [real, imaginary] = [real * re - imaginary * im + monic[i], real * im + imaginary * re]; scale = scale * Math.hypot(re, im) + Math.abs(monic[i]); }
    return { re, im, residual: Math.hypot(real, imaginary) / (scale || 1) };
  });
  let product = [{ re: 1, im: 0 }];
  for (const z of result) {
    const next = Array.from({ length: product.length + 1 }, () => ({ re: 0, im: 0 }));
    product.forEach((c, i) => { next[i].re += -z.re * c.re + z.im * c.im; next[i].im += -z.re * c.im - z.im * c.re; next[i + 1].re += c.re; next[i + 1].im += c.im; }); product = next;
  }
  if (result.some(z => !Number.isFinite(z.residual) || z.residual > 1e-9) || product.some((c, i) => Math.hypot(c.re - monic[i], c.im) > 1e-7 * Math.max(1, Math.abs(monic[i])))) throw new Error('Numerical roots are ill-conditioned at this gain: residual/reconstruction check failed. Exact gain intervals remain valid.');
  return result.sort((a, b) => a.re - b.re || a.im - b.im);
}

/** Minimum total squared-displacement assignment, considering every permutation.
 * Branch labels near coincident roots are numerical continuation choices. */
export function matchRoots(previous: readonly Root[], next: readonly Root[]): Root[] {
  if (previous.length !== next.length || next.length > 3) throw new Error('Match equal root counts up to three.');
  let best = [...next], cost = Infinity;
  function visit(chosen: Root[], remaining: Root[]) {
    if (!remaining.length) { const value = chosen.reduce((v, z, i) => v + (z.re - previous[i].re) ** 2 + (z.im - previous[i].im) ** 2, 0); if (value < cost) { cost = value; best = chosen; } return; }
    remaining.forEach((z, i) => visit([...chosen, z], remaining.filter((_, j) => j !== i)));
  }
  visit([], [...next]); return best;
}
export function locus(model: GainModel, maximum: number, count = 241): { gain: number; roots?: Root[]; error?: string }[] {
  if (!Number.isFinite(maximum) || maximum <= 0 || maximum > 10000 || !Number.isInteger(count) || count < 20 || count > 401) throw new Error('Locus range must be positive and≤10,000; sample count20–401.');
  let previous: Root[] | undefined;
  return Array.from({ length: count }, (_, i) => {
    const gain = maximum * i / (count - 1);
    try { const found = numericRoots(model.d.map((c, k) => numeric(c) + gain * numeric(model.n[k] ?? zero))); const matched = previous ? matchRoots(previous, found) : found; previous = matched; return { gain, roots: matched }; }
    catch (e) { previous = undefined; return { gain, error: (e as Error).message }; }
  });
}
