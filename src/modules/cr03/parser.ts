import { normalize, type Transfer } from './math';
function fail(message: string): never { throw new Error(message); }
function checked(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12) fail('The expression exceeds the bounded coefficient range 10¹².');
  return value;
}
function numeric(text: string): number {
  const value = Number(text);
  if (!Number.isFinite(value) || Math.abs(value) > 1e6 || (value === 0 && /[1-9]/.test(text))) fail('A literal coefficient is outside the supported floating-point range or magnitude 10⁶.');
  return value;
}
function notation(latex: string): string {
  if (!latex.trim()) fail('Enter an expression.');
  if (latex.length > 600) fail('Keep the expression within 600 characters.');
  let text = latex.replace(/\\(?:left|right)/g, '').replace(/\\(?:,|!|;|quad|qquad| )/g, '').replace(/\s/g, '').replace(/−/g, '-').replace(/×/g, '*');
  while (true) {
    const next = text.replace(/\\(?:mathrm|mathit|mathbf|mathsf|mathtt|text)\{([+-]?(?:\d+(?:\.\d*)?|\.\d+))\}/g, '$1').replace(/\\mathrm([0-9])/g, '$1');
    if (next === text) break; text = next;
  }
  if (/[0-9.]\\(?:dfrac|tfrac|frac)(?=[{0-9])/.test(text)) fail('Number/fraction adjacency can be a mixed number. Use explicit + or × between values.');
  return text.replace(/\\(?:cdot|times)/g, '*');
}
/** Preserve TeX one-token fraction arguments; keep groups instead of joining digits. */
function expand(text: string): string {
  let position = 0, depth = 0;
  function group(end?: string): string {
    if (++depth > 32) fail('Use at most 32 nested groups.');
    let output = '';
    while (position < text.length && text[position] !== end) {
      if (text.startsWith('\\frac', position) || text.startsWith('\\dfrac', position) || text.startsWith('\\tfrac', position)) {
        const command = /^\\(?:dfrac|tfrac|frac)/.exec(text.slice(position))![0]; position += command.length;
        const top = argument(), bottom = argument(); output += `((${top})/(${bottom}))`;
      } else if (text[position] === '{') { position++; output += `(${group('}')})`; }
      else if (text[position] === '}' || text[position] === '\\') fail('Unsupported notation. Use real coefficients, the named variables, fractions and integer powers.');
      else output += text[position++];
    }
    if (end) { if (text[position] !== end) fail('Close every fraction/group box.'); position++; }
    depth--; return output;
  }
  function argument(): string {
    if (text[position] === '{') { position++; return group('}'); }
    if (/^[YU]0/.test(text.slice(position))) { const variable = text.slice(position, position + 2); position += 2; return variable; }
    if (/[0-9syu]/.test(text[position] ?? '')) return text[position++];
    fail('Complete both fraction boxes; use braces for a multi-symbol argument.');
  }
  return group();
}
interface Algebra<T> {
  number(value: number): T; symbol(name: string): T;
  add(a: T, b: T): T; negate(value: T): T; multiply(a: T, b: T): T; divide(a: T, b: T): T; power(value: T, exponent: number): T;
}
interface Token { readonly value: string; readonly kind: 'number' | 'symbol' | 'operator' }
function expression<T>(text: string, algebra: Algebra<T>): T {
  const tokens: Token[] = []; let offset = 0;
  while (offset < text.length) {
    const match = /^(?:(\d+(?:\.\d*)?|\.\d+)|([A-Za-z][A-Za-z0-9]*)|([()+\-*/^]))/.exec(text.slice(offset));
    if (!match) fail('Use supported coefficients, symbols and complete groups.');
    tokens.push({ value: match[0], kind: match[1] ? 'number' : match[2] ? 'symbol' : 'operator' }); offset += match[0].length;
    if (tokens.length > 256) fail('Use at most 256 expression tokens.');
  }
  let position = 0, depth = 0;
  const peek = () => tokens[position]?.value;
  function sum(): T {
    let value = product();
    while (peek() === '+' || peek() === '-') { const sign = tokens[position++].value, next = product(); value = algebra.add(value, sign === '-' ? algebra.negate(next) : next); }
    return value;
  }
  function product(): T {
    let value = unary();
    while (true) {
      if (peek() === '*' || peek() === '/') { const operation = tokens[position++].value, next = unary(); value = operation === '*' ? algebra.multiply(value, next) : algebra.divide(value, next); }
      else if (peek() === '(' || tokens[position]?.kind === 'symbol' || (tokens[position]?.kind === 'number' && tokens[position - 1]?.value === ')')) value = algebra.multiply(value, unary());
      else return value;
    }
  }
  function unary(): T {
    if (++depth > 32) fail('Use at most 32 nested groups or unary signs.');
    let value: T;
    if (peek() === '+' || peek() === '-') { const sign = tokens[position++].value; value = unary(); if (sign === '-') value = algebra.negate(value); }
    else value = power();
    depth--; return value;
  }
  function power(): T {
    let value = atom();
    if (peek() === '^') {
      position++; const grouped = peek() === '('; if (grouped) position++;
      let sign = 1; if (peek() === '+' || peek() === '-') sign = tokens[position++].value === '-' ? -1 : 1;
      const exponent = tokens[position++];
      if (exponent?.kind !== 'number' || !/^\d+$/.test(exponent.value) || Number(exponent.value) > 4) fail('Use an integer power from −4 to 4.');
      if (grouped) { if (peek() !== ')') fail('Complete the integer power.'); position++; }
      value = algebra.power(value, sign * Number(exponent.value));
    }
    return value;
  }
  function atom(): T {
    const token = tokens[position++]; if (!token) fail('Complete the expression.');
    if (token.kind === 'number') return algebra.number(numeric(token.value));
    if (token.kind === 'symbol') {
      if (/^[eE]/.test(token.value)) fail('The visual e/E is a symbol. Enter a decimal or an explicit power of ten.');
      return algebra.symbol(token.value);
    }
    if (token.value === '(') { const value = sum(); if (peek() !== ')') fail('Close every parenthesis.'); position++; return value; }
    fail('Complete each coefficient, symbol and group.');
  }
  const result = sum(); if (position !== tokens.length) fail('Check the expression operators and parentheses.'); return result;
}

// Ascending internal polynomial arrays. The public model always descends in s.
type Poly = number[];
interface Rational { readonly p: Poly; readonly q: Poly }
function poly(values: Poly): Poly {
  if (values.length > 9) fail('Intermediate polynomial order exceeds eight.');
  values.forEach(checked); while (values.length > 1 && values[values.length - 1] === 0) values.pop(); return values;
}
function plus(a: Poly, b: Poly): Poly { return poly(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0))); }
function times(a: Poly, b: Poly): Poly {
  if (a.length + b.length - 2 > 8) fail('Intermediate polynomial order exceeds eight.');
  const result = Array(a.length + b.length - 1).fill(0) as number[];
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const product = a[i] * b[j]; if (a[i] !== 0 && b[j] !== 0 && product === 0) fail('A polynomial product underflows a nonzero coefficient.');
    result[i + j] += product;
  }
  return poly(result);
}
const rational: Algebra<Rational> = {
  number: value => ({ p: [value], q: [1] }),
  symbol: name => name === 's' ? { p: [0, 1], q: [1] } : fail('Only s and real numeric coefficients are supported in this transfer function.'),
  add: (a, b) => ({ p: plus(times(a.p, b.q), times(b.p, a.q)), q: times(a.q, b.q) }),
  negate: value => ({ p: value.p.map(coefficient => -coefficient), q: value.q }),
  multiply: (a, b) => ({ p: times(a.p, b.p), q: times(a.q, b.q) }),
  divide: (a, b) => {
    if (b.p.every(value => value === 0)) fail('A fraction denominator is the zero polynomial.');
    return { p: times(a.p, b.q), q: times(a.q, b.p) };
  },
  power: (value, exponent) => {
    if (exponent === 0 && value.p.every(coefficient => coefficient === 0)) fail('Zero to the zero power is unsupported.');
    let result = { p: [1], q: [1] };
    for (let i = 0; i < Math.abs(exponent); i++) result = rational.multiply(result, value);
    return exponent < 0 ? rational.divide({ p: [1], q: [1] }, result) : result;
  },
};
export function parseTransfer(latex: string): Transfer {
  const text = notation(latex).replace(/^[GHL]\(s\)=/, '');
  if (text.includes('=')) fail('Use G(s)= followed by one transfer expression, or omit the label.');
  const value = expression(expand(text), rational);
  return normalize({ numerator: [...value.p].reverse(), denominator: [...value.q].reverse() });
}

