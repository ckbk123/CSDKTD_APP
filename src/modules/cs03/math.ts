/** Private exact coefficients plus bounded cubic root checks; no shared state. */
export interface Rational { readonly n: bigint; readonly d: bigint }
const abs = (n: bigint) => n < 0n ? -n : n;
export function q(n: number | bigint, d: number | bigint = 1): Rational {
  let a = BigInt(n), b = BigInt(d);
  if (!b) throw new Error('A numeric fraction cannot divide by zero.');
  if (b < 0n) { a = -a; b = -b; }
  if (abs(a).toString(2).length > 2048 || b.toString(2).length > 2048) throw new Error('Exact precision limit reached. Simplify fractions or choose a less extreme gain.');
  let x = abs(a), y = b; while (y) { const r = x % y; x = y; y = r; }
  return { n: a / x, d: b / x };
}
export const ZERO = q(0), ONE = q(1);
export const add = (a: Rational, b: Rational) => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rational, b: Rational) => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Rational, b: Rational) => q(a.n * b.n, a.d * b.d);
export const div = (a: Rational, b: Rational) => q(a.n * b.d, a.d * b.n);
export const neg = (a: Rational) => q(-a.n, a.d);
export const compare = (a: Rational, b: Rational) => Math.sign(Number(a.n * b.d - b.n * a.d));
export const textOf = (a: Rational) => a.d === 1n ? String(a.n) : `${a.n}/${a.d}`;
export const latexOf = (a: Rational) => a.d === 1n ? String(a.n) : `${a.n < 0n ? '-' : ''}\\frac{${abs(a.n)}}{${a.d}}`;
export function numberOf(a: Rational): number {
  if (!a.n) return 0;
  const n = abs(a.n), sn = Math.max(0, n.toString(2).length - 53), sd = Math.max(0, a.d.toString(2).length - 53);
  const ratio = Number(n >> BigInt(sn)) / Number(a.d >> BigInt(sd)), exponent = sn - sd;
  const value = exponent < -1022 ? ratio * 2 ** (exponent + 1022) * 2 ** -1022
    : exponent > 1023 ? ratio * 2 ** (exponent - 1023) * 2 ** 1023 : ratio * 2 ** exponent;
  return a.n < 0n ? -value : value;
}
export function fromNumber(value: number): Rational {
  if (!Number.isFinite(value)) throw new Error('Enter a finite number.');
  const [mantissa, exponent = '0'] = String(value).split('e'), places = (mantissa.split('.')[1]?.length ?? 0) - Number(exponent);
  const digits = BigInt(mantissa.replace('.', ''));
  return places >= 0 ? q(digits, 10n ** BigInt(places)) : q(digits * 10n ** BigInt(-places));
}
export type Polynomial = readonly Rational[]; // Exactly four ascending coefficients.
const constant = (a: Rational): Polynomial => [a, ZERO, ZERO, ZERO];
function plusPoly(a: Polynomial, b: Polynomial, sign: number): Polynomial { return a.map((v, i) => sign === 1 ? add(v, b[i]) : sub(v, b[i])); }
function timesPoly(a: Polynomial, b: Polynomial): Polynomial {
  const out = [ZERO, ZERO, ZERO, ZERO];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    if (!a[i].n || !b[j].n) continue;
    if (i + j > 3) throw new Error('Use a polynomial of degree at most three in s.');
    out[i + j] = add(out[i + j], mul(a[i], b[j]));
  }
  return out;
}
function decimal(token: string): Rational {
  const [whole, fraction = ''] = token.split('.');
  if (fraction.length > 6 || token.replace('.', '').length > 9) throw new Error('Use at most six decimal places and nine digits per number.');
  return q(BigInt((whole || '0') + fraction), 10n ** BigInt(fraction.length));
}
export function parseDenominator(latex: string): Polynomial {
  if (!latex.trim() || latex.length > 300) throw new Error('Enter D(s) using at most 300 characters.');
  let source = latex.replace(/\\(?:left|right)\b/g, '').replace(/\\(?:cdot|times)/g, '*').replace(/\\[,!; ]/g, '').replace(/\s/g, '').replace(/^D\(s\)=/, '');
  source = source.replace(/\\(?:dfrac|frac)(?:\{([+-]?(?:\d+(?:\.\d*)?|\.\d+))\}|(\d))(?:\{([+-]?(?:\d+(?:\.\d*)?|\.\d+))\}|(\d))/g,
    (_all, n, nd, d, dd) => `((${n ?? nd})/(${d ?? dd}))`).replace(/\^\{([0123])\}/g, '^$1').replace(/\{/g, '(').replace(/\}/g, ')');
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[s()+\-*/^]/g) ?? [];
  if (!tokens.length || tokens.join('') !== source) throw new Error('Use s, decimals, signed numeric fractions, parentheses, products and powers through three. K has its own control; e notation is unsupported.');
  if (tokens.length > 160) throw new Error('Use at most 160 terms/symbols.');
  let at = 0, depth = 0;
  function atom(): Polynomial {
    if (++depth > 12) throw new Error('Use at most twelve nested groups.');
    const token = tokens[at++]; let out: Polynomial;
    if (token === '(') { out = sum(); if (tokens[at++] !== ')') throw new Error('Complete each term and close every parenthesis.'); }
    else if (token === 's') out = [ZERO, ONE, ZERO, ZERO];
    else if (token && /^(?:\d|\.)/.test(token)) out = constant(decimal(token));
    else throw new Error('Complete the polynomial with a number, s or a parenthesized term.');
    depth--;
    if (tokens[at] === '^') {
      at++; const power = tokens[at++];
      if (!['0', '1', '2', '3'].includes(power)) throw new Error('Only powers 0, 1, 2 and 3 are supported.');
      const base = out; out = constant(ONE); for (let i = 0; i < Number(power); i++) out = timesPoly(out, base);
    }
    return out;
  }
  function signed(): Polynomial { if (tokens[at] === '+' || tokens[at] === '-') { const sign = tokens[at++] === '+' ? 1 : -1; const out = signed(); return sign === 1 ? out : out.map(neg); } return atom(); }
  function product(): Polynomial {
    let out = signed();
    while (at < tokens.length) {
      const next = tokens[at];
      if (next === '/') { at++; const divisor = signed(); if (!divisor[0].n || divisor.slice(1).some(v => v.n !== 0n)) throw new Error('Divide only by a nonzero numeric constant; enter the denominator polynomial, not a transfer function.'); out = out.map(v => div(v, divisor[0])); }
      else if (next === '*' || next === '(' || next === 's' || /^(?:\d|\.)/.test(next)) { if (next === '*') at++; out = timesPoly(out, signed()); }
      else break;
    }
    return out;
  }
  function sum(): Polynomial { let out = product(); while (tokens[at] === '+' || tokens[at] === '-') { const sign = tokens[at++] === '+' ? 1 : -1; out = plusPoly(out, product(), sign); } return out; }
  const out = sum();
  if (at !== tokens.length) throw new Error('Check operators and parentheses.');
  if (out.some(v => abs(v.n) > 1_000_000_000_000n || v.d > 1_000_000_000_000n)) throw new Error('Simplify coefficient fractions to reduced parts at most 10¹².');
  if (out.some(v => Math.abs(numberOf(v)) > 100 || (v.n !== 0n && Math.abs(numberOf(v)) < 1e-8))) throw new Error('Final nonzero coefficient magnitudes must be from 10⁻⁸ through 100.');
  if (compare(out[3], ONE) !== 0) throw new Error('D must be monic cubic: s³+a s²+b s+d, with leading coefficient exactly 1.');
  return out;
}
export interface Model { readonly a: Rational; readonly b: Rational; readonly d: Rational; readonly g: Rational; readonly denominator: Polynomial }
export function parseModel(latex: string, gainFactor: number): Model {
  if (!Number.isFinite(gainFactor) || Math.abs(gainFactor) > 100 || (gainFactor !== 0 && Math.abs(gainFactor) < 1e-8)) throw new Error('Choose finite g with magnitude 10⁻⁸..100, or g=0.');
  const denominator = parseDenominator(latex);
  return { a: denominator[2], b: denominator[1], d: denominator[0], g: fromNumber(gainFactor), denominator };
}
export function conditions(m: Model) { return [
  { label: 'a > 0', constant: m.a, slope: ZERO }, { label: 'b > 0', constant: m.b, slope: ZERO },
  { label: 'c(K) > 0', constant: m.d, slope: m.g }, { label: 'ab − c(K) > 0', constant: sub(mul(m.a, m.b), m.d), slope: neg(m.g) },
]; }
export function interval(m: Model) {
  if (compare(m.a, ZERO) <= 0 || compare(m.b, ZERO) <= 0) return { kind: 'empty' as const, lower: null, upper: null };
  if (!m.g.n) return { kind: compare(m.d, ZERO) > 0 && compare(m.d, mul(m.a, m.b)) < 0 ? 'all' as const : 'empty' as const, lower: null, upper: null };
  const one = div(neg(m.d), m.g), two = div(sub(mul(m.a, m.b), m.d), m.g);
  return compare(one, two) < 0 ? { kind: 'finite' as const, lower: one, upper: two } : { kind: 'finite' as const, lower: two, upper: one };
}
export interface Complex { readonly re: number; readonly im: number }
function sqrtPositive(a: Rational): number {
  const value = numberOf(a); if (value > 0 && Number.isFinite(value)) return Math.sqrt(value);
  const logarithm = (n: bigint) => { const shift = Math.max(0, n.toString(2).length - 53); return Math.log(Number(n >> BigInt(shift))) + shift * Math.LN2; };
  return Math.exp((logarithm(a.n) - logarithm(a.d)) / 2);
}
export function cubicRoots(a: Rational, b: Rational, c: Rational): { roots: Complex[]; structure: string } {
  const av = numberOf(a), bv = numberOf(b);
  if (!c.n) {
    const disc = sub(mul(a, a), mul(q(4), b)); let pair: Complex[];
    if (disc.n < 0n) pair = [{ re: -av / 2, im: sqrtPositive(neg(disc)) / 2 }, { re: -av / 2, im: -sqrtPositive(neg(disc)) / 2 }];
    else { const x = -.5 * (av + (av < 0 ? -1 : 1) * Math.sqrt(numberOf(disc))); pair = x === 0 ? [{ re: 0, im: 0 }, { re: 0, im: 0 }] : [{ re: x, im: 0 }, { re: bv / x, im: 0 }]; }
    return { roots: [{ re: 0, im: 0 }, ...pair], structure: 'Exact factor s(s²+as+b)' };
  }
  if (compare(c, mul(a, b)) === 0) return { roots: [{ re: -av, im: 0 }, ...(bv >= 0 ? [{ re: 0, im: Math.sqrt(bv) }, { re: 0, im: -Math.sqrt(bv) }] : [{ re: Math.sqrt(-bv), im: 0 }, { re: -Math.sqrt(-bv), im: 0 }])], structure: 'Exact factor (s+a)(s²+b)' };
  const p = sub(b, div(mul(a, a), q(3))), r = add(sub(div(mul(q(2), mul(mul(a, a), a)), q(27)), div(mul(a, b), q(3))), c);
  const pv = numberOf(p), rv = numberOf(r), shift = av / 3;
  if (r.n && rv === 0) throw new Error('The numerical root scale is too small. Use a less extreme gain.');
  if (!p.n) {
    const t = Math.cbrt(-rv); return { roots: [{ re: t - shift, im: 0 }, { re: -t / 2 - shift, im: Math.sqrt(3) * Math.abs(t) / 2 }, { re: -t / 2 - shift, im: -Math.sqrt(3) * Math.abs(t) / 2 }], structure: r.n ? 'One real root and a conjugate pair' : 'Triple real root' };
  }
  const delta = add(mul(div(r, q(2)), div(r, q(2))), mul(mul(div(p, q(3)), div(p, q(3))), div(p, q(3))));
  if (delta.n > 0n) {
    const sd = sqrtPositive(delta), u = Math.cbrt(-rv / 2 - (rv < 0 ? -1 : 1) * sd), v = -pv / (3 * u), t = u + v;
    const imaginary = Math.sqrt(3) * sd / (u * u + u * v + v * v);
    return { roots: [{ re: t - shift, im: 0 }, { re: -t / 2 - shift, im: imaginary }, { re: -t / 2 - shift, im: -imaginary }], structure: 'One real root and a conjugate pair' };
  }
  if (!delta.n) {
    const u = Math.cbrt(-rv / 2); return { roots: [{ re: 2 * u - shift, im: 0 }, { re: -u - shift, im: 0 }, { re: -u - shift, im: 0 }], structure: 'Repeated real root (exact discriminant zero)' };
  }
  const angle = Math.acos(Math.max(-1, Math.min(1, -rv / (2 * Math.sqrt(-((pv / 3) ** 3)))))), radius = 2 * Math.sqrt(-pv / 3);
  return { roots: [0, 1, 2].map(k => ({ re: radius * Math.cos((angle + 2 * Math.PI * k) / 3) - shift, im: 0 })), structure: 'Three distinct real roots' };
}
export function analyze(m: Model, gain: number | Rational) {
  if (typeof gain === 'number' && (!Number.isFinite(gain) || Math.abs(gain) > 1000)) throw new Error('Choose a finite selected K in [-1000,1000].');
  const k = typeof gain === 'number' ? fromNumber(gain) : gain, c = add(m.d, mul(m.g, k));
  const evaluated = conditions(m).map(condition => add(condition.constant, mul(condition.slope, k)));
  const solution = cubicRoots(m.a, m.b, c), scale = Math.max(1, ...solution.roots.map(z => Math.hypot(z.re, z.im))), tolerance = 1e-8 * scale;
  if (solution.roots.some(z => !Number.isFinite(z.re) || !Number.isFinite(z.im))) throw new Error('Numerical root check exceeded its range. Choose less extreme data.');
  const av = numberOf(m.a), bv = numberOf(m.b), cv = numberOf(c);
  const residual = Math.max(...solution.roots.map(z => {
    let re = 1, im = 0;
    for (const coefficient of [av, bv, cv]) { const next = re * z.re - im * z.im + coefficient; im = re * z.im + im * z.re; re = next; }
    const radius = Math.hypot(z.re, z.im);
    return Math.hypot(re, im) / Math.max(1, radius ** 3 + Math.abs(av) * radius ** 2 + Math.abs(bv) * radius + Math.abs(cv));
  }));
  if (!Number.isFinite(residual) || residual > 1e-8) throw new Error('The numerical roots failed their polynomial residual check. Choose better-conditioned data.');
  const rightCount = solution.roots.filter(z => z.re > tolerance).length, nearAxis = solution.roots.some(z => Math.abs(z.re) <= tolerance);
  const formalStable = evaluated.every(v => v.n > 0n), abMinusC = sub(mul(m.a, m.b), c);
  const firstColumn = m.a.n ? [ONE, m.a, div(abMinusC, m.a), c] : null;
  const signs = firstColumn?.map(v => compare(v, ZERO));
  const signChanges = signs && signs.every(s => s !== 0) ? signs.slice(1).filter((s, i) => s !== signs[i]).length : null;
  return { gain: k, c, evaluated, ...solution, tolerance, residual, formalStable, rightCount, nearAxis, firstColumn, signChanges };
}
export interface Prediction { readonly kind: 'finite' | 'all' | 'empty'; readonly lower: number; readonly upper: number; readonly lowerClosed: boolean; readonly upperClosed: boolean }
export function checkPrediction(m: Model, answer: Prediction): { correct: boolean; message: string } {
  const expected = interval(m);
  if (answer.kind !== expected.kind) return { correct: false, message: `The derived set is ${expected.kind === 'empty' ? 'empty' : expected.kind === 'all' ? 'all real gains' : 'a finite open interval'}. Inspect every Routh condition.` };
  if (answer.kind !== 'finite') return { correct: true, message: 'Your gain-set prediction agrees.' };
  if (![answer.lower, answer.upper].every(Number.isFinite) || answer.lower >= answer.upper) throw new Error('Enter finite increasing predicted endpoints.');
  if (answer.lowerClosed || answer.upperClosed) return { correct: false, message: 'Strict stability excludes both endpoints. An imaginary-axis root cannot be included.' };
  const lower = numberOf(expected.lower!), upper = numberOf(expected.upper!);
  const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
  const correct = close(answer.lower, lower) && close(answer.upper, upper);
  return { correct, message: correct ? 'Your open interval agrees (endpoint comparison tolerance 10⁻⁶ relative to at least 1).' : 'The endpoint values differ. Solve both affine conditions and intersect them.' };
}
