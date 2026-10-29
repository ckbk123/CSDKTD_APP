/** Exact rational arithmetic for the bounded quadratic Jury lesson. */
export interface Rational { readonly n: bigint; readonly d: bigint }
const abs = (n: bigint) => n < 0n ? -n : n;
export function rat(n: bigint | number, d: bigint | number = 1): Rational {
  let a = BigInt(n), b = BigInt(d);
  if (!b) throw new Error('Division by zero is not defined.');
  if (b < 0n) { a = -a; b = -b; }
  let x = abs(a), y = b;
  while (y) { const r = x % y; x = y; y = r; }
  a /= x; b /= x;
  if (abs(a) > 10n ** 24n || b > 10n ** 24n) throw new Error('Arithmetic size limit exceeded; use smaller coefficients.');
  return { n: a, d: b };
}
export const add = (a: Rational, b: Rational) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const neg = (a: Rational) => rat(-a.n, a.d);
export const sub = (a: Rational, b: Rational) => add(a, neg(b));
export const mul = (a: Rational, b: Rational) => rat(a.n * b.n, a.d * b.d);
export const div = (a: Rational, b: Rational) => rat(a.n * b.d, a.d * b.n);
export const cmp = (a: Rational, b: Rational) => a.n * b.d < b.n * a.d ? -1 : a.n * b.d > b.n * a.d ? 1 : 0;
export const num = (a: Rational) => Number(a.n) / Number(a.d);
export const exact = (a: Rational) => a.d === 1n ? String(a.n) : `${a.n}/${a.d}`;
export const latex = (a: Rational): string => a.d === 1n ? String(a.n) : `${a.n < 0n ? '-' : ''}\\frac{${abs(a.n)}}{${a.d}}`;
const ZERO = rat(0), ONE = rat(1);

export function decimal(text: string): Rational {
  if (!/^[+-]?(?:\d{1,8}(?:\.\d{0,6})?|\.\d{1,6})$/.test(text.trim())) throw new Error('Use a finite decimal with at most six decimal places.');
  const s = text.trim(), sign = s.startsWith('-') ? -1n : 1n;
  const [whole, fraction = ''] = s.replace(/^[+-]/, '').split('.');
  const d = 10n ** BigInt(fraction.length);
  return rat(sign * (BigInt(whole || '0') * d + BigInt(fraction || '0')), d);
}

export function parseNumber(text: string): Rational {
  if (text.length > 52) throw new Error('Use a short decimal or a fraction of two decimals.');
  const parts = text.split('/');
  if (parts.length > 2) throw new Error('Use a number or one fraction, such as 20/9.');
  if (parts.length === 2 && parts.every(p => /^[+-]?\d{1,24}$/.test(p.trim()))) return rat(BigInt(parts[0].trim()), BigInt(parts[1].trim()));
  return parts.length === 2 ? div(decimal(parts[0]), decimal(parts[1])) : decimal(text);
}

export interface Affine { readonly slope: Rational; readonly offset: Rational }
export interface Family { readonly b: Affine; readonly a: Affine }
export interface Condition extends Affine { readonly label: string; readonly formula: string }
export interface Interval { readonly lower: Rational | null; readonly upper: Rational | null; readonly empty: boolean }
type Poly = Map<string, Rational>;
const key = (z: number, k: number) => `${z},${k}`;
function constant(r: Rational): Poly { return new Map([[key(0, 0), r]]); }
function plus(a: Poly, b: Poly): Poly {
  const result = new Map(a);
  for (const [k, v] of b) result.set(k, add(result.get(k) ?? ZERO, v));
  return result;
}
function times(a: Poly, b: Poly): Poly {
  const result: Poly = new Map();
  for (const [ka, va] of a) for (const [kb, vb] of b) {
    if (!va.n || !vb.n) continue;
    const [za, pa] = ka.split(',').map(Number), [zb, pb] = kb.split(',').map(Number);
    if (za + zb > 2 || pa + pb > 1) throw new Error('Support is limited to degree two in z and degree one in K.');
    const k = key(za + zb, pa + pb);
    result.set(k, add(result.get(k) ?? ZERO, mul(va, vb)));
  }
  return result;
}

/** MathLive reads a bare number followed by a fraction as a mixed number.
 * Check TeX atom boundaries before arithmetic treats adjacency as a product. */
