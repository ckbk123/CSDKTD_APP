/** Private CF03 visual grammar: one fraction of degree <=2 polynomials.
 * No hidden grouping, nested fractions, e-symbol scientific syntax or CAS.
 * Internal polynomial coefficient order is ascending.
 */
export interface Plant { g: number; a: number[] }
export interface Controller { kp: number; ki: number }
const fail = (message: string): never => { throw new Error(message); };
const decimalPattern = /^(?:\d+(?:\.\d*)?|\.\d+)$/;
function checked(p: number[]): number[] {
  while (p.length > 1 && p.at(-1) === 0) p.pop();
  if (p.some(x => !Number.isFinite(x) || Math.abs(x) > 1e6)) fail('Keep polynomial coefficients finite and at most 1,000,000.');
  return p;
}
function product(a: number[], b: number[]): number[] {
  if (a.length + b.length > 4) fail('Use degree at most two, including polynomial products.');
  const p = Array(a.length + b.length - 1).fill(0) as number[];
  a.forEach((x, i) => b.forEach((y, j) => {
    const term = x * y;
    if (x !== 0 && y !== 0 && term === 0) fail('A nonzero coefficient product is too small to represent.');
    p[i + j] += term;
  }));
  return checked(p);
}
function polynomial(s: string): number[] {
  if (/\d*\.\d*\./.test(s)) fail('Check decimal points; use an explicit multiplication sign between numbers.');
  const tokens = s.match(/(?:\d+(?:\.\d*)?|\.\d+)|s|[()+*^\-]/g) ?? [];
  if (tokens.join('') !== s || tokens.length > 128) fail('Use decimal numbers, s, visible parentheses, +, −, products and powers 0–2. Nested/mixed fractions and e/E symbols are unsupported; use decimal coefficients and explicit + or ×.');
  let cursor = 0;
  const peek = () => tokens[cursor];
  function atom(): number[] {
    const token = tokens[cursor++];
    let p: number[];
    if (token === '(') { p = sum(); if (tokens[cursor++] !== ')') fail('Close each visible parenthesis.'); }
    else if (token === 's') p = [0, 1];
    else if (token && decimalPattern.test(token)) {
      const v = Number(token);
      if (v === 0 && /[1-9]/.test(token)) fail('A nonzero decimal is too small to represent.');
      p = checked([v]);
    } else return fail('Complete the polynomial coefficient or s term.');
    if (peek() === '^') {
      cursor++;
      const group = peek() === '(';
      if (group) cursor++;
      const exponent = tokens[cursor++];
      if (!['0', '1', '2'].includes(exponent)) fail('Use powers 0, 1 or 2 only.');
      if (group && tokens[cursor++] !== ')') fail('Complete the power.');
      if (exponent === '0') p = [1];
      if (exponent === '2') p = product(p, p);
    }
    return p;
  }
  function unary(): number[] {
    if (peek() === '+' || peek() === '-') {
      const sign = tokens[cursor++] === '-' ? -1 : 1;
      return unary().map(x => sign * x);
    }
    return atom();
  }
  function terms(): number[] {
    let p = unary();
    while (peek() === '*' || peek() === 's' || peek() === '(' || decimalPattern.test(peek() ?? '')) {
      if (peek() === '*') cursor++;
      p = product(p, unary());
    }
    return p;
  }
  function sum(): number[] {
    let p = terms();
    while (peek() === '+' || peek() === '-') {
      const sign = tokens[cursor++] === '-' ? -1 : 1, q = terms();
      p = checked(Array.from({ length: Math.max(p.length, q.length) }, (_, i) => (p[i] ?? 0) + sign * (q[i] ?? 0)));
    }
    return p;
  }
  const result = sum();
  if (cursor !== tokens.length) fail('Check the polynomial grouping and operators.');
  return result;
}
function unwrap(s: string): string {
  while (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0, whole = true;
    for (let i = 0; i < s.length - 1; i++) {
      if (s[i] === '(') depth++;
      if (s[i] === ')') depth--;
      if (depth === 0) { whole = false; break; }
    }
    if (!whole) break;
    s = s.slice(1, -1);
  }
  return s;
}
function braces(s: string, level = 0): string {
  if (level > 16) fail('Use at most 16 nested numeric wrappers.');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '}') fail('Check the equation grouping.');
    if (s[i] !== '{') { out += s[i]; continue; }
    let end = i + 1, depth = 1;
    for (; end < s.length; end++) {
      if (s[end] === '{') depth++;
      if (s[end] === '}' && --depth === 0) break;
    }
    if (depth) fail('Complete the equation grouping.');
    const inner = braces(s.slice(i + 1, end), level + 1);
    if (out.endsWith('^')) {
      if (!/^[012]$/.test(inner)) fail('Use powers 0, 1 or 2 only.');
      out += `(${inner})`;
    } else {
      if (!decimalPattern.test(inner)) fail('Use visible parentheses ( ) to group polynomial terms. Hidden brace groups are unsupported.');
      out += inner; // 1{2} displays12: never invent the product1(2).
    }
    i = end;
  }
  return out;
}
function rational(latex: string, name: 'G' | 'C'): { top: number[]; bottom: number[] } {
  if (!latex.trim() || latex.length > 512) fail('Enter a complete equation within 512 characters.');
  let s = latex.replace(/\\(?:left|right)/g, '').replace(/\\(?:,|;|!|quad|enspace)/g, '')
    .replace(/\\(?:cdot|times)/g, '*').replace(/\s/g, '').replace(/−/g, '-');
  s = s.replace(new RegExp(`^${name}\\(s\\)=`), '');
  let sign = 1;
  for (let i = 0; i < 32; i++) {
    const unwrapped = unwrap(s);
    if (unwrapped !== s) { s = unwrapped; continue; }
    const unary = /^([+-]+)(.+)$/.exec(s);
    if (unary && (/^\\d?frac/.test(unary[2]) || unwrap(unary[2]) !== unary[2])) {
      if (unary[1].split('-').length % 2 === 0) sign *= -1;
      s = unary[2]; continue;
    }
    break;
  }
  let top: string, bottom: string;
  if (/^\\d?frac/.test(s)) {
    s = s.replace(/^\\d?frac/, '');
    function argument(): string {
      if (!s.startsWith('{')) {
        if (!/^[0-9s]/.test(s)) fail('Complete both boxes of the fraction.');
        const token = s[0]; s = s.slice(1); return token;
      }
      let depth = 0;
      for (let i = 0; i < s.length; i++) {
        if (s[i] === '{') depth++;
        if (s[i] === '}' && --depth === 0) { const value = s.slice(1, i); s = s.slice(i + 1); return value; }
      }
      return fail('Complete both boxes of the fraction.');
    }
    top = argument(); bottom = argument();
    if (s) fail('Use one complete fraction; put the polynomial terms inside its boxes.');
  } else {
    let depth = 0, slash = -1;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(' || s[i] === '{') depth++;
      if (s[i] === ')' || s[i] === '}') depth--;
      if (s[i] === '/' && depth === 0) {
        if (slash !== -1) fail('Use one complete fraction with decimal polynomial coefficients.');
        slash = i;
      }
    }
    top = slash < 0 ? s : s.slice(0, slash); bottom = slash < 0 ? '1' : s.slice(slash + 1);
    if (slash >= 0) {
      const atomic = /^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)|s(?:\^(?:[012]|\([012]\)))?)$/;
      for (const part of [top, bottom]) {
        const visible = braces(part);
        if (unwrap(visible) === visible && !atomic.test(visible)) fail('Put polynomial sums/products inside visible parentheses, or use the fraction boxes.');
      }
    }
  }
  return { top: polynomial(braces(top)).map(x => sign * x), bottom: polynomial(braces(bottom)) };
}
export function parsePlant(latex: string): Plant {
  const { top, bottom } = rational(latex, 'G');
  if (top.length !== 1 || ![2, 3].includes(bottom.length)) fail('Use a constant numerator over a first- or second-order plant denominator.');
  const leading = bottom.at(-1)!;
  if (Math.abs(leading) < 1e-9) fail('The leading plant coefficient must have magnitude at least 10⁻⁹.');
  const g = top[0] / leading, a = bottom.slice().reverse().map(x => x / leading);
  if (Math.abs(g) < 1e-9 || [...a, g].some(x => !Number.isFinite(x) || Math.abs(x) > 1000)) fail('Use nonzero plant gain and normalized coefficients with magnitude at most1000; gain magnitude at least10⁻⁹.');
  return { g, a };
}
export function parseController(latex: string): Controller {
  const { top, bottom } = rational(latex, 'C');
  let kp: number, ki: number;
  if (bottom.length === 1 && bottom[0] !== 0 && top.length === 1) { kp = top[0] / bottom[0]; ki = 0; }
  else if (bottom.length === 2 && bottom[0] === 0 && top.length <= 2) { kp = (top[1] ?? 0) / bottom[1]; ki = top[0] / bottom[1]; }
  else return fail('Use proportional C(s)=Kp, or PI as a linear numerator (Kp s+Ki) over s.');
  if (![kp, ki].every(Number.isFinite) || Math.max(Math.abs(kp), Math.abs(ki)) > 1000) fail('Controller gains must be finite with magnitude at most1000.');
  if (ki !== 0 && Math.abs(ki) < 1e-9) fail('A nonzero integral gain must have magnitude at least10⁻⁹.');
  return { kp, ki };
}
export const format = (v: number): string => Number(v.toPrecision(7)).toString();
export const latexNumber = (v: number): string => format(v).replace(/e([+-]?\d+)$/, (_, power: string) => `\\times10^{${Number(power)}}`);
