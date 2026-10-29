/** DP02: a single continuous pole and its conjugate, not a plant solver. */
export interface Pole { readonly real: number; readonly imag: number }
export type Movement = 'inward' | 'outward' | 'unchanged';
export const RADIUS_TOLERANCE = 1e-10;

function fail(message: string): never { throw new Error(message); }

/** Expand an HTML numeric value to visually unambiguous decimal notation.
 * MathLive treats e/E as algebraic symbols, not a numeric exponent separator. */
export function decimalLiteral(value: number): string {
  if (!Number.isFinite(value)) fail('Use a finite numeric component.');
  const text = String(value);
  if (!/[eE]/.test(text)) return text;
  const sign = value < 0 ? '-' : '';
  const [mantissa, exponent] = String(Math.abs(value)).split('e');
  const digits = mantissa.replace('.', '');
  const point = (mantissa.includes('.') ? mantissa.indexOf('.') : mantissa.length) + Number(exponent);
  return sign + (point <= 0 ? `0.${'0'.repeat(-point)}${digits}`
    : point >= digits.length ? digits + '0'.repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`);
}

/** Bounded arithmetic over real scalars and one j. No powers/functions/variables.
 * Supports visual fractions, pi, implicit scalar multiplication, and parentheses.
 * Division by a complex denominator and products of two imaginary terms are rejected.
 */
export function parsePole(latex: string): Pole {
  if (!latex.trim()) fail('Enter a pole, for example −2 + 3j.');
  if (latex.length > 1024) fail('Keep the pole expression within 1024 characters.');
  if (/[\d.]\s+[\d.]/.test(latex)) fail('Separate numbers with an arithmetic operator.');
  let source = latex.replace(/\\(?:left|right)/g, '').replace(/\\(?:mathrm|operatorname)\{j\}/g, 'j')
    .replace(/\\(?:,|;|!|quad|qquad| )/g, '').replace(/\\pi/g, 'π')
    .replace(/\\(?:cdot|times)/g, '*').replace(/\\div/g, '/')
    .replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s/g, '');
  source = source.replace(/^s=/, '');
  if (/[eE]/.test(source)) fail('The visual field treats e and E as symbols. Use decimal numbers here, or scientific notation in the numeric components.');
  // MathLive emits both braced fractions and TeX's single-token shorthand.
  let cursor = 0;
  const fraction = (depth: number): string => {
    cursor += 5; // \\frac
    return `((${argument(depth + 1)})/(${argument(depth + 1)}))`;
  };
  const argument = (depth: number): string => {
    if (depth > 12) fail('Use at most 12 levels of parentheses or fractions.');
    if (source[cursor] === '{') { cursor++; return group(depth, true); }
    if (source.startsWith('\\frac', cursor)) return fraction(depth);
    const token = source[cursor++];
    if (!token || !/[0-9πj]/.test(token)) fail('Complete both parts of the fraction.');
    return token;
  };
  const group = (depth: number, closing: boolean): string => {
    if (depth > 12) fail('Use at most 12 levels of parentheses or fractions.');
    let output = '';
    while (cursor < source.length && source[cursor] !== '}') {
      if (source.startsWith('\\frac', cursor)) {
        if (/[0-9.]$/.test(output)) fail('Write an explicit + or × before an adjacent fraction. Mixed-number adjacency is not supported.');
        output += fraction(depth);
      } else if (source[cursor] === '{') fail('Use visible parentheses to group this expression.');
      else output += source[cursor++];
    }
    if (closing) {
      if (source[cursor++] !== '}') fail('Complete both parts of the fraction.');
    } else if (source[cursor] === '}') fail('Check the grouping in the pole.');
    return output;
  };
  source = group(0, false);
  if (/[^0-9.πj+*/()-]/.test(source)) fail('Use real numbers, j, π, fractions and + − × ÷ only; enter one pole.');
  if ((source.match(/j/g) ?? []).length > 1) fail('Enter one rectangular pole a + bj, with at most one j.');
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|π|j|[+*/()-]/g) ?? [];
  if (tokens.join('') !== source || !tokens.length) fail('Check the numbers in the pole expression.');
  if (tokens.length > 80) fail('Use at most 80 numbers, symbols and operators.');
  let at = 0;
  const checked = (p: Pole): Pole => {
    if (!Number.isFinite(p.real) || !Number.isFinite(p.imag)) fail('The pole must have finite real and imaginary parts.');
    return p;
  };
  const productValue = (a: number, b: number): number => {
    const value = a * b;
    if (a !== 0 && b !== 0 && value === 0) fail('A nonzero product is too small to represent. Use larger magnitudes.');
    return value;
  };
  const atom = (depth: number): Pole => {
    if (depth > 12) fail('Use at most 12 levels of parentheses or fractions.');
    const token = tokens[at++];
    if (token === '+' || token === '-') {
      const p = atom(depth + 1); const sign = token === '-' ? -1 : 1;
      return { real: sign * p.real, imag: sign * p.imag };
    }
    if (token === '(') {
      const p = sum(depth + 1);
      if (tokens[at++] !== ')') fail('Close each parenthesis in the pole.');
      return p;
    }
    if (token === 'j') return { real: 0, imag: 1 };
    if (token === 'π') return { real: Math.PI, imag: 0 };
    if (!token || !/^[\d.]/.test(token)) fail('Complete the pole expression.');
    const value = Number(token);
    if (value === 0 && /[1-9]/.test(token)) fail('A nonzero number is too small to represent. Use a larger magnitude.');
    return checked({ real: value, imag: 0 });
  };
  const product = (depth: number): Pole => {
    let p = atom(depth);
    while (at < tokens.length) {
      const token = tokens[at];
      const implicit = token === 'j' || token === 'π' || token === '(';
      if (token !== '*' && token !== '/' && !implicit) break;
      if (!implicit) at++;
      const q = atom(depth);
      if (token === '/') {
        if (q.imag !== 0) fail('Use a real denominator in a pole expression.');
        if (q.real === 0) fail('A fraction cannot have a zero denominator.');
        const real = p.real / q.real, imag = p.imag / q.real;
        if ((p.real !== 0 && real === 0) || (p.imag !== 0 && imag === 0)) fail('A nonzero quotient is too small to represent. Use larger magnitudes.');
        p = checked({ real, imag });
      } else {
        if (p.imag !== 0 && q.imag !== 0) fail('Use a rectangular pole a + bj.');
        p = checked({ real: productValue(p.real, q.real), imag: productValue(p.real, q.imag) + productValue(p.imag, q.real) });
      }
    }
    return p;
  };
  const sum = (depth: number): Pole => {
    let p = product(depth);
    while (tokens[at] === '+' || tokens[at] === '-') {
      const sign = tokens[at++] === '-' ? -1 : 1; const q = product(depth);
      p = checked({ real: p.real + sign * q.real, imag: p.imag + sign * q.imag });
    }
    return p;
  };
  const result = sum(0);
  if (at !== tokens.length) fail('Use a rectangular pole a + bj, with balanced parentheses.');
  return { real: result.real || 0, imag: result.imag || 0 };
}

export function principalAngle(angle: number): number {
  let theta = Math.atan2(Math.sin(angle), Math.cos(angle));
  if (theta <= -Math.PI + 1e-14) theta = Math.PI;
  return theta;
}

export function validatePole(pole: Pole, period: number): void {
  if (![pole.real, pole.imag, period].every(Number.isFinite)) fail('Pole components and sample period must be finite numbers.');
  if (period < 0.001 || period > 10) fail('Sample period T must be from 0.001 to 10 seconds.');
  if (Math.abs(pole.real) > 1000 || Math.abs(pole.imag) > 10000) fail('Use |σ| ≤ 1000 s⁻¹ and |ω| ≤ 10000 rad/s.');
  if (Math.abs(pole.real * period) > 20) fail('Use |σT| ≤ 20 so radius and plots remain numerically resolved.');
  if (Math.abs(pole.imag * period) > 200 * Math.PI) fail('Use |ωT| ≤ 200π radians to bound phase wrapping.');
}

export function mapPole(pole: Pole, period: number) {
  validatePole(pole, period);
  const radius = Math.exp(pole.real * period);
  const angle = principalAngle(pole.imag * period);
  const real = radius * Math.cos(angle), imag = radius * Math.sin(angle);
  const classification = Math.abs(radius - 1) <= RADIUS_TOLERANCE ? 'boundary'
    : radius < 1 ? 'decay' : 'growth';
  return { radius, angle, real, imag, classification } as const;
}

export function inversePole(z: Pole, period: number, branch: number): Pole {
  if (![z.real, z.imag, period].every(Number.isFinite) || period < 0.001 || period > 10) fail('Use finite z components and T from 0.001 to 10 seconds.');
  if (!Number.isInteger(branch) || Math.abs(branch) > 5) fail('Choose an integer inverse branch from −5 to 5.');
  const radius = Math.hypot(z.real, z.imag);
  if (!Number.isFinite(radius) || radius === 0) fail('z = 0 has no finite continuous logarithmic inverse.');
  return { real: Math.log(radius) / period, imag: (principalAngle(Math.atan2(z.imag, z.real)) + 2 * Math.PI * branch) / period };
}

export function radialMovement(pole: Pole, reference: number, target: number): Movement {
  validatePole(pole, reference); validatePole(pole, target);
  // Direction follows the sign of the exact log-radius difference, even close to 1.
  if (pole.real === 0 || target === reference) return 'unchanged';
  return (pole.real < 0) === (target > reference) ? 'inward' : 'outward';
}

export function modeSamples(pole: Pole, period: number, intervals: number) {
  validatePole(pole, period);
  if (!Number.isInteger(intervals) || intervals < 4 || intervals > 100) fail('Choose 4 to 100 sample intervals.');
  if (pole.real * period * intervals > 30) fail('Growth exceeds the plot limit σTN ≤ 30. Reduce T or the sample count.');
  return Array.from({ length: intervals + 1 }, (_, k) => {
    const envelope = Math.exp(pole.real * period * k);
    return { k, time: k * period, envelope, value: envelope * Math.cos(principalAngle(pole.imag * period) * k) };
  });
}

export function aliasExperiment(pole: Pole, period: number, intervals: number) {
  const original = modeSamples(pole, period, intervals);
  const alias = { real: pole.real, imag: pole.imag + 2 * Math.PI / period };
  // Analytic alias identity; compute independently in unreduced continuous phase.
  const residual = Math.max(...original.map(p => Math.abs(p.value - p.envelope * Math.cos(alias.imag * p.time)) / Math.max(1, p.envelope)));
  return { alias, residual };
}
