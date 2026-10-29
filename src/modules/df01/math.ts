/** Private bounded polynomial reader. Coefficients are ascending internally. */
export interface Transfer { a: number[]; b: number[] }
const fail = (message: string): never => { throw new Error(message); };
const trim = (p: number[]): number[] => {
  while (p.length > 1 && p[p.length - 1] === 0) p.pop();
  if (p.some(v => !Number.isFinite(v) || Math.abs(v) > 1e6)) fail('Keep polynomial coefficients finite and at most 1,000,000 in magnitude.');
  return p;
};
function add(a: number[], b: number[], sign = 1): number[] {
  return trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + sign * (b[i] ?? 0)));
}
function multiply(a: number[], b: number[]): number[] {
  if (a.length + b.length > 4) fail('Use polynomials of degree at most two, including intermediate products.');
  const out = Array(a.length + b.length - 1).fill(0) as number[];
  a.forEach((v, i) => b.forEach((w, j) => { out[i + j] += v * w; }));
  return trim(out);
}
function polynomial(source: string): number[] {
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|z|[()+*^\-]/g) ?? [];
  if (tokens.join('') !== source || tokens.length > 128) fail('Use real numbers, z, parentheses, +, −, products and powers 0, 1 or 2.');
  let at = 0;
  const peek = () => tokens[at];
  function atom(): number[] {
    let value: number[];
    const token = tokens[at++];
    if (token === '(') {
      value = sum();
      if (tokens[at++] !== ')') fail('Close each parenthesis.');
    } else if (token === 'z') value = [0, 1];
    else if (token && /^(?:\d|\.)/.test(token)) value = trim([Number(token)]);
    else return fail('Complete the polynomial; a coefficient or z is missing.');
    if (peek() === '^') {
      at++;
      const wrapped = peek() === '(';
      if (wrapped) at++;
      const exponent = tokens[at++];
      if (!['0', '1', '2'].includes(exponent)) fail('Only powers 0, 1 and 2 are supported.');
      if (wrapped && tokens[at++] !== ')') fail('Complete the power.');
      if (exponent === '0') value = [1];
      if (exponent === '2') value = multiply(value, value);
    }
    return value;
  }
  function unary(): number[] {
    if (peek() === '+' || peek() === '-') {
      const sign = tokens[at++] === '-' ? -1 : 1;
      return unary().map(v => sign * v);
    }
    return atom();
  }
  function product(): number[] {
    let value = unary();
    while (peek() === '*' || peek() === 'z' || peek() === '(' || /^(?:\d|\.)/.test(peek() ?? '')) {
      if (peek() === '*') at++;
      value = multiply(value, unary());
    }
    return value;
  }
  function sum(): number[] {
    let value = product();
    while (peek() === '+' || peek() === '-') {
      const sign = tokens[at++] === '-' ? -1 : 1;
      value = add(value, product(), sign);
    }
    return value;
  }
  const result = sum();
  if (at !== tokens.length) fail('Check polynomial parentheses and operators.');
  return result;
}
function unwrap(s: string): string {
  while (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0;
    let outer = true;
    for (let i = 0; i < s.length - 1; i++) {
      if (s[i] === '(') depth++;
      if (s[i] === ')') depth--;
      if (depth === 0) { outer = false; break; }
    }
    if (!outer) break;
    s = s.slice(1, -1);
  }
  return s;
}
export function parseTransfer(latex: string): Transfer {
  if (!latex.trim()) fail('Enter a transfer function.');
  if (latex.length > 512) fail('Keep the transfer function within 512 characters.');
  let s = latex.replace(/\\(?:left|right)/g, '').replace(/\\(?:,|;|!|quad|enspace)/g, '')
    .replace(/\\(?:cdot|times)/g, '*').replace(/\s/g, '').replace(/−/g, '-');
  s = s.replace(/^G\(z\)=/, '');
  if (s.startsWith('\\frac') || s.startsWith('\\dfrac')) {
    s = s.replace(/^\\d?frac/, '');
    function group(): string {
      if (!s.startsWith('{')) fail('Complete both boxes of the fraction.');
      let depth = 0;
      for (let i = 0; i < s.length; i++) {
        if (s[i] === '{') depth++;
        if (s[i] === '}' && --depth === 0) {
          const out = s.slice(1, i); s = s.slice(i + 1); return out;
        }
      }
      return fail('Complete both boxes of the fraction.');
    }
    const top = group(), bottom = group();
    if (s) fail('Enter one rational fraction with polynomial numerator and denominator.');
    s = `(${top})/(${bottom})`;
  }
  s = unwrap(s.replace(/{/g, '(').replace(/}/g, ')'));
  let depth = 0, slash = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    if (s[i] === ')') depth--;
    if (s[i] === '/' && depth === 0) {
      if (slash !== -1) fail('Use one fraction with polynomial numerator and denominator.');
      slash = i;
    }
  }
  if (slash < 0) fail('Enter a proper fraction in z, such as 0.2 divided by (z − 0.8).');
  const top = polynomial(s.slice(0, slash)), bottom = polynomial(s.slice(slash + 1));
  if (bottom.length < 2) fail('Use a denominator of degree one or two; it cannot be zero or constant.');
  if (top.length > bottom.length) fail('The numerator degree exceeds the denominator: future input is required. Use a causal proper transfer function.');
  const leading = bottom[bottom.length - 1];
  if (Math.abs(leading) < 1e-10) fail('The leading denominator coefficient is too small to normalize reliably.');
  const a = bottom.slice().reverse().map(v => v / leading);
  const b = Array(bottom.length - top.length).fill(0).concat(top.slice().reverse()).map(v => v / leading) as number[];
  if ([...a, ...b].some(v => Math.abs(v) > 1e6)) fail('Normalized coefficients must be at most 1,000,000.');
  return { a, b };
}

