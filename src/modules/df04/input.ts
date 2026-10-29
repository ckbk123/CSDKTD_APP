import { validatePlant, type Plant } from './math';

type Polynomial = readonly number[]; // Ascending powers internally; never trim a small nonzero coefficient.
interface Ratio { readonly num: Polynomial; readonly den: Polynomial }
const fail = (message: string): never => { throw new Error(message); };
function checked(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12) fail('Polynomial intermediates must be finite and have magnitude at most 10¹². Rescale the expression.');
  return value || 0;
}
function trimmed(values: number[]): number[] { while (values.length > 1 && values[values.length - 1] === 0) values.pop(); return values; }
function product(a: Polynomial, b: Polynomial): number[] {
  if (a.length + b.length - 2 > 4) fail('Keep every intermediate polynomial degree at most four.');
  const out = Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const term = checked(a[i] * b[j]);
    if (a[i] !== 0 && b[j] !== 0 && term === 0) fail('A nonzero product is too small to represent. Rescale the coefficients.');
    out[i + j] = checked(out[i + j] + term);
  }
  return trimmed(out);
}
function ratio(num: Polynomial, den: Polynomial): Ratio {
  if (den.length === 1) {
    if (den[0] === 0) fail('A fraction cannot have an identically zero denominator.');
    return { num: trimmed(num.map(value => {
      const next = checked(value / den[0]);
      if (value !== 0 && next === 0) fail('A nonzero quotient is too small to represent. Rescale the coefficients.');
      return next;
    })), den: [1] };
  }
  return { num, den };
}
function add(a: Ratio, b: Ratio, sign: number): Ratio {
  if (a.den.length !== 1 || b.den.length !== 1) fail('Enter one fraction of polynomials, or products of such factors. Sums of rational functions are unsupported.');
  return { num: trimmed(Array.from({ length: Math.max(a.num.length, b.num.length) }, (_, index) => checked((a.num[index] ?? 0) + sign * (b.num[index] ?? 0)))), den: [1] };
}

