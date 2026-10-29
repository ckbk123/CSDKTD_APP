/** Local bounded expression grammar; adapted from the DR01 grammar and independently tested here. */
/** Coefficients ascend in q=z^-1. All exercise arrays are caller-owned. */
export interface FrequencyModel { readonly b: readonly number[]; readonly a: readonly number[] }

type Fraction = { b: number[]; a: number[] };
const MAX_COEFFICIENT = 1e6;

function trim(p: readonly number[]): number[] {
  const result = [...p];
  while (result.length > 1 && result.at(-1) === 0) result.pop();
  return result;
}
function bounded(p: number[]): number[] {
  if (p.length > 49 || p.some(x => !Number.isFinite(x) || Math.abs(x) > 1e12)) {
    throw new Error('Expression is too large. Use at most four numerator and denominator delays.');
  }
  return trim(p);
}
function add(p: readonly number[], q: readonly number[], sign = 1): number[] {
  return bounded(Array.from({ length: Math.max(p.length, q.length) }, (_, i) => (p[i] ?? 0) + sign * (q[i] ?? 0)));
}
function multiply(p: readonly number[], q: readonly number[]): number[] {
  const r = Array(p.length + q.length - 1).fill(0) as number[];
  p.forEach((v, i) => q.forEach((w, j) => {
    const product = v * w;
    if (v !== 0 && w !== 0 && product === 0) throw new Error('Coefficients underflow numerically. Use less extreme scales.');
    r[i + j] += product;
  }));
  return bounded(r);
}
function simplify(b: number[], a: number[]): Fraction {
  b = trim(b); a = trim(a);
  if (a.every(x => x === 0)) throw new Error('The denominator cannot be zero.');
  while (a.length > 1 && b[0] === 0 && a[0] === 0) { if (b.length > 1) b.shift(); a.shift(); }
  return { b, a };
}
function operation(x: Fraction, y: Fraction, op: string): Fraction {
  if (op === '*') return simplify(multiply(x.b, y.b), multiply(x.a, y.a));
  if (op === '/') return simplify(multiply(x.b, y.a), multiply(x.a, y.b));
  return simplify(add(multiply(x.b, y.a), multiply(y.b, x.a), op === '-' ? -1 : 1), multiply(x.a, y.a));
}

/** MathLive may serialize single-character fraction arguments without braces. */
function expandFractions(source: string, depth = 0): string {
  if (depth > 24) throw new Error('Use fewer nested groups.');
  let cursor = 0, result = '';
  function argument(): string {
    while (/\s/.test(source[cursor] ?? '') && cursor < source.length) cursor++;
    const open = source[cursor];
    if (open === '{') {
      const close = '}', start = ++cursor;
      let level = 1;
      while (cursor < source.length && level) {
        if (source[cursor] === open) level++;
        if (source[cursor] === close) level--;
        if (level) cursor++;
      }
      if (level) throw new Error('Close the fraction or parentheses.');
      const content = source.slice(start, cursor++);
      return expandFractions(content, depth + 1);
    }
    if (open === '(') throw new Error('Parentheses must be inside a complete numerator or denominator. Use the fraction button to group its arguments.');
    if (source.startsWith('\\frac', cursor)) { cursor += 5; return fraction(); }
    if (open && /^[0-9zq]$/.test(open)) { cursor++; return open; }
    throw new Error('Complete both fraction arguments; group multi-character terms inside the fraction.');
  }
  function fraction(): string { const numerator = argument(), denominator = argument(); return `\\frac{${numerator}}{${denominator}}`; }
  while (cursor < source.length) {
    if (source.startsWith('\\frac', cursor)) { cursor += 5; result += fraction(); }
    else result += source[cursor++];
  }
  return result;
}

