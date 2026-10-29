/** Local, bounded quadratic feedback mathematics; coefficient order is ascending. */
export interface Rational { readonly n: bigint; readonly d: bigint }
const abs = (n: bigint) => n < 0n ? -n : n;
export function rational(n: bigint | number, d: bigint | number = 1): Rational {
  let a = BigInt(n), b = BigInt(d);
  if (b === 0n) throw new Error('A numeric denominator cannot be zero.');
  if (b < 0n) { a = -a; b = -b; }
  if (abs(a).toString(2).length > 2048 || b.toString(2).length > 2048) throw new Error('Exact arithmetic exceeded its precision limit; simplify the coefficients.');
  let x = abs(a), y = b;
  while (y) { const remainder = x % y; x = y; y = remainder; }
  return { n: a / x, d: b / x };
}
export const ZERO = rational(0), ONE = rational(1);
export const plus = (a: Rational, b: Rational): Rational => rational(a.n * b.d + b.n * a.d, a.d * b.d);
export const minus = (a: Rational, b: Rational): Rational => rational(a.n * b.d - b.n * a.d, a.d * b.d);
export const times = (a: Rational, b: Rational): Rational => rational(a.n * b.n, a.d * b.d);
export const divide = (a: Rational, b: Rational): Rational => rational(a.n * b.d, a.d * b.n);
export const negative = (a: Rational): Rational => rational(-a.n, a.d);
export const compare = (a: Rational, b: Rational): number => Math.sign(Number(a.n * b.d - b.n * a.d));
export const numberOf = (a: Rational): number => Number(a.n) / Number(a.d);
export const exactText = (a: Rational): string => a.d === 1n ? String(a.n) : `${a.n}/${a.d}`;
export const exactLatex = (a: Rational): string => a.d === 1n ? String(a.n) : `${a.n < 0n ? '-' : ''}\\frac{${abs(a.n)}}{${a.d}}`;
export type Polynomial = readonly [Rational, Rational, Rational];
const constant = (q: Rational): Polynomial => [q, ZERO, ZERO];
function addPoly(a: Polynomial, b: Polynomial, sign = 1): Polynomial {
  return a.map((q, i) => sign === 1 ? plus(q, b[i]) : minus(q, b[i])) as unknown as Polynomial;
}
function multiplyPoly(a: Polynomial, b: Polynomial): Polynomial {
  const out = [ZERO, ZERO, ZERO];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    if (!a[i].n || !b[j].n) continue;
    if (i + j > 2) throw new Error('Use polynomials of degree at most two in z.');
    out[i + j] = plus(out[i + j], times(a[i], b[j]));
  }
  return out as unknown as Polynomial;
}
function decimal(token: string): Rational {
  const [whole, fraction = ''] = token.split('.');
  if (fraction.length > 6 || token.replace('.', '').length > 9) throw new Error('Use at most six decimal places and nine digits per numeric literal.');
  return rational(BigInt((whole || '0') + fraction), 10n ** BigInt(fraction.length));
}
/** Textbook polynomial entry; numeric fractions include MathLive's \frac12. */
export function parsePolynomial(latex: string): Polynomial {
  if (!latex.trim() || latex.length > 300) throw new Error('Enter a polynomial using at most 300 characters.');
  let source = latex.replace(/\\(?:left|right)\b/g, '').replace(/\\(?:cdot|times)/g, '*').replace(/\\[,!; ]/g, '').replace(/\s/g, '').replace(/^[ND]\(z\)=/, '');
  // Keep each numeric fraction and each power opaque while checking adjacency.
  // Invisible braces/spaces cannot turn a displayed mixed number into a product.
  const adjacency = source.replace(/\^\{[012]\}|\^[012]/g, '^p').replace(/\\(?:dfrac|frac)(?:\{([+-]?(?:\d+(?:\.\d*)?|\.\d+))\}|(\d))(?:\{([+-]?(?:\d+(?:\.\d*)?|\.\d+))\}|(\d))/g, '@');
  if (/[{}]/.test(adjacency)) throw new Error('Use visible parentheses for grouped terms; fraction boxes accept numbers only. Insert + or × between a whole number and fraction.');
  if (/\d\.?@/.test(adjacency)) throw new Error('Mixed numbers are unsupported here. Insert + or × between the whole number and fraction.');
  source = source.replace(/\\(?:dfrac|frac)(?:\{([+-]?(?:\d+(?:\.\d*)?|\.\d+))\}|(\d))(?:\{([+-]?(?:\d+(?:\.\d*)?|\.\d+))\}|(\d))/g,
    (_all, n, nd, d, dd) => `((${n ?? nd})/(${d ?? dd}))`).replace(/\^\{([012])\}/g, '^$1').replace(/\{/g, '(').replace(/\}/g, ')');
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[z()+\-*/^]/g) ?? [];
  if (!tokens.length || tokens.join('') !== source) throw new Error('Use z, decimal numbers, parentheses, products, squares and numeric fractions. Gain K has its own control.');
  if (tokens.length > 160) throw new Error('Use at most 160 tokens.');
  let at = 0, depth = 0;
  function atom(): Polynomial {
    if (++depth > 12) throw new Error('Use at most 12 nested groups.');
    const token = tokens[at++]; let out: Polynomial;
    if (token === '(') { out = sum(); if (tokens[at++] !== ')') throw new Error('Close every parenthesis and complete each term.'); }
    else if (token === 'z') out = [ZERO, ONE, ZERO];
    else if (token && /^(?:\d|\.)/.test(token)) out = constant(decimal(token));
    else throw new Error('Complete the polynomial with a number, z or a parenthesized term.');
    depth--;
    if (tokens[at] === '^') {
      at++; const power = tokens[at++];
      if (!['0', '1', '2'].includes(power)) throw new Error('Only powers 0, 1 and 2 are supported.');
      out = power === '0' ? constant(ONE) : power === '1' ? out : multiplyPoly(out, out);
    }
    return out;
  }
  function signed(): Polynomial {
    if (tokens[at] === '+' || tokens[at] === '-') { const sign = tokens[at++] === '-' ? -1 : 1; const p = signed(); return sign === 1 ? p : p.map(negative) as unknown as Polynomial; }
    return atom();
  }
  function product(): Polynomial {
    let out = signed();
    while (at < tokens.length) {
      const next = tokens[at];
      if (next === '/') {
        at++; const divisor = signed();
        if (divisor[1].n || divisor[2].n || !divisor[0].n) throw new Error('Divide only by a nonzero numeric constant; enter N and D separately.');
        out = out.map(q => divide(q, divisor[0])) as unknown as Polynomial;
      } else if (next === '*' || next === '(' || next === 'z' || /^(?:\d|\.)/.test(next)) {
        if (next === '*') at++; out = multiplyPoly(out, signed());
      } else break;
    }
    return out;
  }
  function sum(): Polynomial {
    let out = product();
    while (tokens[at] === '+' || tokens[at] === '-') { const sign = tokens[at++] === '+' ? 1 : -1; out = addPoly(out, product(), sign); }
    return out;
  }
  const p = sum();
  if (at !== tokens.length) throw new Error('Check operators and parentheses.');
  if (p.some(q => abs(q.n) > 1_000_000_000_000n || q.d > 1_000_000_000_000n)) throw new Error('Simplify coefficient fractions: reduced numerators and denominators must be at most 1000000000000.');
  if (p.some(q => Math.abs(numberOf(q)) > 100 || (q.n !== 0n && Math.abs(numberOf(q)) < 1e-8))) throw new Error('Final nonzero coefficient magnitudes must be from 0.00000001 through 100.');
  return p;
}
export interface Model { readonly numerator: Polynomial; readonly denominator: Polynomial }
export function parseModel(numerator: string, denominator: string): Model {
  const n = parsePolynomial(numerator), d = parsePolynomial(denominator);
  if (compare(d[2], ONE) !== 0) throw new Error('D must be a monic quadratic with z² coefficient exactly 1.');
  return { numerator: n, denominator: d };
}
export interface Affine { readonly constant: Rational; readonly slope: Rational }
export const atGain = (a: Affine, k: Rational): Rational => plus(a.constant, times(a.slope, k));
export function constraints(model: Model) {
  const n = model.numerator, d = model.denominator;
  return [
    { name: 'a', constant: d[2], slope: n[2] },
    { name: 'P(+1)', constant: plus(plus(d[2], d[1]), d[0]), slope: plus(plus(n[2], n[1]), n[0]) },
    { name: 'P(-1)', constant: plus(minus(d[2], d[1]), d[0]), slope: plus(minus(n[2], n[1]), n[0]) },
    { name: 'a-c', constant: minus(d[2], d[0]), slope: minus(n[2], n[0]) },
  ];
}
export interface GainRegion { readonly lower: Rational | null; readonly upper: Rational | null; readonly probe: Rational; readonly stable: boolean; readonly signs: readonly number[] }
/** Complete partition of real K: all relevant affine signs are constant in each open cell. */
export function gainRegions(model: Model) {
  const conditions = constraints(model);
  const critical = conditions.filter(q => q.slope.n !== 0n).map(q => divide(negative(q.constant), q.slope)).sort(compare).filter((k, i, all) => i === 0 || compare(k, all[i - 1]) !== 0);
  const regions: GainRegion[] = [];
  for (let i = 0; i <= critical.length; i++) {
    const lower = i === 0 ? null : critical[i - 1], upper = i === critical.length ? null : critical[i];
    const probe = lower && upper ? divide(plus(lower, upper), rational(2)) : lower ? plus(lower, ONE) : upper ? minus(upper, ONE) : ZERO;
    const signs = conditions.map(q => compare(atGain(q, probe), ZERO));
    regions.push({ lower, upper, probe, signs, stable: signs[0] !== 0 && signs.slice(1).every(s => s === signs[0]) });
  }
  return { critical, regions, stable: regions.filter(r => r.stable), identities: conditions.filter(q => !q.constant.n && !q.slope.n).map(q => q.name) };
}
export interface Complex { readonly re: number; readonly im: number }
export function polynomialRoots(a: number, b: number, c: number, exactNormalizedDiscriminant?: number) {
  if (a === 0) return b !== 0 ? { finite: [{ re: -c / b, im: 0 }], atInfinity: 1, identicallyZero: false }
    : { finite: [], atInfinity: c === 0 ? 0 : 2, identicallyZero: c === 0 };
  b /= a; c /= a;
  const discriminant = exactNormalizedDiscriminant ?? b * b - 4 * c;
  if (!Number.isFinite(discriminant)) throw new Error('The numerical roots exceed the conditioning limit; choose a gain farther from the algebraic singularity.');
  if (discriminant < 0) return { finite: [{ re: -b / 2, im: Math.sqrt(-discriminant) / 2 }, { re: -b / 2, im: -Math.sqrt(-discriminant) / 2 }], atInfinity: 0, identicallyZero: false };
  const q = -.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant));
  return { finite: q === 0 ? [{ re: 0, im: 0 }, { re: 0, im: 0 }] : [{ re: q, im: 0 }, { re: c / q, im: 0 }], atInfinity: 0, identicallyZero: false };
}
export function analyze(model: Model, gain: number | Rational) {
  if (typeof gain === 'number' && (!Number.isFinite(gain) || Math.abs(gain) > 100)) throw new Error('Choose a finite K in [-100,100].');
  let k: Rational;
  if (typeof gain === 'number') {
    const [mantissa, exponent = '0'] = String(gain).split('e'), places = (mantissa.split('.')[1]?.length ?? 0) - Number(exponent);
    const digits = BigInt(mantissa.replace('.', ''));
    k = places >= 0 ? rational(digits, 10n ** BigInt(places)) : rational(digits * 10n ** BigInt(-places));
  } else k = gain;
  const exact = model.denominator.map((d, i) => plus(d, times(k, model.numerator[i])));
  const [c, b, a] = exact.map(numberOf);
  // Form b²−4ac exactly before conversion, preserving nearby/repeated modes.
  const discriminant = exact[2].n ? numberOf(divide(minus(times(exact[1], exact[1]), times(rational(4), times(exact[2], exact[0]))), times(exact[2], exact[2]))) : undefined;
  const roots = polynomialRoots(a, b, c, discriminant), radii = roots.finite.map(z => Math.hypot(z.re, z.im));
  const classification = a === 0 ? 'algebraically singular feedback' : radii.some(r => r > 1 + 1e-8) ? 'unstable' : radii.some(r => r >= 1 - 1e-8) ? 'boundary or within numerical tolerance' : 'strictly stable';
  return { a, b, c, roots, radii, classification, nearSingular: a !== 0 && Math.abs(a) < 1e-10 * Math.max(1, Math.abs(b), Math.abs(c)) };
}
export function boundaryInfo(model: Model, gain: Rational) {
  const values = constraints(model).map(q => atGain(q, gain));
  const result = analyze(model, gain), kinds: string[] = [];
  if (!values[0].n) kinds.push('algebraic singularity (a=0)');
  if (!values[1].n) kinds.push('z=+1');
  if (!values[2].n) kinds.push('z=-1');
  let angle: number | null = null;
  if (!values[3].n && values[0].n) {
    const ratio = divide(negative(plus(model.denominator[1], times(gain, model.numerator[1]))), times(rational(2), values[0]));
    if (compare(ratio, negative(ONE)) > 0 && compare(ratio, ONE) < 0) {
      angle = 2 * Math.atan2(Math.sqrt(numberOf(minus(ONE, ratio))), Math.sqrt(numberOf(plus(ONE, ratio))));
      kinds.push('complex conjugate unit-circle pair');
    }
    else if (compare(ratio, negative(ONE)) !== 0 && compare(ratio, ONE) !== 0) kinds.push('a=c equality; no complex unit-circle pair');
  }
  return { ...result, kinds, angle };
}
/** Bounded sampled locus with nearest-pair continuation, never a stability proof. */
export function sampleLocus(model: Model, minimum: number, maximum: number, count = 401) {
  if (![minimum, maximum].every(v => Number.isFinite(v) && Math.abs(v) <= 100) || maximum <= minimum || count < 3 || count > 1001 || !Number.isInteger(count)) throw new Error('Use -100<=Kmin<Kmax<=100 and 3..1001 samples.');
  const branches: (Complex | null)[][] = [[], []]; let previous: Complex[] | null = null, previousA = 0;
  const distance = (a: Complex, b: Complex) => Math.hypot(a.re - b.re, a.im - b.im);
  for (let i = 0; i < count; i++) {
    const k = minimum + (maximum - minimum) * i / (count - 1), r = analyze(model, k);
    if (r.a === 0 || previousA * r.a < 0) { branches.forEach(b => b.push(null)); previous = null; }
    previousA = r.a;
    if (r.a === 0) continue;
    const pair = [...r.roots.finite];
    if (previous && distance(previous[0], pair[1]) + distance(previous[1], pair[0]) < distance(previous[0], pair[0]) + distance(previous[1], pair[1])) pair.reverse();
    branches[0].push(pair[0]); branches[1].push(pair[1]); previous = pair;
  }
  return branches;
}