interface Linear { readonly constant: number; readonly coefficients: readonly number[] }
function linearValue(constant: number, coefficients = Array(10).fill(0) as number[]): Linear { checked(constant); coefficients.forEach(checked); return { constant, coefficients }; }
function isScalar(value: Linear): boolean { return value.coefficients.every(coefficient => coefficient === 0); }
function linearScale(value: Linear, factor: number): Linear {
  const multiply = (coefficient: number) => {
    const next = coefficient * factor;
    if (coefficient !== 0 && factor !== 0 && next === 0) fail('A scalar product underflows a nonzero coefficient.');
    return next;
  };
  return linearValue(multiply(value.constant), value.coefficients.map(multiply));
}
const linear: Algebra<Linear> = {
  number: value => linearValue(value),
  symbol: name => {
    if (!/^[YU][0-4]$/.test(name)) fail('Use only y, u and their derivatives through order four.');
    const coefficients = Array(10).fill(0) as number[]; coefficients[(name[0] === 'U' ? 5 : 0) + Number(name[1])] = 1; return linearValue(0, coefficients);
  },
  add: (a, b) => linearValue(a.constant + b.constant, a.coefficients.map((coefficient, i) => coefficient + b.coefficients[i])),
  negate: value => linearScale(value, -1),
  multiply: (a, b) => isScalar(a) ? linearScale(b, a.constant) : isScalar(b) ? linearScale(a, b.constant) : fail('Products of y/u or their derivatives are nonlinear and unsupported.'),
  divide: (a, b) => {
    if (!isScalar(b)) fail('An ODE coefficient denominator must be numeric.');
    if (b.constant === 0) fail('A numeric coefficient cannot divide by zero.');
    return linearScale(a, checked(1 / b.constant));
  },
  power: (value, exponent) => {
    if (!isScalar(value)) { if (exponent === 1) return value; return fail('Use derivative primes or y⁽³⁾, not powers of a dependent variable.'); }
    if (value.constant === 0 && exponent <= 0) fail('Zero cannot have this exponent.');
    const result = value.constant ** exponent;
    if (value.constant !== 0 && result === 0) fail('A coefficient power underflows.');
    return linearValue(result);
  },
};
export function parseOde(latex: string): Transfer {
  let text = notation(latex);
  if (/[A-Z]/.test(text)) fail('Use lower-case y and u in the time-domain ODE.');
  text = text.replace(/\\ddot\{?([yu])\}?/g, "$1''").replace(/\\dot\{?([yu])\}?/g, "$1'")
    .replace(/\\doubleprime/g, "''").replace(/\\prime/g, "'").replace(/′/g, "'").replace(/″/g, "''");
  text = text.replace(/([yu])\^\{\(([0-4])\)\}/g, (_, name: string, order: string) => `${name === 'y' ? 'Y' : 'U'}${order}`)
    .replace(/([yu])((?:\^\{'+\}|\^'+|')+)/g, (_, name: string, suffix: string) => {
      const order = [...suffix].filter(character => character === "'").length;
      if (order > 4) fail('Only derivatives through order four are supported.');
      return `${name === 'y' ? 'Y' : 'U'}${order}`;
    }).replace(/[yu]/g, name => name === 'y' ? 'Y0' : 'U0');
  const sides = text.split('='); if (sides.length !== 2 || sides.some(side => !side)) fail('Use one complete ODE equality.');
  const left = expression(expand(sides[0]), linear), right = expression(expand(sides[1]), linear);
  if (left.constant !== right.constant) fail('An independent constant forcing term is unsupported; express the forcing through the same scalar u.');
  const denominator = left.coefficients.slice(0, 5).map((value, i) => value - right.coefficients[i]).reverse();
  const numerator = right.coefficients.slice(5).map((value, i) => value - left.coefficients[5 + i]).reverse();
  return normalize({ numerator, denominator });
}