export interface Result {
  a: number[]; b: number[]; A: number[][]; B: number[]; C: number[]; D: number;
  samples: number[]; stateSamples: number[]; residual: number;
  finalValue: number; radius: number; bandWidth: number; tailBound: number | null;
  settling: number | null; peak: number; overshoot: number; peakEstablished: boolean;
  T: number; N: number; band: number;
}
function matrixProduct(a: number[][], b: number[][]): number[][] {
  return a.map(row => b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)));
}
const norm = (a: number[][]) => Math.max(...a.map(row => row.reduce((s, v) => s + Math.abs(v), 0)));
/** A block contraction bounds every future homogeneous output error.
 * For j=lm+r: ||A^j v||∞ <= ||A^r||∞ ||A^m||∞^l ||v||∞.
 * We require a 1e-8 contraction margin and inflate the bound for roundoff.
 */
function tailBound(a: number[], lastErrors: number[]): number | null {
  if (a.length === 2) return Math.abs(lastErrors[0]) * (1 + 1e-8);
  const A = [[-a[1], -a[2]], [1, 0]];
  let power = [[1, 0], [0, 1]], maxNorm = 1;
  for (let m = 1; m <= 4096; m++) {
    power = matrixProduct(power, A);
    const q = norm(power);
    if (!Number.isFinite(q) || q > 1e12) return null;
    if (q < 1 - 1e-8) return maxNorm * Math.max(...lastErrors.map(Math.abs)) * (1 + 1e-8);
    maxNorm = Math.max(maxNorm, q);
  }
  return null;
}
export function analyze(tf: Transfer, T: number, N: number, band: number): Result {
  const { a, b } = tf;
  if (![2, 3].includes(a.length) || b.length !== a.length || a[0] !== 1 || [...a, ...b].some(v => !Number.isFinite(v) || Math.abs(v) > 1e6)) fail('Use a normalized real proper transfer function of order one or two.');
  if (!Number.isFinite(T) || T < 1e-6 || T > 1000) fail('Sample period T must be between 0.000001 and 1000 seconds.');
  if (!Number.isInteger(N) || N < 2 || N > 500) fail('Last sample index N must be an integer from 2 to 500.');
  if (![0.02, 0.05].includes(band)) fail('Choose a 2% or 5% settling band.');
  const discriminant = a.length === 3 ? a[1] ** 2 - 4 * a[2] : 0;
  const radius = a.length === 2 ? Math.abs(a[1]) : discriminant < 0 ? Math.sqrt(a[2])
    : Math.max(Math.abs((-a[1] + Math.sqrt(discriminant)) / 2), Math.abs((-a[1] - Math.sqrt(discriminant)) / 2));
  if (radius >= 1 - 1e-9) fail('Every denominator pole must lie strictly inside the unit circle (radius < 1 − 10⁻⁹). No unstable pole is cancelled for this check.');
  const finalValue = b.reduce((s, v) => s + v, 0) / a.reduce((s, v) => s + v, 0);
  if (!Number.isFinite(finalValue) || Math.abs(finalValue) < 1e-9 || Math.abs(finalValue) > 1e6) fail('This relative-band exercise needs a nonzero final value between 10⁻⁹ and 10⁶ in magnitude.');
  const order = a.length - 1;
  const A = order === 1 ? [[-a[1]]] : [[-a[1], -a[2]], [1, 0]];
  const B = order === 1 ? [1] : [1, 0], D = b[0];
  const C = a.slice(1).map((v, i) => b[i + 1] - v * D);
  let x = Array(order).fill(0) as number[];
  const samples: number[] = [], stateSamples: number[] = [];
  for (let k = 0; k <= N; k++) {
    let y = 0;
    for (let j = 0; j <= order; j++) {
      if (k >= j) y += b[j]; // u[k-j]=1 for k-j>=0, otherwise zero
      if (j > 0 && k >= j) y -= a[j] * samples[k - j];
    }
    samples.push(y);
    stateSamples.push(C.reduce((s, v, i) => s + v * x[i], D));
    x = A.map((row, i) => row.reduce((s, v, j) => s + v * x[j], B[i]));
    if ([y, ...x].some(v => !Number.isFinite(v) || Math.abs(v) > 1e9)) fail('Response exceeds the supported numerical range (10⁹). Reduce coefficient magnitudes.');
  }
  const residual = Math.max(...samples.map((y, k) => Math.abs(y - stateSamples[k])));
  const scale = Math.max(1, ...samples.map(Math.abs));
  if (residual > 1e-8 * scale) fail('State and recurrence results disagree beyond the numerical tolerance; rescale the model.');
  const bound = tailBound(a, [samples[N] - finalValue, samples[N - 1] - finalValue]);
  const bandWidth = band * Math.abs(finalValue);
  // Roundoff consumes some of the band instead of accepting uncertain boundaries.
  const slack = 1e-10 * Math.max(1, scale, Math.abs(finalValue));
  let settling: number | null = null;
  if (bound !== null && bound + slack <= bandWidth) {
    let lastOutside = -1;
    samples.forEach((y, k) => { if (Math.abs(y - finalValue) > bandWidth + slack) lastOutside = k; });
    // A numerically ambiguous boundary cannot justify skipping a potentially
    // earlier valid index and reporting the following sample as the first.
    const uncertain = samples.slice(lastOutside + 1).some(y => Math.abs(Math.abs(y - finalValue) - bandWidth) <= slack);
    if (lastOutside < N && !uncertain) settling = lastOutside + 1;
  }
  let peak = 0;
  samples.forEach((y, k) => { if (y / finalValue > samples[peak] / finalValue + 1e-12) peak = k; });
  const overshoot = Math.max(0, samples[peak] / finalValue - 1) * 100;
  const peakEstablished = overshoot > 0 && bound !== null && bound + slack < Math.abs(samples[peak] - finalValue);
  return { a, b, A, B, C, D, samples, stateSamples, residual, finalValue, radius, bandWidth,
    tailBound: bound, settling, peak, overshoot, peakEstablished, T, N, band };
}
export const format = (v: number): string => Number(v.toPrecision(7)).toString();
export const latexNumber = (v: number): string => format(v).replace(/e([+-]?\d+)$/, (_, power: string) => `\\times 10^{${Number(power)}}`);
export function polynomialLatex(values: number[], variable: string): string {
  return values.map((v, i) => {
    const power = values.length - 1 - i;
    if (v === 0) return '';
    const magnitude = Math.abs(v) === 1 && power > 0 ? '' : latexNumber(Math.abs(v));
    return `${v < 0 ? '-' : '+'}${magnitude}${power ? variable : ''}${power > 1 ? `^{${power}}` : ''}`;
  }).filter(Boolean).join('').replace(/^\+/, '') || '0';
}