function rejectMixedNumberAdjacency(text: string): void {
  let cursor = 0;
  type Atom = 'number' | 'fraction' | 'other';
  const fractionCommand = () => /^\\(?:d?frac)/.exec(text.slice(cursor))?.[0];
  function argument(): void {
    if (text[cursor] === '{') { cursor++; scan('}'); if (text[cursor] === '}') cursor++; }
    else if (fractionCommand()) fraction();
    else if (cursor < text.length) cursor++; // One unbraced TeX argument token.
  }
  function fraction(): void { cursor += fractionCommand()!.length; argument(); argument(); }
  function scan(close?: string): { kind: Atom; simple: boolean; signed: boolean } {
    let previous: Atom | null = null, first: Atom = 'other', atoms = 0, compound = false, signed = false;
    function append(kind: Atom): void {
      if (previous === 'number' && kind === 'fraction') throw new Error('A number directly beside a fraction is ambiguous mixed-number notation. Insert + for addition or × for multiplication.');
      if (previous === 'number' && kind === 'number') throw new Error('Separate numeric parts need an explicit operator. Type one complete number, or insert × for multiplication.');
      if (atoms === 0) first = kind;
      else compound = true;
      previous = kind; atoms++;
    }
    while (cursor < text.length && text[cursor] !== close) {
      const character = text[cursor];
      if (fractionCommand()) {
        append('fraction'); fraction();
      } else if (character === '{') {
        cursor++; const group = scan('}'); if (text[cursor] === '}') cursor++;
        // Outside actual fraction/power arguments, braces are invisible in the
        // editor. Only a single atom is safe; signed atoms cannot follow one.
        if (!group.simple || (group.signed && previous !== null)) throw new Error('Hidden braces do not display parentheses. Use visible parentheses for grouping, or write + or × explicitly outside the braces.');
        if (atoms === 0 && group.signed) signed = true;
        append(group.kind);
      } else if (character === '(') {
        cursor++; scan(')'); if (text[cursor] === ')') cursor++;
        append('other');
      } else if (character === '^') {
        cursor++; argument(); previous = 'other'; if (atoms === 1) first = 'other';
      } else {
        const number = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(text.slice(cursor))?.[0];
        if (number) {
          cursor += number.length; append('number');
        } else if (character === 'z' || character === 'K') {
          cursor++; append('other');
        } else {
          cursor++; previous = null;
          if ((character === '+' || character === '-') && atoms === 0) signed = true;
          else compound = true;
        }
      }
    }
    return { kind: first, simple: !compound && atoms === 1, signed };
  }
  scan();
}

/** Recursive descent; no evaluation of code, functions or arbitrary macros. */
export function parseFamily(source: string): Family {
  if (!source.trim() || source.length > 400) throw new Error('Enter a polynomial of at most 400 characters.');
  let text = source.replace(/\\(?:left|right)/g, '').replace(/\\(?:cdot|times)/g, '*').replace(/\\[,!;: ]/g, '').replace(/\s/g, '');
  text = text.replace(/^P\(z\)=/, '');
  rejectMixedNumberAdjacency(text);
  const tokens = text.match(/\\(?:d?frac)|(?:\d+(?:\.\d*)?|\.\d+)|[zK+\-*/^(){}]/g) ?? [];
  if (tokens.join('') !== text || tokens.length > 160) throw new Error('Use z, K, numbers, fractions, parentheses, +, −, × and powers up to two.');
  let pos = 0, depth = 0;
  const peek = () => tokens[pos];
  function grouped(open: string, close: string): Poly {
    if (tokens[pos++] !== open) throw new Error('Complete the fraction or parentheses.');
    const r = sum();
    if (tokens[pos++] !== close) throw new Error('Close each parenthesis or fraction box.');
    return r;
  }
  function scalar(p: Poly): Rational {
    for (const [k, v] of p) if (k !== '0,0' && v.n) throw new Error('A divisor must be a nonzero constant number.');
    return p.get('0,0') ?? ZERO;
  }
  // MathLive may serialize one-character fraction arguments as \frac12.
  // Each unbraced TeX argument is one character, not a whole number token.
  function fractionArgument(): Poly {
    if (peek() === '{') return grouped('{', '}');
    const t = peek();
    if (t && /^\d+$/.test(t)) {
      if (t.length > 1) tokens[pos] = t.slice(1); else pos++;
      return constant(decimal(t[0]));
    }
    if (t === 'z' || t === 'K') { pos++; return new Map([[key(t === 'z' ? 1 : 0, t === 'K' ? 1 : 0), ONE]]); }
    throw new Error('Complete both fraction boxes; group complex fraction arguments.');
  }
  function atom(): Poly {
    if (++depth > 16) throw new Error('Expression nesting limit exceeded.');
    let r: Poly;
    const t = peek();
    if (t === '+' || t === '-') { pos++; r = times(constant(rat(t === '-' ? -1 : 1)), atom()); }
    else if (t === '(') r = grouped('(', ')');
    else if (t === '{') r = grouped('{', '}');
    else if (t === '\\frac' || t === '\\dfrac') {
      pos++; const a = fractionArgument(), b = scalar(fractionArgument());
      r = times(a, constant(div(ONE, b)));
    } else if (t === 'z' || t === 'K') { pos++; r = new Map([[key(t === 'z' ? 1 : 0, t === 'K' ? 1 : 0), ONE]]); }
    else if (t && /^[\d.]/.test(t)) { pos++; r = constant(decimal(t)); }
    else throw new Error('Complete the polynomial; a number, z or K is needed here.');
    if (peek() === '^') {
      pos++; const braces = peek() === '{'; if (braces) pos++;
      const exponent = tokens[pos++];
      if (!['0', '1', '2'].includes(exponent)) throw new Error('Use only integer powers 0, 1 or 2.');
      if (braces && tokens[pos++] !== '}') throw new Error('Complete the exponent.');
      r = exponent === '0' ? constant(ONE) : exponent === '2' ? times(r, r) : r;
    }
    depth--; return r;
  }
  function product(): Poly {
    let r = atom();
    while (pos < tokens.length) {
      const t = peek();
      if (t === '*' || t === '/') {
        pos++; const right = atom(); r = times(r, t === '/' ? constant(div(ONE, scalar(right))) : right);
      } else if (t === '(' || t === '{' || t === 'z' || t === 'K' || t === '\\frac' || t === '\\dfrac' || /^[\d.]/.test(t)) r = times(r, atom());
      else break;
    }
    return r;
  }
  function sum(): Poly {
    let r = product();
    while (peek() === '+' || peek() === '-') { const op = tokens[pos++]; r = plus(r, times(constant(rat(op === '+' ? 1 : -1)), product())); }
    return r;
  }
  const p = sum();
  if (pos !== tokens.length) throw new Error('Check the polynomial notation.');
  if (cmp(p.get('2,0') ?? ZERO, ONE) || (p.get('2,1')?.n ?? 0n)) throw new Error('Use a monic quadratic: z² + b(K)z + a(K). The leading coefficient must be 1.');
  const coefficient = (z: number): Affine => ({ slope: p.get(key(z, 1)) ?? ZERO, offset: p.get(key(z, 0)) ?? ZERO });
  const family = { b: coefficient(1), a: coefficient(0) };
  for (const c of [family.a, family.b]) for (const r of [c.slope, c.offset]) {
    if (Math.abs(num(r)) > 10000 || r.d > 1000000n) throw new Error('Coefficient magnitudes must be at most 10,000, with denominators at most 1,000,000.');
  }
  return family;
}

