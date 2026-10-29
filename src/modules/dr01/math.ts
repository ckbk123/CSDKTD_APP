/** Coefficients ascend in q=z^-1. All exercise arrays are caller-owned. */
export interface Transform { readonly b: readonly number[]; readonly a: readonly number[] }
export interface Pole { readonly re: number; readonly im: number }
type Fraction = { b: number[]; a: number[] };
const MAX_COEFFICIENT = 1e6;

function trim(p: readonly number[]): number[] {
  const result = [...p];
  while (result.length > 1 && result.at(-1) === 0) result.pop();
  return result;
}
function bounded(p: number[]): number[] {
  if (p.length > 49 || p.some(x => !Number.isFinite(x) || Math.abs(x) > 1e12)) {
    throw new Error('Expression is too large. Use at most 14 delays and two denominator terms.');
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

/** Small arithmetic grammar, never JavaScript evaluation or a symbolic CAS. */
export function parseTransform(latex: string): Transform {
  if (!latex.trim()) throw new Error('Enter a transform or build one from a sequence.');
  if (latex.length > 600) throw new Error('Use an expression of at most 600 characters.');
  const source = latex.replace(/^\s*[XH]\s*\(\s*z\s*\)\s*=\s*/, '')
    .replace(/\\(?:left|right|displaystyle|textstyle)\b/g, '')
    .replace(/\\(?:cdot|times)/g, '*').replace(/\\(?:dfrac|tfrac)/g, '\\frac')
    .replace(/\\[,;! ]/g, '').replace(/−/g, '-');
  const tokens: string[] = [];
  let pos = 0;
  while (pos < source.length) {
    if (/\s/.test(source[pos])) { pos++; continue; }
    const match = /^(?:\\frac|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[zq+\-*/^(){}])/.exec(source.slice(pos));
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
      if (!Number.isFinite(n) || Math.abs(n) > MAX_COEFFICIENT || (n !== 0 && Math.abs(n) < 1e-12) || (n === 0 && /[1-9]/.test(token.split(/[eE]/)[0]))) throw new Error('Numbers must be zero or finite with magnitude between 10⁻¹² and 1,000,000.');
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
    let value = unary();
    while (peek() === '*' || peek() === '/' || atomStart(peek())) {
      const op = peek() === '*' || peek() === '/' ? take() : '*';
      value = operation(value, unary(), op);
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
  return validateTransform(result);
}

export function validateTransform(model: Transform): Transform {
  if (!model.a.length || !model.b.length || [...model.a, ...model.b].some(x => !Number.isFinite(x))) {
    throw new Error('Enter nonempty finite coefficients.');
  }
  const { a, b } = simplify([...model.b], [...model.a]);
  if (a[0] === 0) throw new Error('This expression needs future samples (a positive power of z). A causal ordinary recurrence cannot realize it.');
  if (a.length > 3 || b.length > 15) throw new Error('Support is limited to denominator order 2 and numerator delay order 14 in z⁻¹.');
  const scale = a[0];
  if (Math.abs(scale) < 1e-10 * Math.max(...a.map(Math.abs))) throw new Error('The leading denominator is too small to normalize reliably.');
  const normalized = { a: a.map(x => x / scale), b: b.map(x => x / scale) };
  if (a.some((x, i) => x !== 0 && normalized.a[i] === 0) || b.some((x, i) => x !== 0 && normalized.b[i] === 0)) {
    throw new Error('Coefficients underflow during normalization. Use less extreme scales.');
  }
  if ([...normalized.a, ...normalized.b].some(x => Math.abs(x) > MAX_COEFFICIENT)) throw new Error('Normalized coefficients must have magnitude at most 1,000,000.');
  return normalized;
}

export function poles(model: Transform): Pole[] {
  const a = model.a;
  if (a.length === 1) return [];
  if (a.length === 2) return [{ re: -a[1], im: 0 }];
  const d = a[1] ** 2 - 4 * a[2];
  if (d < 0) return [{ re: -a[1] / 2, im: Math.sqrt(-d) / 2 }, { re: -a[1] / 2, im: -Math.sqrt(-d) / 2 }];
  const r = -0.5 * (a[1] + (a[1] >= 0 ? 1 : -1) * Math.sqrt(d));
  return [{ re: r, im: 0 }, { re: r === 0 ? 0 : a[2] / r, im: 0 }];
}

export interface Sample { readonly k: number; readonly forcing: number; readonly feedback: readonly number[]; readonly value: number }
export function initialNumerator(model: Transform, history: readonly number[]): number[] {
  if (history.length !== 2 || history.some(x => !Number.isFinite(x) || Math.abs(x) > MAX_COEFFICIENT)) throw new Error('Enter two finite history values of magnitude at most 1,000,000.');
  const [h1, h2] = history, [, a1 = 0, a2 = 0] = model.a;
  return add(model.b, [-a1 * h1 - a2 * h2, -a2 * h1]);
}
export function samples(model: Transform, history: readonly number[], count: number): Sample[] {
  if (!Number.isInteger(count) || count < 4 || count > 64) throw new Error('Choose an integer sample count from 4 to 64.');
  // Validate histories even when the model has no memory.
  initialNumerator(model, history);
  const result: Sample[] = [];
  for (let k = 0; k < count; k++) {
    const feedback = model.a.slice(1).map((a, j) => -a * (k - j - 1 < 0 ? history[j - k] : result[k - j - 1].value));
    const forcing = model.b[k] ?? 0;
    const value = forcing + feedback.reduce((a, b) => a + b, 0);
    if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error(`Sample ${k} exceeds the numerical bound (10¹²). Reduce the horizon, poles or history.`);
    result.push({ k, forcing, feedback, value });
  }
  return result;
}

export type SequenceKind = 'geometric' | 'sum' | 'average';
export function fromSequence(kind: SequenceKind, gain: number, pole: number, delay: number, length: number): Transform {
  if (!['geometric', 'sum', 'average'].includes(kind)) throw new Error('Choose a supported sequence family.');
  if (![gain, pole].every(x => Number.isFinite(x) && (x === 0 || Math.abs(x) >= 1e-12)) || Math.abs(gain) > 1e6 || Math.abs(pole) > 10) throw new Error('Use zero or finite gain/pole of magnitude at least 10⁻¹², with |gain|≤10⁶ and |pole|≤10.');
  if (!Number.isInteger(delay) || delay < 0 || delay > 12) throw new Error('Delay must be an integer from 0 to 12 samples.');
  if (!Number.isInteger(length) || length < 1 || length > 12 || (kind !== 'geometric' && delay + length > 15)) throw new Error('Length must be 1–12 and the last nonzero sample at most k=14.');
  const b = Array(delay).fill(0) as number[];
  if (kind === 'geometric') b.push(gain);
  else b.push(...Array(length).fill(kind === 'average' ? gain / length : gain));
  return validateTransform({ b, a: kind === 'geometric' ? [1, -pole] : [1] });
}

export function format(n: number): string {
  if (n === 0 || Object.is(n, -0)) return '0';
  return Number(n.toPrecision(7)).toString();
}
export function numberLatex(n: number, fullPrecision = false): string { return (fullPrecision ? n.toString() : format(n)).replace(/e([+-]?\d+)/, '\\times10^{$1}'); }
export function polynomial(p: readonly number[], variable: 'q' | 'z', power = 0, fullPrecision = false): string {
  const terms = p.flatMap((c, i) => {
    if (c === 0) return [];
    const exponent = variable === 'q' ? i : power - i;
    const factor = exponent === 0 ? '' : exponent === 1 ? variable : `${variable}^{${exponent}}`;
    const magnitude = Math.abs(c) === 1 && factor ? '' : numberLatex(Math.abs(c), fullPrecision);
    return [{ negative: c < 0, term: magnitude + factor }];
  });
  return terms.map(({ negative, term }, i) => `${negative ? '-' : i ? '+' : ''}${term}`).join('') || '0';
}
export function transformLatex(model: Transform, variable: 'q' | 'z' = 'q', fullPrecision = false): string {
  const power = Math.max(model.b.length, model.a.length) - 1;
  const b = polynomial(model.b, variable, power, fullPrecision), a = polynomial(model.a, variable, power, fullPrecision);
  const expression = a === '1' ? b : `\\frac{${b}}{${a}}`;
  return variable === 'q' ? expression.replace(/q/g, 'z^{-1}').replace(/z\^\{-1\}\^\{(\d+)\}/g, (_, i: string) => `z^{-${i}}`) : expression;
}
