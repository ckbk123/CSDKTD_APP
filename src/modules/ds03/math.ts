/** Local degree-two mathematics. All coordinates and K are dimensionless. */
export interface Affine { readonly slope: number; readonly constant: number }
export interface Family { readonly b: Affine; readonly c: Affine }
export interface Complex { readonly re: number; readonly im: number }
export interface Interval { readonly lower: number; readonly upper: number; readonly empty: boolean }
export const BASELINE = String.raw`P(z)=z^2+(K-1)z+0.2K`;
export const VARIANT = String.raw`P(z)=z^2+(K-1)z+0.1K`;
// Six coefficients: z^i K^j, i=0..2, j=0..1. Never an executable expression.
type Polynomial = number[];
const scalar = (n: number): Polynomial => [n, 0, 0, 0, 0, 0];
const add = (a: Polynomial, b: Polynomial, sign = 1): Polynomial => a.map((v, i) => v + sign * b[i]);
function multiply(a: Polynomial, b: Polynomial): Polynomial {
  const out = scalar(0);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
    if (!a[i] || !b[j]) continue;
    const z = Math.floor(i / 2) + Math.floor(j / 2), k = i % 2 + j % 2;
    if (z > 2 || k > 1) throw new Error('Use degree at most two in z and at most one in K; nonlinear gain terms are unsupported.');
    out[2 * z + k] += a[i] * b[j];
  }
  if (out.some(v => !Number.isFinite(v) || Math.abs(v) > 1e6)) throw new Error('Intermediate coefficients are too large.');
  return out;
}

/** Bounded textbook polynomial grammar, independent of MathLive's syntax checks. */
export function parseFamily(latex: string): Family {
  if (!latex.trim()) throw new Error('Enter a characteristic polynomial.');
  if (latex.length > 300) throw new Error('Keep the polynomial within 300 characters.');
  let source = latex.replace(/\\(?:left|right)\b/g, '').replace(/\\(?:cdot|times)/g, '*')
    .replace(/\\[,!; ]/g, '').replace(/\s/g, '').replace(/^P\(z\)=/, '');
  source = source.replace(/\\(?:dfrac|frac)\{([+-]?(?:\d*\.)?\d+)\}\{([+-]?(?:\d*\.)?\d+)\}/g, '(($1)/($2))')
    .replace(/\^\{([012])\}/g, '^$1').replace(/\{/g, '(').replace(/\}/g, ')');
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[zK()+\-*/^]/g) ?? [];
  if (tokens.join('') !== source || !tokens.length) throw new Error('Use only z, K, decimal numbers, +, −, products, numeric fractions and squares.');
  if (tokens.length > 160) throw new Error('Too many terms; simplify the polynomial first.');
  let at = 0, depth = 0;
  const peek = () => tokens[at];
  function atom(): Polynomial {
    if (++depth > 12) throw new Error('Use at most 12 nested groups.');
    const token = tokens[at++];
    let result: Polynomial;
    if (token === '(') {
      result = sum();
      if (tokens[at++] !== ')') throw new Error('Close each parenthesis and complete every term.');
    } else if (token === 'z') result = [0, 0, 1, 0, 0, 0];
    else if (token === 'K') result = [0, 1, 0, 0, 0, 0];
    else if (token && /^(?:\d|\.)/.test(token)) result = scalar(Number(token));
    else throw new Error('Complete each term with a number, z, K or a parenthesized expression.');
    depth--;
    if (peek() === '^') {
      at++;
      const exponent = tokens[at++];
      if (!['0', '1', '2'].includes(exponent)) throw new Error('Only powers 0, 1 and 2 are supported.');
      result = exponent === '0' ? scalar(1) : exponent === '1' ? result : multiply(result, result);
    }
    return result;
  }
  function signed(): Polynomial {
    if (peek() === '+' || peek() === '-') { const sign = tokens[at++] === '-' ? -1 : 1; return signed().map(v => sign * v); }
    return atom();
  }
  function product(): Polynomial {
    let result = signed();
    while (at < tokens.length) {
      const token = peek();
      if (token === '/') {
        at++; const divisor = signed();
        if (divisor.slice(1).some(v => v !== 0) || divisor[0] === 0) throw new Error('Divide only by a nonzero numeric constant. Enter a polynomial, not a transfer function.');
        result = result.map(v => v / divisor[0]);
      } else if (token === '*' || token === '(' || token === 'z' || token === 'K' || /^(?:\d|\.)/.test(token)) {
        if (token === '*') at++;
        result = multiply(result, signed());
      } else break;
    }
    return result;
  }
  function sum(): Polynomial {
    let result = product();
    while (peek() === '+' || peek() === '-') { const sign = tokens[at++] === '+' ? 1 : -1; result = add(result, product(), sign); }
    return result;
  }
  const p = sum();
  if (at !== tokens.length) throw new Error('Check parentheses and operators.');
  if (p.some(v => !Number.isFinite(v) || Math.abs(v) > 100 || (v !== 0 && Math.abs(v) < 1e-8))) throw new Error('Each nonzero coefficient must have magnitude from 0.00000001 to 100.');
  if (p[4] !== 1 || p[5] !== 0) throw new Error('Enter a monic quadratic: z² + (aK+b)z + cK+d. The z² coefficient must be exactly 1.');
  return { b: { slope: p[3], constant: p[2] }, c: { slope: p[1], constant: p[0] } };
}

