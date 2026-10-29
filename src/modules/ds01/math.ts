/** Private DS01 model: real Jordan blocks, or their real conjugate-pair form. */
export interface Complex { readonly re: number; readonly im: number }
export type Structure = 'simple' | 'independent' | 'jordan2' | 'jordan3';
export interface Mode {
  readonly pole: Complex;
  readonly structure: Structure;
  readonly visible: boolean;
}
export type Location = 'inside' | 'outside' | 'boundary' | 'near-boundary';
export type Internal = 'decays' | 'bounded' | 'grows' | 'uncertain';
export type Bibo = 'stable' | 'unstable' | 'uncertain';
export const RADIUS_TOLERANCE = 1e-9;

/** Decimal literals and numeric fractions; no expression evaluation. */
export function parsePole(latex: string): Complex {
  if (!latex.trim()) throw new Error('Enter a pole, such as −0.8 or 0.6 + 0.8j.');
  if (latex.length > 200) throw new Error('Use a short numeric pole (at most 200 characters).');
  let source = latex.replace(/\\(?:left|right)/g, '')
    // Pasted numeric text can retain an upright font inside a fraction. Font
    // commands are removable only around a numeric literal, never arbitrary algebra.
    .replace(/\\(?:mathrm|mathit|mathbf|mathsf|mathtt|text)\{([+-]?(?:\d+(?:\.\d*)?|\.\d+))\}/g, '$1')
    .replace(/\\mathrm([0-9])/g, '$1')
    .replace(/\\(?:mathrm|operatorname)\{([ij])\}/g, '$1')
    .replace(/\\(?:,|;|!|quad|qquad)|\s/g, '')
    .replace(/\\(?:cdot|times)/g, '*').replace(/−/g, '-');
  const wholeGroup = (text: string): boolean => {
    if (!text.startsWith('(') || !text.endsWith(')')) return false;
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '(') depth++;
      if (text[i] === ')') depth--;
      if (depth < 0 || (depth === 0 && i < text.length - 1)) return false;
    }
    return depth === 0;
  };
  let outerSign = 1;
  for (let groups = 0; groups < 4; groups++) {
    if ((source[0] === '-' || source[0] === '+') && wholeGroup(source.slice(1))) {
      if (source[0] === '-') outerSign *= -1;
      source = source.slice(1);
    }
    if (!wholeGroup(source)) break;
    source = source.slice(1, -1);
  }
  if (!source) throw new Error('Enter a numeric pole inside the parentheses.');
  const decimal = '(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
  const number = new RegExp(`^${decimal}`);
  // TeX permits a single digit without braces; MathLive may emit \\frac12.
  const numericAtom = `(?:\\{[+-]?${decimal}\\}|\\d)`;
  const fraction = new RegExp(`^\\\\(?:dfrac|tfrac|frac)(${numericAtom})(${numericAtom})`);
  let re = 0, im = 0, realSeen = false, imaginarySeen = false, terms = 0;
  while (source.length) {
    if (++terms > 2) throw new Error('Use one real part and one imaginary part; no sums of expressions.');
    let sign = 1;
    if (source[0] === '+' || source[0] === '-') {
      if (source[0] === '-') sign = -1;
      source = source.slice(1);
    } else if (terms > 1) throw new Error('Separate the real and imaginary parts with + or −.');
    let value = 1;
    if (!/^[ij]/.test(source)) {
      const ratio = fraction.exec(source);
      const scalar = number.exec(source);
      if (ratio) {
        const numerator = Number(ratio[1].replace(/[{}]/g, '')), denominator = Number(ratio[2].replace(/[{}]/g, ''));
        if (denominator === 0) throw new Error('A numeric fraction cannot have a zero denominator.');
        value = numerator / denominator;
        source = source.slice(ratio[0].length);
      } else if (scalar) {
        value = Number(scalar[0]); source = source.slice(scalar[0].length);
      } else throw new Error('Use decimals or numeric fractions, with j for the imaginary part. Functions, symbols and powers are unsupported.');
    }
    if (source.startsWith('*')) {
      source = source.slice(1);
      if (!/^[ij]/.test(source)) throw new Error('A multiplication sign is supported only before j.');
    }
    if (/^[ij]/.test(source)) {
      if (imaginarySeen) throw new Error('Enter only one imaginary part.');
      imaginarySeen = true; im = sign * value; source = source.slice(1);
    } else {
      if (realSeen) throw new Error('Enter only one real part.');
      realSeen = true; re = sign * value;
    }
    if (source && !/^[+-]/.test(source)) throw new Error('Use a numeric pole a + bj; omit an equation or mode power.');
  }
  if (!Number.isFinite(re) || !Number.isFinite(im) || Math.hypot(re, im) > 2) {
    throw new Error('Use finite pole components with radius at most 2.');
  }
  return { re: re === 0 ? 0 : outerSign * re, im: im === 0 ? 0 : outerSign * im };
}

export function chainLength(structure: Structure): number {
  return structure === 'jordan3' ? 3 : structure === 'jordan2' ? 2 : 1;
}
export function copies(structure: Structure): number { return structure === 'independent' ? 2 : 1; }
export function radius(pole: Complex): number { return Math.hypot(pole.re, pole.im); }
/** Compare the finite decimal values retained after numeric parsing exactly.
 * Math.hypot(1, 1e-10) rounds to 1, but that alone must not certify a boundary.
 * Fractions have already been rounded to doubles; uncertain near-circle cases
 * remain uncertain rather than claiming exact recovery of the original ratio.
 */
