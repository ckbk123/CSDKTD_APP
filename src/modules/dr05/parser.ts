/** Real causal proper models, descending coefficients normalized to a[0]=1.
 * The original denominator is retained; no pole/zero cancellation is performed. */
export interface Model { a: number[]; b: number[] }
type Poly = number[]; // Parser internals use ascending powers.
interface Rational { n: Poly; d: Poly }
const fail = (message: string): never => { throw new Error(message); };
const trim = (p: Poly): Poly => { while (p.length > 1 && p.at(-1) === 0) p.pop(); return p; };
function bounded(p: Poly): Poly {
  trim(p);
  if (p.length > 7 || p.some(x => !Number.isFinite(x) || Math.abs(x) > 1e12)) {
    fail('Keep expressions small: intermediate degree at most 6 and coefficients at most 10¹².');
  }
  return p;
}
function add(a: Poly, b: Poly, sign = 1): Poly {
  return bounded(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + sign * (b[i] ?? 0)));
}
function mul(a: Poly, b: Poly): Poly {
  const c = Array(a.length + b.length - 1).fill(0) as number[];
  a.forEach((x, i) => b.forEach((y, j) => {
    const product = x * y;
    if (product === 0 && x !== 0 && y !== 0) fail('A nonzero coefficient product is too small for numeric representation. Rescale the expression.');
    c[i + j] += product;
  }));
  return bounded(c);
}

/** Translate only a small, explicit subset of visual notation. Never evaluate code. */
function plain(latex: string): string {
  if (!latex.trim()) fail('Enter a transfer function.');
  if (latex.length > 512) fail('Use an expression of at most 512 characters.');
  if (/\d\s+\d/.test(latex)) fail('Use a multiplication sign between separate numbers.');
  let s = latex.replace(/\\left|\\right/g, '').replace(/\\(?:cdot|times)/g, '*')
    .replace(/\\[,;! ]/g, '').replace(/−/g, '-').replace(/\s/g, '');
  // MathLive can retain an upright/font wrapper around pasted digits. Keep
  // its argument grouped so a compact fraction still consumes one argument.
  // Never strip a font command around e/E, variables or arbitrary algebra.
  s = s.replace(/\\(?:mathrm|mathit|mathbf|mathsf|mathtt|text)\{([+-]?(?:\d+(?:\.\d*)?|\.\d+))\}/g, '{$1}')
    .replace(/\\(?:mathrm|mathit|mathbf|mathsf|mathtt)([0-9])/g, '{$1}');
  s = s.replace(/^G\(s\)=/, '');
  let pos = 0, depth = 0;
  const fractionCommand = (): string | undefined => /^(?:\\dfrac|\\tfrac|\\frac)/.exec(s.slice(pos))?.[0];
  function fraction(): string {
    pos += fractionCommand()!.length;
    const n = group(), d = group();
    return `((${n})/(${d}))`;
  }
  function group(): string {
    if (++depth > 20) fail('Use at most 20 nested groups.');
    let value: string;
    if (s[pos] === '{') {
      pos++; value = sequence(true);
      if (s[pos++] !== '}') fail('Complete each fraction and brace group.');
    } else if (fractionCommand()) value = fraction();
    else {
      if (pos >= s.length || s[pos] === '}') fail('Complete the numerator and denominator of each fraction.');
      value = s[pos++]; // TeX permits a single unbraced token, as in \frac12.
    }
    depth--; return value;
  }
  function sequence(stopAtBrace: boolean): string {
    let value = '';
    while (pos < s.length && !(stopAtBrace && s[pos] === '}')) {
      if (fractionCommand()) value += fraction();
      else if (s[pos] === '{') value += `(${group()})`;
      else if (s[pos] === '}') fail('Remove the unmatched closing brace.');
      else value += s[pos++];
    }
    return value;
  }
  return sequence(false);
}

/** Bounded recursive-descent rational polynomial parser. +,-,*,/, implicit
 * multiplication, parentheses and integer powers 0..2; s is the only variable. */
