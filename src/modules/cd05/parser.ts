import { ZERO, ONE, add as qadd, sub as qsub, mul as qmul, div as qdiv, neg, magnitude, compare, fromDecimal, rational, toNumber, type Q } from './rational';
/** Descending powers, a[0]=1 and b padded to the same length.
 * Original denominator factors are retained; family validation is separate. */
export interface ExactTransfer { a: Q[]; b: Q[] }
type Poly = Q[]; // Internal ascending powers.
interface Fraction { n: Poly; d: Poly }
const fail = (message: string): never => { throw new Error(message); };
const limit = rational(1_000_000_000_000n), literalLimit = rational(1_000_000n);
const trim = (p: Poly): Poly => { while (p.length > 1 && !p.at(-1)!.n) p.pop(); return p; };
function bounded(p: Poly): Poly {
  trim(p);
  if (p.length > 7 || p.some(x => compare(magnitude(x), limit) > 0)) fail('Keep intermediate degree at most 6 and coefficient magnitude at most 10¹².');
  return p;
}
function add(a: Poly, b: Poly, subtract: boolean): Poly {
  return bounded(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (subtract ? qsub : qadd)(a[i] ?? ZERO, b[i] ?? ZERO)));
}
function mul(a: Poly, b: Poly): Poly {
  const out: Poly = Array(a.length + b.length - 1).fill(ZERO);
  a.forEach((x, i) => b.forEach((y, j) => { out[i + j] = qadd(out[i + j], qmul(x, y)); }));
  return bounded(out);
}

/** TeX fraction/exponent arguments keep their one-token boundaries. */
function plain(latex: string): string {
  if (!latex.trim()) fail('Enter a continuous transfer function.');
  if (latex.length > 512) fail('Use at most 512 characters.');
  if (/\d\s+\d/.test(latex)) fail('Use a multiplication sign between separate numbers.');
  let source = latex.replace(/\\left|\\right/g, '').replace(/\\(?:cdot|times)/g, '*')
    .replace(/\\[,;! ]/g, '').replace(/−/g, '-').replace(/\s/g, '');
  source = source.replace(/\\(?:mathrm|mathit|mathbf|mathsf|mathtt|text)\{([+-]?(?:\d+(?:\.\d*)?|\.\d+))\}/g, '{$1}')
    .replace(/\\(?:mathrm|mathit|mathbf|mathsf|mathtt)([0-9])/g, '{$1}').replace(/^(?:G|C)\(s\)=/, '');
  if ((source.match(/\\[A-Za-s]+/g) ?? []).some(name => !['\\frac', '\\dfrac', '\\tfrac'].includes(name))) {
    fail('Unsupported notation. Only numeric font wrappers, fractions and the variable s are supported.');
  }
  let at = 0, depth = 0;
  const command = (): string | undefined => /^(?:\\dfrac|\\tfrac|\\frac)/.exec(source.slice(at))?.[0];
  function group(): string {
    if (++depth > 20) fail('Use at most 20 nested groups.');
    let value: string;
    if (source[at] === '{') { at++; value = sequence(true); if (source[at++] !== '}') fail('Complete every fraction/group.'); }
    else if (command()) value = fraction();
    else { if (at >= source.length || source[at] === '}') fail('Complete every fraction.'); value = source[at++]; }
    depth--; return value;
  }
  function fraction(): string { at += command()!.length; const n = group(), d = group(); return '((' + n + ')/(' + d + '))'; }
  function sequence(stop: boolean): string {
    let out = '', lastNumeric = false;
    const mixed = (): never => fail('Mixed-number or invisible-group adjacency is unsupported. Use explicit + for addition or × for multiplication.');
    while (at < source.length && !(stop && source[at] === '}')) {
      if (command()) { if (lastNumeric) mixed(); out += fraction(); lastNumeric = false; }
      else if (source[at] === '{') {
        if (lastNumeric || /[s)]$/.test(out)) mixed();
        const content = group(), numeric = /^\(*[+-]?(?:\d+(?:\.\d*)?|\.\d+)\)*$/.test(content);
        if (!numeric && !out.endsWith('^')) fail('Use visible parentheses instead of invisible algebraic grouping.');
        out += '(' + content + ')'; lastNumeric = numeric;
      } else if (source[at] === '}') fail('Remove the unmatched closing brace.');
      else { const token = source[at++]; out += token; lastNumeric = /[0-9.]/.test(token); }
    }
    return out;
  }
  return sequence(false);
}