function decimalCircle(pole: Complex): boolean {
  function ratio(value: number): readonly [bigint, bigint] {
    const [mantissa, exponent = '0'] = Math.abs(value).toString().split('e');
    const [integer, fraction = ''] = mantissa.split('.');
    const scale = fraction.length - Number(exponent);
    const numerator = BigInt(integer + fraction);
    return scale < 0 ? [numerator * 10n ** BigInt(-scale), 1n] : [numerator, 10n ** BigInt(scale)];
  }
  const [a, b] = ratio(pole.re), [c, d] = ratio(pole.im);
  return a * a * d * d + c * c * b * b === b * b * d * d;
}
export function locate(pole: Complex): Location {
  const r = radius(pole);
  if (Math.abs(r - 1) <= RADIUS_TOLERANCE) return decimalCircle(pole) ? 'boundary' : 'near-boundary';
  return r < 1 ? 'inside' : 'outside';
}

export function validateModel(modes: readonly Mode[], period: number, horizon: number): void {
  if (!Number.isFinite(period) || period < 0.001 || period > 10) throw new Error('Sample period T must be between 0.001 and 10 seconds.');
  if (!Number.isInteger(horizon) || horizon < 4 || horizon > 80) throw new Error('Last sample must be an integer from 4 to 80.');
  if (modes.length < 1 || modes.length > 4) throw new Error('Use one to four pole rows.');
  modes.forEach((mode, index) => {
    if (!['simple', 'independent', 'jordan2', 'jordan3'].includes(mode.structure)) throw new Error('Choose a supported mode structure.');
    if (!Number.isFinite(mode.pole.re) || !Number.isFinite(mode.pole.im) || radius(mode.pole) > 2) throw new Error('Each pole must be finite with radius at most 2.');
    // One row already represents its conjugate pair. Repetition is declared by structure.
    if (modes.slice(0, index).some(other => Math.hypot(other.pole.re - mode.pole.re, Math.abs(other.pole.im) - Math.abs(mode.pole.im)) < 1e-10)) {
      throw new Error('Use distinct pole rows. Declare repetition with the structure control; a complex row already includes its conjugate.');
    }
  });
}

/** All rows are eigenvalues of A, even when C vanishes on a row. */
export function classify(modes: readonly Mode[]): { internal: Internal; bibo: Bibo } {
  const knownGrowing = modes.some(mode => locate(mode.pole) === 'outside' || (locate(mode.pole) === 'boundary' && chainLength(mode.structure) > 1));
  const uncertain = modes.some(mode => locate(mode.pole) === 'near-boundary');
  const internal: Internal = knownGrowing ? 'grows' : uncertain ? 'uncertain'
    : modes.some(mode => locate(mode.pole) === 'boundary') ? 'bounded' : 'decays';
  const visible = modes.filter(mode => mode.visible);
  const bibo: Bibo = visible.some(mode => ['outside', 'boundary'].includes(locate(mode.pole))) ? 'unstable'
    : visible.some(mode => locate(mode.pole) === 'near-boundary') ? 'uncertain' : 'stable';
  return { internal, bibo };
}

export function power(p: Complex, n: number): Complex {
  let re = 1, im = 0;
  for (let k = 0; k < n; k++) { const next = re * p.re - im * p.im; im = re * p.im + im * p.re; re = next; }
  return { re, im };
}
function binomial(k: number, n: number): number {
  if (k < n) return 0;
  let value = 1;
  for (let l = 1; l <= n; l++) value *= (k - l + 1) / l;
  return value;
}
export interface Sample { readonly k: number; readonly t: number; readonly basic: number; readonly first: number; readonly norm: number }

/** J=pI+N, x[0]=e_m. J^k e_m=sum_l binom(k,l) p^(k-l)e_(m-l).
 * For complex rows use its real 2m-state representation and a unit real initial coordinate.
 */
export function samples(mode: Mode, period: number, horizon: number): Sample[] {
  validateModel([mode], period, horizon);
  const m = chainLength(mode.structure);
  return Array.from({ length: horizon + 1 }, (_, k) => {
    let squaredNorm = 0;
    let first = 0;
    for (let l = 0; l < m; l++) {
      if (k < l) continue;
      const p = power(mode.pole, k - l);
      const b = binomial(k, l);
      squaredNorm += b * b * (p.re * p.re + p.im * p.im);
      if (l === m - 1) first = b * p.re;
    }
    return { k, t: k * period, basic: power(mode.pole, k).re, first, norm: Math.sqrt(squaredNorm) };
  });
}

export function realDimension(modes: readonly Mode[]): number {
  return modes.reduce((n, mode) => n + chainLength(mode.structure) * copies(mode.structure) * (mode.pole.im === 0 ? 1 : 2), 0);
}

/** Parallel real realization. Hidden rows have C=0; D=0 throughout. */
export function realization(mode: Mode): { a: number[][]; b: number[]; c: number[] } {
  const m = chainLength(mode.structure), paired = mode.pole.im !== 0, width = paired ? 2 : 1;
  const size = m * width, n = size * copies(mode.structure);
  const a = Array.from({ length: n }, () => Array<number>(n).fill(0));
  const b = Array<number>(n).fill(0), c = Array<number>(n).fill(0);
  for (let copy = 0; copy < copies(mode.structure); copy++) {
    const offset = copy * size;
    for (let row = 0; row < m; row++) {
      const i = offset + row * width;
      a[i][i] = mode.pole.re;
      if (paired) { a[i][i + 1] = -mode.pole.im; a[i + 1][i] = mode.pole.im; a[i + 1][i + 1] = mode.pole.re; }
      if (row < m - 1) { a[i][i + width] = 1; if (paired) a[i + 1][i + width + 1] = 1; }
    }
    b[offset + (m - 1) * width] = 1;
    c[offset] = mode.visible ? 1 : 0;
  }
  return { a, b, c };
}