export const evaluate = (a: Affine, k: Rational) => add(mul(a.slope, k), a.offset);
export function conditions(f: Family): Condition[] {
  const make = (label: string, formula: string, aSign: number, bSign: number): Condition => ({ label, formula,
    slope: add(mul(rat(aSign), f.a.slope), mul(rat(bSign), f.b.slope)),
    offset: add(ONE, add(mul(rat(aSign), f.a.offset), mul(rat(bSign), f.b.offset))) });
  return [make('At z = +1', 'P(1)=1+b+a', 1, 1), make('At z = −1', 'P(-1)=1-b+a', 1, -1),
    make('Constant below +1', '1-a', -1, 0), make('Constant above −1', '1+a', 1, 0)];
}
export function intersect(cs: readonly Affine[]): Interval {
  let lower: Rational | null = null, upper: Rational | null = null, empty = false;
  for (const c of cs) {
    if (!c.slope.n) { if (c.offset.n <= 0n) empty = true; continue; }
    const bound = div(neg(c.offset), c.slope);
    if (c.slope.n > 0n) { if (lower === null || cmp(bound, lower) > 0) lower = bound; }
    else if (upper === null || cmp(bound, upper) < 0) upper = bound;
  }
  return { lower, upper, empty: empty || (lower !== null && upper !== null && cmp(lower, upper) >= 0) };
}
export function intervalText(i: Interval): string {
  if (i.empty) return 'No strictly stable K';
  if (i.lower === null && i.upper === null) return 'All real K';
  if (i.lower === null) return `K < ${exact(i.upper!)}`;
  if (i.upper === null) return `K > ${exact(i.lower)}`;
  return `${exact(i.lower)} < K < ${exact(i.upper)}`;
}
export interface Root { readonly re: number; readonly im: number }
export function roots(b: number, a: number): Root[] {
  if (![a, b].every(Number.isFinite)) throw new Error('Coefficients must be finite.');
  const discriminant = b * b - 4 * a;
  if (discriminant < 0) return [{ re: -b / 2, im: Math.sqrt(-discriminant) / 2 }, { re: -b / 2, im: -Math.sqrt(-discriminant) / 2 }];
  const q = -(b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant)) / 2;
  return q === 0 ? [{ re: 0, im: 0 }, { re: 0, im: 0 }] : [{ re: q, im: 0 }, { re: a / q, im: 0 }];
}
export function at(f: Family, k: Rational) {
  if (cmp(k, rat(-10000)) < 0 || cmp(k, rat(10000)) > 0) throw new Error('Use |K| ≤ 10,000.');
  const a = evaluate(f.a, k), b = evaluate(f.b, k), values = conditions(f).map(c => evaluate(c, k));
  const stable = values.every(v => v.n > 0n);
  const boundary = !stable && values.every(v => v.n >= 0n);
  return { a, b, values, stable, boundary, roots: roots(num(b), num(a)), row: [sub(ONE, mul(a, a)), mul(b, sub(ONE, a)), ZERO] };
}
