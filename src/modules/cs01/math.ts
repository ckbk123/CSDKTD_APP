import { rejectSpacingArguments } from '../../shared/tex-arguments';

/** Bounded exact algebra for a real two-state continuous-time SISO realization. */
export interface Rational { readonly n: bigint; readonly d: bigint }
const gcdInt = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a; b = b < 0n ? -b : b;
  while (b) { const next = a % b; a = b; b = next; }
  return a;
};
export function rat(n: bigint, d = 1n): Rational {
  if (!d) throw new Error('A fraction denominator cannot be zero.');
  const g = gcdInt(n, d); const sign = d < 0n ? -1n : 1n;
  return { n: sign * n / g, d: sign * d / g };
}
const zero = rat(0n), one = rat(1n);
export const add = (a: Rational, b: Rational): Rational => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const neg = (a: Rational): Rational => rat(-a.n, a.d);
export const sub = (a: Rational, b: Rational): Rational => add(a, neg(b));
export const mul = (a: Rational, b: Rational): Rational => rat(a.n * b.n, a.d * b.d);
const div = (a: Rational, b: Rational): Rational => rat(a.n * b.d, a.d * b.n);
export const num = (a: Rational): number => Number(a.n) / Number(a.d);
const sign = (a: Rational): number => a.n < 0n ? -1 : a.n > 0n ? 1 : 0;
export const equal = (a: Rational, b: Rational): boolean => a.n === b.n && a.d === b.d;
export const textRat = (a: Rational): string => a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`;
export const latexRat = (a: Rational): string => a.d === 1n ? `${a.n}` : `${a.n < 0n ? '-' : ''}\\frac{${a.n < 0n ? -a.n : a.n}}{${a.d}}`;

function decimal(source: string): Rational {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(source) || source.replace(/\D/g, '').length > 12) {
    throw new Error('Use a signed integer, decimal (at most 9 decimal places), or a fraction of decimals.');
  }
  const negative = source.startsWith('-'); const unsigned = source.replace(/^[+-]/, '');
  const [whole, tail = ''] = unsigned.split('.');
  if (tail.length > 9) throw new Error('Use at most 9 decimal places.');
  return rat(BigInt((whole || '0') + tail) * (negative ? -1n : 1n), 10n ** BigInt(tail.length));
}

export function parseScalar(source: string): Rational {
  rejectSpacingArguments(source);
  const s = source.replace(/\s|\\[,;!]/g, '').replace(/−/g, '-').replace(/\\(?:dfrac|tfrac)/g, '\\frac');
  if (!s || s.length > 90) throw new Error('Enter one bounded real number.');
  // MathLive may serialize single-digit fraction arguments without braces.
  const fraction = /^([+-]?)\\frac(\{[^{}]+\}|\d)(\{[^{}]+\}|\d)$/.exec(s);
  const slash = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\/([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/.exec(s);
  let value: Rational;
  if (fraction) {
    const argument = (value: string): string => value.startsWith('{') ? value.slice(1, -1) : value;
    value = div(decimal(argument(fraction[2])), decimal(argument(fraction[3])));
    if (fraction[1] === '-') value = neg(value);
  } else if (slash) value = div(decimal(slash[1]), decimal(slash[2]));
  else value = decimal(s);
  if (Math.abs(num(value)) > 100 || value.d > 1000000000n) {
    throw new Error('Each entry must have magnitude at most 100 and reduced denominator at most 1,000,000,000.');
  }
  return value;
}

export function parseMatrix(source: string, rows: number, columns: number, name: string): Rational[][] {
  if (!source.trim() || source.length > 512) throw new Error(`${name}: enter a ${rows} by ${columns} matrix (at most 512 characters).`);
  rejectSpacingArguments(source);
  const clean = source.replace(new RegExp(`^\\s*${name}\\s*=`), '').replace(/\\(?:left|right)/g, '').trim();
  const match = /^(?:\[|\()?\\begin\{(bmatrix|pmatrix|matrix)\}([\s\S]*)\\end\{\1\}(?:\]|\))?$/.exec(clean);
  if (!match) throw new Error(`${name}: keep the displayed matrix and edit its numeric entries.`);
  const cells = match[2].split(/\\\\/).map(row => row.split('&'));
  if (cells.length !== rows || cells.some(row => row.length !== columns)) throw new Error(`${name} must be ${rows} by ${columns}.`);
  return cells.map(row => row.map(parseScalar));
}

export interface Model { readonly a: Rational[][]; readonly b: Rational[]; readonly c: Rational[]; readonly d: Rational }
export function parseModel(a: string, b: string, c: string, d: string): Model {
  return { a: parseMatrix(a, 2, 2, 'A'), b: parseMatrix(b, 2, 1, 'B').map(row => row[0]),
    c: parseMatrix(c, 1, 2, 'C')[0], d: parseScalar(d.replace(/^\s*D\s*=/, '')) };
}

// Coefficients are in ascending powers internally. No approximate cancellation.
type Poly = Rational[];
function trim(p: Poly): Poly { while (p.length > 1 && !p[p.length - 1].n) p.pop(); return p; }
function dividePoly(a: Poly, b: Poly): { q: Poly; r: Poly } {
  const r = [...a], q = Array.from({ length: Math.max(1, a.length - b.length + 1) }, () => zero);
  while (r.length >= b.length && r.some(x => x.n)) {
    const k = r.length - b.length, factor = div(r[r.length - 1], b[b.length - 1]); q[k] = factor;
    for (let j = 0; j < b.length; j++) r[k + j] = sub(r[k + j], mul(factor, b[j]));
    trim(r);
  }
  return { q: trim(q), r: trim(r) };
}
function gcdPoly(a: Poly, b: Poly): Poly {
  while (b.some(x => x.n)) { const r = dividePoly(a, b).r; a = b; b = r; }
  const lead = a[a.length - 1]; return a.map(x => div(x, lead));
}
export function polynomialLatex(p: readonly Rational[]): string {
  let result = '';
  for (let k = p.length - 1; k >= 0; k--) {
    const x = p[k]; if (!x.n) continue;
    const positive = x.n > 0n, magnitude = positive ? x : neg(x);
    result += positive ? (result ? '+' : '') : '-';
    result += k && equal(magnitude, one) ? '' : latexRat(magnitude);
    result += k === 1 ? 's' : k > 1 ? `s^{${k}}` : '';
  }
  return result || '0';
}

export interface Root { readonly re: number; readonly im: number; readonly multiplicity: number }
export function roots(p: readonly Rational[]): Root[] {
  if (p.length === 1) return [];
  if (p.length === 2) return [{ re: num(neg(div(p[0], p[1]))), im: 0, multiplicity: 1 }];
  const b = div(p[1], p[2]), c = div(p[0], p[2]);
  const disc = sub(mul(b, b), mul(rat(4n), c)); const center = -num(b) / 2;
  if (!disc.n) return [{ re: center, im: 0, multiplicity: 2 }];
  if (disc.n < 0n) { const w = Math.sqrt(-num(disc)) / 2; return [{ re: center, im: w, multiplicity: 1 }, { re: center, im: -w, multiplicity: 1 }]; }
  // Stable quadratic evaluation preserves a small nonzero real root.
  const q = -0.5 * (num(b) + (num(b) >= 0 ? 1 : -1) * Math.sqrt(num(disc)));
  return [{ re: q, im: 0, multiplicity: 1 }, { re: num(c) / q, im: 0, multiplicity: 1 }];
}
export type FreeClass = 'asymptotically stable' | 'bounded, not asymptotic' | 'unstable';
export interface Analysis {
  readonly denominator: Poly; readonly numerator: Poly; readonly reducedDenominator: Poly; readonly reducedNumerator: Poly;
  readonly cancellation: Poly; readonly eigenvalues: Root[]; readonly poles: Root[];
  readonly freeClass: FreeClass; readonly bibo: boolean; readonly defective: boolean;
  readonly reason: string;
}
export function analyze(model: Model): Analysis {
  const { a, b, c, d } = model;
  const trace = add(a[0][0], a[1][1]); const determinant = sub(mul(a[0][0], a[1][1]), mul(a[0][1], a[1][0]));
  const denominator = [determinant, neg(trace), one];
  const cb = add(mul(c[0], b[0]), mul(c[1], b[1]));
  const adjConstant = add(mul(c[0], sub(mul(a[0][1], b[1]), mul(a[1][1], b[0]))),
    mul(c[1], sub(mul(a[1][0], b[0]), mul(a[0][0], b[1]))));
  const numerator = trim([add(mul(d, determinant), adjConstant), add(neg(mul(d, trace)), cb), d]);
  const cancellation = gcdPoly(denominator, numerator);
  const reducedDenominator = dividePoly(denominator, cancellation).q;
  const reducedNumerator = dividePoly(numerator, cancellation).q;
  const discriminant = sub(mul(trace, trace), mul(rat(4n), determinant));
  const repeated = !discriminant.n;
  const scalarMatrix = !a[0][1].n && !a[1][0].n && equal(a[0][0], a[1][1]);
  const defective = repeated && !scalarMatrix;
  let freeClass: FreeClass, reason: string;
  if (sign(trace) < 0 && sign(determinant) > 0) {
    freeClass = 'asymptotically stable'; reason = 'All eigenvalues have strictly negative real part; every zero-input state tends to zero.';
  } else if (sign(determinant) < 0 || sign(trace) > 0 || (sign(trace) === 0 && sign(determinant) === 0 && defective)) {
    freeClass = 'unstable'; reason = sign(determinant) < 0 || sign(trace) > 0
      ? 'At least one eigenvalue has positive real part; some zero-input states grow.'
      : 'A nonzero nilpotent Jordan block gives x(t)=(I+tA)x(0); some zero-input states grow linearly.';
  } else {
    freeClass = 'bounded, not asymptotic'; reason = sign(determinant) > 0
      ? 'A simple imaginary pair gives bounded oscillation without decay. Resonant forcing can still grow.'
      : 'Zero eigenvalues are semisimple. Free states are bounded, but some do not decay.';
  }
  const rd = reducedDenominator;
  const bibo = rd.length === 1 || (rd.length === 2 ? sign(rd[0]) * sign(rd[1]) > 0 : sign(rd[1]) > 0 && sign(rd[0]) > 0);
  return { denominator, numerator, reducedDenominator, reducedNumerator, cancellation,
    eigenvalues: roots(denominator), poles: roots(reducedDenominator), freeClass, bibo, defective, reason };
}

/** Native controls arrive as numbers; retain their finite decimal serialization
 * during projection, including exponent notation outside the visual grammar. */
function initialRational(value: number): Rational {
  const [mantissa, exponent = '0'] = value.toString().split('e');
  const [integer, fraction = ''] = mantissa.split('.');
  const digits = BigInt(integer + fraction), scale = fraction.length - Number(exponent);
  return scale < 0 ? rat(digits * 10n ** BigInt(-scale)) : rat(digits, 10n ** BigInt(scale));
}
function exactSquareRoot(value: Rational): Rational | undefined {
  function root(n: bigint): bigint | undefined {
    if (n < 0n) return undefined;
    if (n < 2n) return n;
    let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
    for (;;) { const next = (x + n / x) / 2n; if (next >= x) return x * x === n ? x : undefined; x = next; }
  }
  const numerator = root(value.n), denominator = root(value.d);
  return numerator === undefined || denominator === undefined ? undefined : rat(numerator, denominator);
}
const conditioningMessage = 'The free-response projection is too ill-conditioned for a reliable numerical trace. Classification is still valid; change the initial state or inspect an earlier time.';
/** Multiply only after exact zero has been decided. Log scaling also preserves a
 * tiny nonzero coefficient when exponential growth makes its term representable. */
function rationalExponential(coefficient: Rational, exponent: number): number {
  if (!coefficient.n) return 0;
  const value = num(coefficient), exponential = Math.exp(exponent), ordinary = value * exponential;
  if (Number.isFinite(value) && value !== 0 && exponential !== 0 && Number.isFinite(ordinary) && ordinary !== 0) return ordinary;
  const numerator = (coefficient.n < 0n ? -coefficient.n : coefficient.n).toString(), denominator = coefficient.d.toString();
  const mantissa = Number('0.' + numerator.slice(0, 17)) / Number('0.' + denominator.slice(0, 17));
  const logarithm = Math.log(mantissa) + (numerator.length - denominator.length) * Math.LN10 + exponent;
  const result = (coefficient.n < 0n ? -1 : 1) * Math.exp(logarithm);
  if (!Number.isFinite(result)) throw new Error(conditioningMessage);
  return result;
}
function checkedSum(first: number, second: number, error: number): number {
  const result = first + second;
  if (!Number.isFinite(result) || !Number.isFinite(error) || error > 1e-10 * Math.max(1, Math.abs(result))) throw new Error(conditioningMessage);
  return result;
}

/** e^(At)x, evaluated in closed form via Cayley-Hamilton; no time integration. */
export function stateAt(model: Model, initial: readonly number[], t: number): number[] {
  if (initial.length !== 2 || initial.some(x => !Number.isFinite(x) || Math.abs(x) > 100) || !Number.isFinite(t) || t < 0 || t > 30) {
    throw new Error('Use two initial states of magnitude at most 100 and a time between 0 and 30 s.');
  }
  if (t === 0) return [...initial];
  const a = model.a, centerExact = div(add(a[0][0], a[1][1]), rat(2n)), center = num(centerExact);
  const discriminant = add(mul(sub(model.a[0][0], model.a[1][1]), sub(model.a[0][0], model.a[1][1])), mul(rat(4n), mul(model.a[0][1], model.a[1][0])));
  const deltaExact = div(discriminant, rat(4n)), delta = num(deltaExact);
  const exactQ = delta > 0 ? exactSquareRoot(deltaExact) : undefined;
  const largest = exactQ ? num(add(centerExact, exactQ)) : center + (delta > 0 ? Math.sqrt(delta) : 0);
  if (largest * t > 40) throw new Error('This horizon exceeds the growth limit exp(40). Shorten the horizon; classification is still valid.');
  const x = initial.map(initialRational);
  const nx = [add(mul(sub(a[0][0], centerExact), x[0]), mul(a[0][1], x[1])),
    add(mul(a[1][0], x[0]), mul(sub(a[1][1], centerExact), x[1]))];
  if (!discriminant.n) {
    const time = initialRational(t);
    return x.map((value, i) => rationalExponential(add(value, mul(time, nx[i])), center * t));
  }
  const q = Math.sqrt(Math.abs(delta));
  if (delta > 0 && q * t >= 0.1) {
    if (exactQ) {
      const plusExponent = num(add(centerExact, exactQ)) * t, minusExponent = num(sub(centerExact, exactQ)) * t;
      return x.map((value, i) => {
        const projection = div(nx[i], exactQ);
        const plus = rationalExponential(div(add(value, projection), rat(2n)), plusExponent);
        const minus = rationalExponential(div(sub(value, projection), rat(2n)), minusExponent);
        const error = 32 * Number.EPSILON * ((1 + Math.abs(plusExponent)) * Math.abs(plus) + (1 + Math.abs(minusExponent)) * Math.abs(minus));
        return checkedSum(plus, minus, error);
      });
    }
    // Irrational projections cannot vanish for nonzero rational component data.
    // Refuse a rounded cancellation rather than silently deleting a fast mode.
    const plusExponent = (center + q) * t, minusExponent = (center - q) * t;
    const plusScale = Math.exp(plusExponent), minusScale = Math.exp(minusExponent);
    return initial.map((value, i) => {
      if (!x[i].n && !nx[i].n) return 0;
      const shifted = num(nx[i]);
      if (!Number.isFinite(shifted) || (nx[i].n !== 0n && shifted === 0)) throw new Error(conditioningMessage);
      const projection = shifted / q, plusCoefficient = (value + projection) / 2, minusCoefficient = (value - projection) / 2;
      if (!plusCoefficient || !minusCoefficient) throw new Error(conditioningMessage);
      const plus = plusCoefficient * plusScale, minus = minusCoefficient * minusScale;
      const projectionError = 16 * Number.EPSILON * (Math.abs(value) + Math.abs(projection));
      const error = projectionError * (plusScale + minusScale) + 32 * Number.EPSILON * (1 + Math.abs(center * t) + q * t) * (Math.abs(plus) + Math.abs(minus));
      return checkedSum(plus, minus, error);
    });
  }
  const scale = Math.exp(center * t), angle = q * t;
  const f = delta > 0 ? Math.cosh(angle) : Math.cos(angle), g = delta > 0 ? Math.sinh(angle) / q : Math.sin(angle) / q;
  const derivativeF = delta > 0 ? Math.sinh(angle) : Math.sin(angle), derivativeG = delta > 0 ? Math.cosh(angle) : Math.cos(angle);
  return initial.map((value, i) => {
    const shifted = num(nx[i]);
    if (!Number.isFinite(shifted) || (nx[i].n !== 0n && shifted === 0)) throw new Error(conditioningMessage);
    const first = scale * f * value, second = scale * g * shifted;
    const error = 32 * Number.EPSILON * ((1 + Math.abs(center * t)) * (Math.abs(first) + Math.abs(second))
      + scale * angle * (Math.abs(value * derivativeF) + Math.abs(shifted * derivativeG / q)));
    return checkedSum(first, second, error);
  });
}

/** Regular impulse response of the exactly reduced scalar channel, excluding D delta(t). */
export function impulseAt(analysis: Analysis, t: number): number {
  if (!Number.isFinite(t) || t < 0 || t > 30) throw new Error('Use a time from 0 to 30 s.');
  const d = analysis.reducedDenominator, n = analysis.reducedNumerator;
  if (d.length === 1) return 0;
  const remainder = dividePoly(n, d).r;
  if (d.length === 2) return num(div(remainder[0], d[1])) * modeAt(analysis.poles[0], false, t);
  const center = -num(d[1]) / (2 * num(d[2]));
  const n0 = num(div(remainder[0], d[2])), n1 = remainder[1] ? num(div(remainder[1], d[2])) : 0;
  const disc = sub(mul(d[1], d[1]), mul(rat(4n), mul(d[0], d[2])));
  const delta = num(disc) / (4 * num(d[2]) ** 2), q = Math.sqrt(Math.abs(delta));
  if ((center + (delta > 0 ? q : 0)) * t > 40) throw new Error('Shorten the horizon to keep impulse growth within exp(40).');
  if (!disc.n) return Math.exp(center * t) * (n1 + (n0 + n1 * center) * t);
  if (delta < 0) return Math.exp(center * t) * (n1 * Math.cos(q * t) + (n0 + n1 * center) * Math.sin(q * t) / q);
  const plus = Math.exp((center + q) * t), minus = Math.exp((center - q) * t);
  if (q * t >= 0.1) return ((n1 + (n0 + n1 * center) / q) * plus + (n1 - (n0 + n1 * center) / q) * minus) / 2;
  const f = (plus + minus) / 2, g = q * t < 0.1 ? Math.exp(center * t) * Math.sinh(q * t) / q : (plus - minus) / (2 * q);
  return n1 * f + (n0 + n1 * center) * g;
}

export function modeAt(root: Root, generalized: boolean, t: number): number {
  if (!Number.isFinite(t) || t < 0 || t > 30 || !Number.isFinite(root.re) || !Number.isFinite(root.im)) throw new Error('Unsupported mode or time.');
  if (root.re * t > 40) throw new Error('Shorten the horizon to keep modal growth within exp(40).');
  return Math.exp(root.re * t) * Math.cos(root.im * t) * (generalized ? t : 1);
}