/** Bounded visual rational-polynomial input. No eval, cancellation or programming exponents. */
export function parsePlant(latex: string): Plant {
  if (!latex.trim()) fail('Enter a positive first-order plant g/(tau*s+1), without a function-name label.');
  if (latex.length > 512) fail('Keep the plant expression within 512 characters.');
  if (/[\d.]\s+[\d.]/.test(latex)) fail('Separate numbers with + or ×.');
  let source = latex.replace(/\\(?:left|right)/g, '').replace(/\\(?:dfrac|tfrac)/g, '\\frac')
    .replace(/\\(?:mathrm|mathit|mathbf|mathsf|text)\{([+-]?(?:\d+(?:\.\d*)?|\.\d+)|s)\}/g, '$1')
    .replace(/\\(?:cdot|times)/g, '*').replace(/\\div/g, '/')
    .replace(/\\(?:,|;|!|quad|qquad| )/g, '').replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/\s/g, '');
  if (/[eE]/.test(source)) fail('The visual field treats e/E as symbols. Use decimals or fractions here; native numeric controls accept scientific notation.');
  let cursor = 0;
  const depthCheck = (depth: number) => { if (depth > 8) fail('Use at most eight visible grouping/fraction levels.'); };
  const exponent = (): string => {
    cursor++; // TeX gives an unbraced power exactly one argument atom.
    let literal: string;
    if (source[cursor] === '{') {
      const end = source.indexOf('}', cursor + 1);
      if (end < 0) fail('Complete the raised exponent box.');
      literal = source.slice(cursor + 1, end); cursor = end + 1;
      if (/^\([+-]?\d+\)$/.test(literal)) literal = literal.slice(1, -1);
    } else {
      literal = source[cursor++] ?? '';
      if (!/^[012]$/.test(literal) || /[\d.]/.test(source[cursor] ?? '')) fail('Use the power button with a complete exponent 0, 1 or 2 in its raised box. A sign or decimal tail outside that box is unsupported.');
    }
    if (!/^[+]?\d+$/.test(literal) || ![0, 1, 2].includes(Number(literal))) fail('Use only literal integer powers 0, 1 or 2. Write decimal coefficients instead of powers of ten.');
    // Keep a delimiter after normalization so s^{0}2 can never turn into s^02.
    return `^(${Number(literal)})`;
  };
  const fraction = (depth: number): string => {
    depthCheck(depth); cursor += 5;
    return `((${argument(depth)})/(${argument(depth)}))`;
  };
  const argument = (depth: number): string => {
    depthCheck(depth);
    if (source[cursor] === '{') { cursor++; return group(depth, '}'); }
    if (source.startsWith('\\frac', cursor)) return fraction(depth + 1);
    const token = source[cursor++];
    if (!token || !/[0-9s]/.test(token)) fail('Complete both parts of each fraction.');
    return token;
  };
  const group = (depth: number, closing?: ')' | '}'): string => {
    depthCheck(depth); let output = '';
    while (cursor < source.length && source[cursor] !== closing) {
      if (source.startsWith('\\frac', cursor)) {
        if (/[0-9.s)]$/.test(output)) fail('Write an explicit + or × before an adjacent fraction. Mixed-number adjacency is unsupported.');
        output += fraction(depth + 1);
      } else if (source[cursor] === '^') output += exponent();
      else if (source[cursor] === '(') { cursor++; output += `(${group(depth + 1, ')')})`; }
      else if (source[cursor] === '{') fail('Use visible parentheses for grouping and explicit + or × before a fraction.');
      else if (source[cursor] === ')' || source[cursor] === '}') fail('Check the expression grouping.');
      else output += source[cursor++];
    }
    if (closing && source[cursor++] !== closing) fail('Complete each parenthesis and fraction.');
    return output;
  };
  source = group(0);
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|s|[()+*/^\-]/g) ?? [];
  if (!tokens.length || tokens.join('') !== source) fail('Use a fraction of real polynomials in s, with decimals, + − × ÷, parentheses and powers 0–2. Omit K and function-name labels.');
  if (tokens.length > 128) fail('Use at most 128 numbers, symbols and operators.');
  let at = 0;
  const primary = (depth: number): Ratio => {
    // Normalized fraction syntax adds transparent parentheses; logical source depth was bounded above.
    if (depth > 32) fail('The normalized expression has excessive nesting.');
    const token = tokens[at++];
    if (token === '(') { const value = sum(depth + 1); if (tokens[at++] !== ')') fail('Close each parenthesis.'); return value; }
    if (token === 's') return { num: [0, 1], den: [1] };
    if (!token || !/^[\d.]/.test(token)) fail('Complete the plant expression.');
    const value = checked(Number(token));
    if (value === 0 && /[1-9]/.test(token)) fail('A nonzero literal is too small to represent.');
    return { num: [value], den: [1] };
  };
  const power = (depth: number): Ratio => {
    let value = primary(depth);
    if (tokens[at] === '^') {
      at++;
      if (tokens[at++] !== '(') fail('Check the exponent grouping.');
      const exponent = Number(tokens[at++]);
      if (tokens[at++] !== ')' || ![0, 1, 2].includes(exponent)) fail('Use only literal integer powers 0, 1 or 2.');
      if (exponent === 0) { if (value.num.every(coefficient => coefficient === 0)) fail('The form 0⁰ is unsupported.'); value = { num: [1], den: [1] }; }
      else if (exponent === 2) value = ratio(product(value.num, value.num), product(value.den, value.den));
    }
    return value;
  };
  const unary = (depth: number): Ratio => {
    if (depth > 32) fail('Use fewer unary signs.');
    if (tokens[at] === '+' || tokens[at] === '-') {
      const sign = tokens[at++] === '-' ? -1 : 1, value = unary(depth + 1);
      return { num: value.num.map(coefficient => sign * coefficient), den: value.den };
    }
    return power(depth);
  };
  const term = (depth: number): Ratio => {
    let value = unary(depth);
    while (at < tokens.length) {
      const token = tokens[at], implicit = token === 's' || token === '(';
      if (token !== '*' && token !== '/' && !implicit) break;
      if (!implicit) at++;
      const next = unary(depth);
      value = token === '/' ? ratio(product(value.num, next.den), product(value.den, next.num)) : ratio(product(value.num, next.num), product(value.den, next.den));
    }
    return value;
  };
  const sum = (depth: number): Ratio => {
    let value = term(depth);
    while (tokens[at] === '+' || tokens[at] === '-') { const sign = tokens[at++] === '-' ? -1 : 1; value = add(value, term(depth), sign); }
    return value;
  };
  const value = sum(0);
  if (at !== tokens.length) fail('Check operators, powers and grouping in the plant expression.');
  if (value.den.length !== 2 || value.num.length !== 1) fail('Use a constant numerator and first-order denominator, without canceling factors. This comparison supports G(s)=g/(tau*s+1).');
  const constant = value.den[0];
  if (constant === 0) fail('Use a nonzero denominator constant. An integrator is outside this first-order stable-plant family.');
  const normalized = (coefficient: number): number => {
    const result = checked(coefficient / constant);
    if (coefficient !== 0 && result === 0) fail('A nonzero plant coefficient is too small to represent.');
    return result;
  };
  return validatePlant({ gain: normalized(value.num[0]), tau: normalized(value.den[1]) });
}
