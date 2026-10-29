/** Local bounded scalar algebra. Coefficients a[i], b[i] multiply z^(-i). */
export interface Model { readonly a: readonly number[]; readonly b: readonly number[] }
type Polynomial = Map<number, number>;
export const BASELINE = String.raw`G(z)=\frac{0.09516258}{z-0.90483742}`;
const MAX = 6;
function fail(message: string): never { throw new Error(message); }
function tidy(p: Polynomial): Polynomial {
  for (const [power, value] of p) {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12 || Math.abs(power) > 12) fail('Expression exceeds the coefficient or power limits.');
    if (value === 0) p.delete(power);
  }
  return p;
}
function add(a: Polynomial, b: Polynomial, sign = 1): Polynomial {
  const p = new Map(a);
  for (const [k, v] of b) p.set(k, (p.get(k) ?? 0) + sign * v);
  return tidy(p);
}
function multiply(a: Polynomial, b: Polynomial): Polynomial {
  const p: Polynomial = new Map();
  for (const [i, x] of a) for (const [j, y] of b) {
    const product = x * y;
    if (x !== 0 && y !== 0 && product === 0) fail('A nonzero coefficient is too small for double-precision arithmetic. Rescale the expression.');
    p.set(i + j, (p.get(i + j) ?? 0) + product);
  }
  return tidy(p);
}
function polynomial(text: string): Polynomial {
  const tokens = text.match(/(?:\d+(?:\.\d*)?|\.\d+)|z|[()+*^\-]/g) ?? [];
  if (!tokens.length || tokens.join('') !== text || tokens.length > 256) fail('Use real numbers, z, integer powers, sums and products (at most 256 symbols).');
  let i = 0;
  const peek = () => tokens[i];
  function atom(): Polynomial {
    let p: Polynomial;
    if (peek() === '(') { i++; p = sum(); if (tokens[i++] !== ')') fail('Close each parenthesis.'); }
    else if (peek() === 'z') { i++; p = new Map([[1, 1]]); }
    else {
      const n = tokens[i++];
      if (!n || !/^\d|^\.\d/.test(n)) fail('Enter a number, z or a parenthesized polynomial.');
      const value = Number(n);
      if (!Number.isFinite(value) || Math.abs(value) > 1e6) fail('Each entered coefficient must be finite with magnitude at most 1,000,000.');
      if (value === 0 && /[1-9]/.test(n)) fail('A nonzero coefficient is too small for double-precision arithmetic. Rescale the expression.');
      p = tidy(new Map([[0, value]]));
    }
    if (peek() === '^') {
      i++; let sign = 1;
      if (peek() === '-' || peek() === '+') sign = tokens[i++] === '-' ? -1 : 1;
      const token = tokens[i++];
      const exponent = sign * Number(token);
      if (!token || !/^\d+$/.test(token) || Math.abs(exponent) > MAX) fail('Use integer powers from −6 to 6.');
      if (exponent < 0) {
        if (p.size !== 1 || p.get(1) !== 1) fail('Negative powers are supported for z only.');
        p = new Map([[exponent, 1]]);
      } else {
        const base = p; p = new Map([[0, 1]]);
        for (let j = 0; j < exponent; j++) p = multiply(p, base);
      }
    }
    return p;
  }
  function signed(): Polynomial {
    if (peek() === '+' || peek() === '-') { const sign = tokens[i++] === '-' ? -1 : 1; return multiply(new Map([[0, sign]]), signed()); }
    return atom();
  }
  function product(): Polynomial {
    let p = signed();
    while (peek() === '*' || peek() === '(' || peek() === 'z') {
      if (peek() === '*') i++;
      p = multiply(p, signed());
    }
    return p;
  }
  function sum(): Polynomial {
    let p = product();
    while (peek() === '+' || peek() === '-') { const sign = tokens[i++] === '+' ? 1 : -1; p = add(p, product(), sign); }
    return p;
  }
  const result = sum();
  if (i !== tokens.length) fail('Check the polynomial: unsupported or misplaced symbol.');
  return result;
}
function unwrap(text: string): string {
  let balance = 0;
  for (const character of text) {
    balance += character === '(' ? 1 : character === ')' ? -1 : 0;
    if (balance < 0) fail('Balance the outer parentheses.');
  }
  if (balance !== 0) fail('Balance the outer parentheses.');
  while (text.startsWith('(') && text.endsWith(')')) {
    let depth = 0, whole = true;
    for (let i = 0; i < text.length - 1; i++) { depth += text[i] === '(' ? 1 : text[i] === ')' ? -1 : 0; if (depth === 0) { whole = false; break; } }
    if (!whole) break;
    text = text.slice(1, -1);
  }
  return text;
}
function splitFraction(text: string): [string, string] {
  text = unwrap(text);
  const prefix = /^[+-]+/.exec(text)?.[0];
  if (prefix) {
    const operand = text.slice(prefix.length), unwrapped = unwrap(operand);
    // A sign before a whole fraction/group applies to that whole operand.
    // Otherwise leave it in the polynomial: -2+1 must remain (-2)+1.
    if (operand.startsWith('\\frac') || unwrapped !== operand) {
      const [numerator, denominator] = splitFraction(operand);
      const negative = [...prefix].filter(character => character === '-').length % 2 === 1;
      return [negative ? `-(${numerator})` : numerator, denominator];
    }
  }
  if (/^\\frac(?=[{0-9])/.test(text)) {
    let i = 5;
    function group(): string {
      // MathLive omits braces around single-token arguments, e.g. \\frac12.
      if (text[i] !== '{') {
        if (/[0-9z]/.test(text[i] ?? '') && text[i] !== undefined) return text[i++];
        fail('Complete the numerator and denominator boxes.');
      }
      i++;
      const start = i; let depth = 1;
      while (i < text.length && depth) { if (text[i] === '{') depth++; if (text[i] === '}') depth--; i++; }
      if (depth) fail('Complete the fraction.');
      return text.slice(start, i - 1);
    }
    const n = group(), d = group();
    if (i !== text.length) fail('Enter one fraction with polynomial numerator and denominator.');
    return [n, d];
  }
  let depth = 0, slash = -1;
  for (let i = 0; i < text.length; i++) {
    depth += text[i] === '(' ? 1 : text[i] === ')' ? -1 : 0;
    if (text[i] === '/' && depth === 0) { if (slash >= 0) fail('Use one fraction.'); slash = i; }
  }
  return slash < 0 ? [text, '1'] : [text.slice(0, slash), text.slice(slash + 1)];
}
export function parseTransfer(latex: string): Model {
  if (!latex.trim()) fail('Enter a transfer function.');
  if (latex.length > 1000) fail('Keep the expression under 1,000 characters.');
  let text = latex.replace(/\\(?:left|right)/g, '').replace(/\\(?:,|!|;|quad|qquad| )/g, '').replace(/\s/g, '')
    .replace(/\\(?:dfrac|tfrac)/g, '\\frac').replace(/\\(?:cdot|times)/g, '*').replace(/−/g, '-');
  text = text.replace(/^G\(z\)=/, '');
  if (/[eE]/.test(text)) fail('Enter decimal coefficients, such as 0.01. The visual editor treats e/E as symbols, so e/E input notation is unsupported.');
  const [n, d] = splitFraction(text);
  const clean = (s: string) => s.replace(/\^\{([+-]?\d+)\}/g, '^$1').replace(/\{/g, '(').replace(/\}/g, ')');
  const numerator = polynomial(clean(n)), denominator = polynomial(clean(d));
  if (!denominator.size) fail('The denominator cannot be zero.');
  const leading = Math.max(...denominator.keys());
  if (numerator.size && Math.max(...numerator.keys()) > leading) fail('Improper transfer function: isolating y[k] requires future input u[k+r]. It cannot run as an ordinary causal delay recurrence.');
  const lowest = Math.min(...denominator.keys(), ...numerator.keys());
  if (leading - lowest > MAX) fail('Support is limited to six input/output delays after normalization.');
  const scale = denominator.get(leading)!;
  if (Math.abs(scale) < 1e-12 * Math.max(...[...denominator.values()].map(Math.abs))) fail('The leading denominator coefficient is too small relative to the others (limit 10⁻¹²).');
  const coefficients = (p: Polynomial) => {
    const result = Array.from({ length: p.size ? leading - Math.min(...p.keys()) + 1 : 1 }, (_, i) => {
      const coefficient = p.get(leading - i) ?? 0, value = coefficient / scale;
      if (coefficient !== 0 && value === 0) fail('Normalization makes a nonzero coefficient too small for double-precision arithmetic. Rescale the expression.');
      return value;
    });
    if (result.some(v => !Number.isFinite(v) || Math.abs(v) > 1e6)) fail('Normalized coefficients must have magnitude at most 1,000,000.');
    return result;
  };
  return { a: coefficients(denominator), b: coefficients(numerator) };
}
export function validateModel(model: Model): void {
  if (!model.a.length || !model.b.length || model.a.length > 7 || model.b.length > 7 || model.a[0] !== 1 || [...model.a, ...model.b].some(v => !Number.isFinite(v) || Math.abs(v) > 1e6)) fail('Use a normalized finite model with at most six delays.');
}
export interface Memory { readonly k: number; readonly y: readonly number[]; readonly u: readonly number[] }
export interface Term { readonly channel: 'u' | 'y'; readonly delay: number; readonly coefficient: number; readonly value: number; readonly contribution: number }
export interface Calculation { readonly terms: readonly Term[]; readonly output: number }
export function preview(model: Model, memory: Memory, input: number): Calculation {
  validateModel(model);
  if (!Number.isInteger(memory.k) || memory.k < 0 || memory.k >= 128) fail('The visit is limited to 128 samples; restart the experiment.');
  if (memory.y.length !== model.a.length - 1 || memory.u.length !== model.b.length - 1) fail('Supply one old value for each delay slot.');
  if (![input, ...memory.y, ...memory.u].every(v => Number.isFinite(v) && Math.abs(v) <= 1e12)) fail('Input or memory is nonfinite or exceeds magnitude 10¹².');
  const terms: Term[] = model.b.map((coefficient, delay) => {
    const value = delay === 0 ? input : memory.u[delay - 1];
    return { channel: 'u', delay, coefficient, value, contribution: coefficient * value };
  });
  for (let delay = 1; delay < model.a.length; delay++) {
    const coefficient = -model.a[delay], value = memory.y[delay - 1];
    terms.push({ channel: 'y', delay, coefficient, value, contribution: coefficient * value });
  }
  const output = terms.reduce((sum, term) => sum + term.contribution, 0);
  if (![output, ...terms.map(t => t.contribution)].every(v => Number.isFinite(v) && Math.abs(v) <= 1e12)) fail('This step exceeds magnitude 10¹². Memory was not updated; restart with smaller data or inspect growing modes.');
  return { terms, output };
}
/** Compute first, then shift every register from the same immutable old memory. */
export function commit(model: Model, memory: Memory, input: number): Memory {
  const result = preview(model, memory, input);
  return { k: memory.k + 1, y: [result.output, ...memory.y].slice(0, model.a.length - 1), u: [input, ...memory.u].slice(0, model.b.length - 1) };
}
export type InputKind = 'held' | 'impulse' | 'ramp';
export function sample(kind: InputKind, amplitude: number, k: number, period: number): number {
  if (!Number.isFinite(amplitude) || Math.abs(amplitude) > 1e6) fail('Input amplitude must be finite with magnitude at most 1,000,000.');
  if (!Number.isFinite(period) || period < 1e-6 || period > 10000) fail('Sample period T must be between 0.000001 and 10,000 seconds.');
  if (!Number.isInteger(k) || k < 0 || k >= 128) fail('The visit is limited to 128 samples.');
  return kind === 'held' ? amplitude : kind === 'impulse' ? (k === 0 ? amplitude : 0) : amplitude * k * period;
}
export function numberText(value: number): string { return Number(value.toPrecision(9)).toString(); }
/** Math markup needs a multiplication/power, never JavaScript's ambiguous e notation. */
export function latexNumber(value: number): string {
  return numberText(value).replace(/e([+-]?\d+)$/, (_, exponent: string) => `\\times10^{${Number(exponent)}}`);
}
function sumText(terms: { coefficient: number; symbol: string }[]): string {
  const kept = terms.filter(t => t.coefficient !== 0);
  if (!kept.length) return '0';
  return kept.map((t, i) => `${t.coefficient < 0 ? '-' : i ? '+' : ''}${Math.abs(t.coefficient) === 1 && t.symbol ? '' : latexNumber(Math.abs(t.coefficient))}${t.symbol}`).join('');
}
export function forms(model: Model): { z: string; delay: string; recurrence: string; order: number } {
  const order = Math.max(model.a.length, model.b.length) - 1;
  const poly = (coefficients: readonly number[], inverse: boolean) => sumText(coefficients.map((coefficient, i) => ({ coefficient, symbol: inverse ? (i ? `z^{-${i}}` : '') : (order - i === 1 ? 'z' : order - i ? `z^{${order - i}}` : '') })));
  const indexed = (channel: string, delay: number) => `${channel}[k${delay ? `-${delay}` : ''}]`;
  return {
    order,
    z: `G(z)=\\frac{${poly(model.b, false)}}{${poly(model.a, false)}}`,
    delay: `G(z)=\\frac{${poly(model.b, true)}}{${poly(model.a, true)}}`,
    recurrence: `y[k]=${sumText([...model.b.map((coefficient, i) => ({ coefficient, symbol: indexed('u', i) })), ...model.a.slice(1).map((c, i) => ({ coefficient: -c, symbol: indexed('y', i + 1) }))])}`,
  };
}