/** Exact decimal rational-polynomial normalization. Range-check the eventual
 * numerical coefficients but retain rationals for exact family extraction. */
export function parseTransfer(latex: string): ExactTransfer {
  const source = plain(latex), tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|s|[()+\-*/^]/g) ?? [];
  if (!tokens.length || tokens.join('') !== source) fail('Use real decimal constants, s, fractions and powers 0–2. Visual e/E and functions are unsupported.');
  let at = 0, depth = 0;
  const one = (): Fraction => ({ n: [ONE], d: [ONE] });
  const product = (a: Fraction, b: Fraction): Fraction => ({ n: mul(a.n, b.n), d: mul(a.d, b.d) });
  function atom(): Fraction {
    if (++depth > 20) fail('Use at most 20 nested groups.');
    const token = tokens[at++]; let value: Fraction;
    if (token === '(') { value = sum(); if (tokens[at++] !== ')') fail('Close every parenthesis.'); }
    else if (token === 's') value = { n: [ZERO, ONE], d: [ONE] };
    else if (token && /^(?:\d|\.)/.test(token)) {
      const number = fromDecimal(token);
      if (compare(number, literalLimit) > 0) fail('Each entered number must have magnitude at most 10⁶.');
      value = { n: [number], d: [ONE] };
    } else return fail('Complete each term with a constant, s or visible parentheses.');
    if (tokens[at] === '^') {
      at++; const grouped = tokens[at] === '('; if (grouped) at++;
      const power = tokens[at++];
      if (!/^[012]$/.test(power ?? '')) fail('Use a complete power box containing 0, 1 or 2. Higher, signed and ambiguous unbraced powers are unsupported.');
      if (grouped && tokens[at++] !== ')') fail('Complete the exponent.');
      value = power === '0' ? one() : power === '2' ? product(value, value) : value;
    }
    depth--; return value;
  }
  function unary(): Fraction {
    if (tokens[at] === '+' || tokens[at] === '-') {
      const negative = tokens[at++] === '-', value = atom();
      return negative ? { n: value.n.map(neg), d: value.d } : value;
    }
    return atom();
  }
  function term(): Fraction {
    let value = unary();
    while (at < tokens.length) {
      const token = tokens[at];
      if (token === '*' || token === '/') {
        at++; const right = unary();
        if (token === '/' && right.n.every(v => !v.n)) fail('A transfer denominator cannot be zero.');
        value = product(value, token === '/' ? { n: right.d, d: right.n } : right);
      } else if (token === 's' || token === '(') value = product(value, unary());
      else break;
    }
    return value;
  }
  function sum(): Fraction {
    let value = term();
    while (tokens[at] === '+' || tokens[at] === '-') {
      const subtract = tokens[at++] === '-', right = term();
      value = { n: add(mul(value.n, right.d), mul(right.n, value.d), subtract), d: mul(value.d, right.d) };
    }
    return value;
  }
  const value = sum();
  if (at !== tokens.length) fail('Check the operators and exponent grouping. Use explicit multiplication after a completed power.');
  trim(value.n); trim(value.d);
  if (value.d.every(v => !v.n)) fail('A transfer denominator cannot be zero.');
  if (value.d.length > 3) fail('Use unreduced denominator order 0, 1 or 2.');
  if (value.n.length > value.d.length) fail('Use a proper causal plant or lead controller; an improper expression is unsupported.');
  const leading = value.d.at(-1)!;
  if (compare(magnitude(leading), fromDecimal('0.00000001')) < 0) fail('The leading denominator coefficient is too small. Rescale the model.');
  const convert = (v: Q): Q => {
    const normalized = qdiv(v, leading);
    if (compare(magnitude(normalized), rational(10_000_000_000n)) > 0) fail('Normalized coefficient magnitudes must be at most 10¹⁰.');
    toNumber(normalized, 1e-300, 1e10); return normalized;
  };
  return {
    a: [...value.d].reverse().map(convert),
    b: [...Array(value.d.length - value.n.length).fill(ZERO), ...[...value.n].reverse()].map(convert),
  };
}