/** Small arithmetic grammar, never JavaScript evaluation or a symbolic CAS. */
export function parseModel(latex: string): FrequencyModel {
  if (!latex.trim()) throw new Error('Enter a transform or build one from a sequence.');
  if (latex.length > 600) throw new Error('Use an expression of at most 600 characters.');
  const source = expandFractions(latex.replace(/\\(?:left|right|displaystyle|textstyle)\b/g, '')
    .replace(/^\s*[GH]\s*\(\s*z\s*\)\s*=\s*/, '')
    .replace(/\\(?:cdot|times)/g, '*').replace(/\\(?:dfrac|tfrac)/g, '\\frac')
    .replace(/\\[,;! ]/g, '').replace(/−/g, '-'));
  const tokens: string[] = [];
  let pos = 0;
  while (pos < source.length) {
    if (/\s/.test(source[pos])) { pos++; continue; }
    if (/^[eE]/.test(source.slice(pos))) throw new Error('The visual editor displays e/E as a letter. Use a decimal or a typeset power of ten (×10ⁿ) instead of e/E scientific notation.');
    const match = /^(?:\\frac|(?:\d+(?:\.\d*)?|\.\d+)|[zq+\-*/^(){}])/.exec(source.slice(pos));
    if (!match) throw new Error('Use real numbers, z, integer powers, fractions, products and sums only.');
    tokens.push(match[0]); pos += match[0].length;
  }
  if (tokens.length > 240) throw new Error('The expression has too many terms.');
  let cursor = 0, depth = 0;
  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];
  const scalar = (n: number): Fraction => ({ b: [n], a: [1] });
  const atomStart = (token?: string) => !!token && (/^[\d.zq{(]/.test(token) || token === '\\frac');
  function group(): Fraction {
    const open = take();
    if (open !== '{' && open !== '(') throw new Error('Complete the fraction or parentheses.');
    const value = sum();
    if (take() !== (open === '{' ? '}' : ')')) throw new Error('Close the fraction or parentheses.');
    return value;
  }
  function atom(): Fraction {
    if (++depth > 24) throw new Error('Use fewer nested groups.');
    let result: Fraction;
    const token = peek();
    if (token === '{' || token === '(') result = group();
    else if (token === '\\frac') { take(); result = operation(group(), group(), '/'); }
    else if (token === 'z') { take(); result = { b: [1], a: [0, 1] }; }
    else if (token === 'q') { take(); result = { b: [0, 1], a: [1] }; }
    else if (token && /^[\d.]/.test(token)) {
      take(); const n = Number(token);
      if (!Number.isFinite(n) || Math.abs(n) > MAX_COEFFICIENT || (n !== 0 && Math.abs(n) < 1e-12) || (n === 0 && /[1-9]/.test(token))) throw new Error('Numbers must be zero or finite with magnitude between 10⁻¹² and 1,000,000.');
      result = scalar(n);
    } else throw new Error('Complete each term with a number, z or a fraction.');
    if (peek() === '^') {
      take(); const braced = peek() === '{'; if (braced) take();
      const sign = peek() === '-' ? (take(), -1) : peek() === '+' ? (take(), 1) : 1;
      const tokenPower = take(); const power = sign * Number(tokenPower);
      if (!tokenPower || !/^\d+$/.test(tokenPower) || Math.abs(power) > 14) throw new Error('Use integer powers between -14 and 14.');
      if (braced && take() !== '}') throw new Error('Close the power.');
      if (power === 0 && result.b.every(x => x === 0)) throw new Error('Zero to the power zero is not supported.');
      const base = power < 0 ? operation(scalar(1), result, '/') : result;
      result = scalar(1);
      for (let i = 0; i < Math.abs(power); i++) result = operation(result, base, '*');
    }
    depth--; return result;
  }
  function unary(): Fraction {
    if (peek() === '+' || peek() === '-') {
      const sign = take(); const value = unary();
      return sign === '-' ? { b: value.b.map(x => -x), a: value.a } : value;
    }
    return atom();
  }
  function product(): Fraction {
    const numericFactor = (start: number, end: number) => tokens.slice(start, end)
      .every(token => /^[\d.]/.test(token) || ['+', '-', '^', '{', '}'].includes(token));
    let start = cursor, value = unary(), previousIsNumeric = numericFactor(start, cursor);
    while (peek() === '*' || peek() === '/' || atomStart(peek())) {
      const explicit = peek() === '*' || peek() === '/';
      // A displayed mixed number uses addition, not implicit multiplication.
      if (!explicit && previousIsNumeric && (peek() === '\\frac' || peek() === '{' || /^[\d.]/.test(peek() ?? ''))) {
        throw new Error('A mixed number or adjacent numeric factors need an explicit sign. Insert + for addition or × for multiplication.');
      }
      const op = explicit ? take() : '*';
      start = cursor;
      const next = unary(); previousIsNumeric = numericFactor(start, cursor);
      value = operation(value, next, op);
    }
    return value;
  }
  function sum(): Fraction {
    let value = product();
    while (peek() === '+' || peek() === '-') { const op = take(); value = operation(value, product(), op); }
    return value;
  }
  const result = sum();
  if (cursor !== tokens.length) throw new Error('Check the grouping and remove unsupported notation.');
  return validateModel(result);
}

export function validateModel(model: FrequencyModel): FrequencyModel {
  if (!model.a.length || !model.b.length || [...model.a, ...model.b].some(x => !Number.isFinite(x))) {
    throw new Error('Enter nonempty finite coefficients.');
  }
  const { a, b } = simplify([...model.b], [...model.a]);
  if (a[0] === 0) throw new Error('This expression needs future samples (a positive power of z). A causal ordinary recurrence cannot realize it.');
  if (a.length > 5 || b.length > 5) throw new Error('Support is limited to denominator order 4 and numerator delay order 4 in z⁻¹.');
  const scale = a[0];
  if (Math.abs(scale) < 1e-10 * Math.max(...a.map(Math.abs))) throw new Error('The leading denominator is too small to normalize reliably.');
  const normalized = { a: a.map(x => x / scale), b: b.map(x => x / scale) };
  if (a.some((x, i) => x !== 0 && normalized.a[i] === 0) || b.some((x, i) => x !== 0 && normalized.b[i] === 0)) {
    throw new Error('Coefficients underflow during normalization. Use less extreme scales.');
  }
  if ([...normalized.a, ...normalized.b].some(x => Math.abs(x) > MAX_COEFFICIENT)) throw new Error('Normalized coefficients must have magnitude at most 1,000,000.');
  return normalized;
}