export const evaluate = (a: Affine, k: number): number => a.slope * k + a.constant;
export function transform(f: Family): readonly [Affine, Affine, Affine] {
  return [
    { slope: -f.b.slope + f.c.slope, constant: 1 - f.b.constant + f.c.constant },
    { slope: -2 * f.c.slope, constant: 2 - 2 * f.c.constant },
    { slope: f.b.slope + f.c.slope, constant: 1 + f.b.constant + f.c.constant },
  ];
}
/** Intersection of strict affine inequalities; this is not a sampled gain sweep. */
export function stableInterval(f: Family): Interval {
  let lower = -Infinity, upper = Infinity;
  for (const a of transform(f)) {
    if (a.slope === 0) { if (a.constant <= 0) return { lower, upper, empty: true }; }
    else if (a.slope > 0) lower = Math.max(lower, -a.constant / a.slope);
    else upper = Math.min(upper, -a.constant / a.slope);
  }
  return { lower, upper, empty: lower >= upper };
}
export function roots(b: number, c: number): readonly [Complex, Complex] {
  const discriminant = b * b - 4 * c;
  if (discriminant < 0) return [{ re: -b / 2, im: Math.sqrt(-discriminant) / 2 }, { re: -b / 2, im: -Math.sqrt(-discriminant) / 2 }];
  const q = -0.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant));
  return q === 0 ? [{ re: 0, im: 0 }, { re: 0, im: 0 }] : [{ re: q, im: 0 }, { re: c / q, im: 0 }];
}
/** null denotes the point at infinity. Near the pole is reported separately in UI. */
export function mapToW(z: Complex): Complex | null {
  const a = z.re + 1, b = z.im, c = z.re - 1;
  if (a === 0 && b === 0) return null;
  // Divide (c+jb)/(a+jb) using the larger denominator component. Expanding
  // re²+im²−1 loses im² near z=−1, incorrectly moving points onto the boundary.
  if (Math.abs(a) >= Math.abs(b)) {
    const ratio = b / a, denominator = a + b * ratio;
    return { re: (c + b * ratio) / denominator, im: (b - c * ratio) / denominator };
  }
  const ratio = a / b, denominator = b + a * ratio;
  return { re: (c * ratio + b) / denominator, im: (b * ratio - c) / denominator };
}
export function analyze(f: Family, k: number) {
  if (!Number.isFinite(k) || Math.abs(k) > 100) throw new Error('Choose a finite gain K between −100 and 100.');
  const b = evaluate(f.b, k), c = evaluate(f.c, k);
  const zRoots = roots(b, c), radius = zRoots.map(z => Math.hypot(z.re, z.im));
  const abc = transform(f).map(a => evaluate(a, k));
  const tolerance = 1e-9 * Math.max(1, ...abc.map(Math.abs));
  const classification = radius.some(r => r > 1 + 1e-8) ? 'unstable'
    : radius.some(r => r >= 1 - 1e-8) ? 'boundary or within numerical tolerance' : 'strictly stable';
  const special = Math.abs(abc[0]) <= tolerance ? 'degree-loss'
    : Math.abs(abc[1]) <= tolerance ? 'zero-row'
    : Math.abs(abc[2]) <= tolerance ? 'zero-constant' : 'regular';
  // Sign variations are meaningful only away from singular rows/near-zero values.
  const signChanges = special !== 'regular' ? null : abc.slice(1).filter((v, i) => v * abc[i] < 0).length;
  return { b, c, abc, zRoots, wRoots: zRoots.map(mapToW), radius, classification, special, signChanges, tolerance };
}