export function parseModel(latex: string): Model {
  const s = plain(latex);
  const tokens = s.match(/(?:\d+(?:\.\d*)?|\.\d+)|s|[()+\-*/^]/g) ?? [];
  if (tokens.join('') !== s || !tokens.length) fail('Use real numbers and s with fractions, powers 0–2, sums or products.');
  let pos = 0;
  let depth = 0;
  const one = (): Rational => ({ n: [1], d: [1] });
  const product = (a: Rational, b: Rational): Rational => ({ n: mul(a.n, b.n), d: mul(a.d, b.d) });
  function atom(): Rational {
    if (++depth > 20) fail('Use at most 20 nested groups.');
    let r: Rational;
    const t = tokens[pos++];
    if (t === '(') {
      r = sum();
      if (tokens[pos++] !== ')') fail('Close every parenthesis.');
    } else if (t === 's') r = { n: [0, 1], d: [1] };
    else if (t && /^(?:\d|\.)/.test(t)) {
      const x = Number(t);
      if (!Number.isFinite(x) || x > 1e6) fail('Each entered number must be finite and at most 10⁶ in magnitude.');
      if (x === 0 && /[1-9]/.test(t)) fail('A nonzero decimal is too small for numeric representation. Rescale the expression.');
      r = { n: [x], d: [1] };
    } else return fail('Complete each term with a number, s or a parenthesized expression.');
    if (tokens[pos] === '^') {
      pos++;
      const group = tokens[pos] === '(';
      if (group) pos++;
      const power = tokens[pos++];
      if (!/^[012]$/.test(power ?? '')) fail('Only integer powers 0, 1 and 2 are supported.');
      if (group && tokens[pos++] !== ')') fail('Complete the exponent.');
      r = power === '0' ? one() : power === '2' ? product(r, r) : r;
    }
    depth--;
    return r;
  }
  function unary(): Rational {
    if (tokens[pos] === '+' || tokens[pos] === '-') {
      const negative = tokens[pos++] === '-';
      // A bounded sign chain also avoids recursive stack growth.
      const r = atom();
      return negative ? { n: r.n.map(x => -x), d: r.d } : r;
    }
    return atom();
  }
  function term(): Rational {
    let r = unary();
    while (pos < tokens.length) {
      const t = tokens[pos];
      if (t === '*' || t === '/') {
        pos++;
        const q = unary();
        if (t === '/' && q.n.every(x => x === 0)) fail('The denominator cannot be zero.');
        r = product(r, t === '/' ? { n: q.d, d: q.n } : q);
      } else if (t === '(' || t === 's') r = product(r, unary());
      else break;
    }
    return r;
  }
  function sum(): Rational {
    let r = term();
    while (tokens[pos] === '+' || tokens[pos] === '-') {
      const sign = tokens[pos++] === '+' ? 1 : -1;
      const q = term();
      r = { n: add(mul(r.n, q.d), mul(q.n, r.d), sign), d: mul(r.d, q.d) };
    }
    return r;
  }
  const r = sum();
  if (pos !== tokens.length) fail('Check the expression: an operator or closing parenthesis is misplaced.');
  trim(r.n); trim(r.d);
  if (r.d.every(x => x === 0)) fail('The denominator cannot be zero.');
  if (r.d.length < 2 || r.d.length > 3) fail('Use a first- or second-order denominator in s.');
  if (r.n.length > r.d.length) fail('This plant is improper and requires input derivatives. Use numerator degree no greater than denominator degree for this ordinary state model.');
  const leading = r.d.at(-1)!;
  if (Math.abs(leading) < 1e-8) fail('The leading denominator coefficient is too small; rescale the model.');
  const normalize = (x: number): number => {
    const value = x / leading;
    if (value === 0 && x !== 0) fail('A nonzero normalized coefficient is too small for numeric representation. Rescale the expression.');
    return value;
  };
  const a = [...r.d].reverse().map(normalize);
  const b = [...Array(r.d.length - r.n.length).fill(0), ...[...r.n].reverse()].map(normalize);
  if ([...a, ...b].some(x => !Number.isFinite(x) || Math.abs(x) > 1e6)) fail('Normalized coefficients must have magnitude at most 10⁶.');
  return { a, b };
}
