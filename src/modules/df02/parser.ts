import { decimal, div, neg, number, plus, q, scale, times, zero, type Poly, type Q } from './rational';

export interface Forward { readonly numerator: Poly; readonly denominator: Poly }
function fractions(input: string): string {
  let i = 0;
  function arg(depth: number): string {
    if (depth > 20) throw new Error('Keep fraction nesting within 20 levels.');
    while (/\s/.test(input[i] ?? '') && i < input.length) i++;
    if (i >= input.length) throw new Error('Complete both fraction arguments.');
    if (input[i] === '{') {
      const start = ++i; let balance = 1;
      while (i < input.length && balance) { if (input[i] === '{') balance++; if (input[i] === '}') balance--; i++; }
      if (balance) throw new Error('Close the fraction group.');
      return input.slice(start, i - 1);
    }
    if (input.startsWith('\\frac', i)) { i += 5; return `\\frac{${arg(depth + 1)}}{${arg(depth + 1)}}`; }
    if (input[i] === '\\') {
      const token = /^\\[a-zA-Z]+/.exec(input.slice(i))?.[0];
      if (!token) throw new Error('Check the fraction notation.');
      i += token.length; return token;
    }
    return input[i++];
  }
  let result = '';
  while (i < input.length) {
    if (input.startsWith('\\frac', i)) {
      i += 5; const a = arg(0), b = arg(0);
      result += `\\frac{${fractions(a)}}{${fractions(b)}}`;
    } else result += input[i++];
    if (result.length > 2000) throw new Error('The expanded fraction notation is too large.');
  }
  return result;
}
export function parseForward(latex: string): Forward {
  if (!latex.trim() || latex.length > 300) throw new Error('Enter a forward path within 300 characters.');
  let text = latex.replace(/\\(?:left|right)\b/g, '').replace(/\\(?:dfrac|tfrac)\b/g, '\\frac')
    .replace(/\\(?:cdot|times)\b/g, '*').replace(/\\div\b/g, '/').replace(/\\[,!;: ]/g, '').replace(/−/g, '-');
  text = text.replace(/^\s*[LFG]\s*\(\s*z\s*\)\s*=\s*/, '');
  if (/[eE]/.test(text)) throw new Error('Visual e/E notation is algebra. Use decimals or explicit powers of ten.');
  text = fractions(text);
  const tokens: string[] = [];
  while (text.trim()) {
    text = text.trimStart();
    const match = /^(?:\\frac|\d+(?:\.\d*)?|\.\d+|z|[+\-*/^(){}])/.exec(text);
    if (!match) throw new Error('Use real rational polynomials in z, fractions, products, sums and bounded integer powers.');
    tokens.push(match[0]); text = text.slice(match[0].length);
    if (tokens.length > 160) throw new Error('Keep the expression within 160 tokens.');
  }
  let i = 0, depth = 0;
  const peek = () => tokens[i];
  const scalar = (x: Q): Forward => ({ numerator: [x], denominator: [q(1)] });
  function combine(a: Forward, b: Forward, op: string): Forward {
    if (op === '+') return { numerator: plus(times(a.numerator, b.denominator), times(b.numerator, a.denominator)), denominator: times(a.denominator, b.denominator) };
    if (op === '-') return combine(a, { ...b, numerator: scale(b.numerator, q(-1)) }, '+');
    if (op === '/') {
      if (zero(b.numerator)) throw new Error('A denominator cannot be the zero polynomial.');
      return { numerator: times(a.numerator, b.denominator), denominator: times(a.denominator, b.numerator) };
    }
    return { numerator: times(a.numerator, b.numerator), denominator: times(a.denominator, b.denominator) };
  }
  function primary(): Forward {
    if (++depth > 20) throw new Error('Keep expression nesting within 20 levels.');
    const token = tokens[i++]; let value: Forward;
    if (token === '(' || token === '{') {
      value = sum();
      if (tokens[i++] !== (token === '(' ? ')' : '}')) throw new Error('Close each equation group.');
    } else if (token === '\\frac') {
      // Fractions were expanded with TeX's one-token argument boundaries.
      const a = primary(), b = primary(); value = combine(a, b, '/');
    } else if (token === 'z') value = { numerator: [q(0), q(1)], denominator: [q(1)] };
    else if (/^(?:\d|\.)/.test(token ?? '')) value = scalar(decimal(token));
    else throw new Error('Complete the rational expression before calculating.');
    depth--; return value;
  }
  function power(): Forward {
    let value = primary();
    if (peek() === '^') {
      i++; const group = peek() === '{' || peek() === '(' ? tokens[i++] : undefined;
      let sign = 1;
      if (peek() === '-' || peek() === '+') sign = tokens[i++] === '-' ? -1 : 1;
      const exponentToken = tokens[i++];
      if (!/^\d+$/.test(exponentToken ?? '')) throw new Error('Use a bounded integer power.');
      const exponent = sign * Number(exponentToken);
      if (group && tokens[i++] !== (group === '{' ? '}' : ')')) throw new Error('Close the integer power.');
      const ten = value.numerator.length === 1 && value.denominator.length === 1 && div(value.numerator[0], value.denominator[0]).n === 10n && div(value.numerator[0], value.denominator[0]).d === 1n;
      if (Math.abs(exponent) > (ten ? 12 : 2)) throw new Error('Use polynomial powers −2…2, or powers −12…12 of the number 10.');
      if (exponent < 0 && zero(value.numerator)) throw new Error('Zero cannot have a negative power.');
      if (ten) value = scalar(exponent >= 0 ? q(10n ** BigInt(exponent)) : q(1n, 10n ** BigInt(-exponent)));
      else {
        const base = exponent < 0 ? { numerator: value.denominator, denominator: value.numerator } : value;
        value = scalar(q(1));
        for (let j = 0; j < Math.abs(exponent); j++) value = combine(value, base, '*');
      }
    }
    return value;
  }
  function unary(): Forward {
    if (peek() === '+' || peek() === '-') {
      const sign = tokens[i++]; const v = unary();
      return sign === '-' ? { ...v, numerator: v.numerator.map(neg) } : v;
    }
    return power();
  }
  function numericAt(at: number): boolean {
    while (tokens[at] === '+' || tokens[at] === '-') at++;
    return /^(?:\d|\.)/.test(tokens[at] ?? '');
  }
  function product(): Forward {
    let start = i, value = unary(), lastNumeric = numericAt(start);
    while (i < tokens.length) {
      const token = peek();
      if (token === '*' || token === '/') {
        i++; start = i; value = combine(value, unary(), token); lastNumeric = numericAt(start);
      } else if (token === 'z' || token === '(' || token === '{' || token === '\\frac' || /^(?:\d|\.)/.test(token)) {
        if (token === '\\frac' && lastNumeric) throw new Error('Mixed-number adjacency is unsupported. Use explicit +/− for addition or × for multiplication.');
        if (/^(?:\d|\.)/.test(token) && /^(?:\d|\.)/.test(tokens[i - 1])) throw new Error('Check the decimal; separate numeric factors with ×.');
        start = i; value = combine(value, unary(), '*'); lastNumeric = numericAt(start);
      } else break;
    }
    return value;
  }
  function sum(): Forward {
    let value = product();
    while (peek() === '+' || peek() === '-') { const op = tokens[i++]; value = combine(value, product(), op); }
    return value;
  }
  const value = sum();
  if (i !== tokens.length) throw new Error('Check the grouping and operators.');
  if (zero(value.denominator)) throw new Error('The denominator cannot be zero.');
  if (value.denominator.length > 3 || value.numerator.length > 3) throw new Error('Use expanded numerator and denominator degrees no greater than two.');
  if (value.numerator.length > value.denominator.length) throw new Error('Use a proper forward path; an improper model would require future reference samples.');
  for (const p of [value.numerator, value.denominator]) for (const a of p) if (Math.abs(number(a)) > 1e4) throw new Error('Keep expanded coefficient magnitudes at most 10000.');
  const lead = value.denominator.at(-1)!;
  const normalized = { numerator: value.numerator.map(a => div(a, lead)), denominator: value.denominator.map(a => div(a, lead)) };
  for (const p of [normalized.numerator, normalized.denominator]) for (const a of p) {
    const magnitude = Math.abs(number(a));
    if (magnitude > 1e6 || (magnitude > 0 && magnitude < 1e-12)) throw new Error('Keep nonzero normalized coefficients between 10⁻¹² and 10⁶.');
  }
  return normalized;
}
