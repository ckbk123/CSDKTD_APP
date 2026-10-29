/** Real causal proper models, descending coefficients normalized to a[0]=1.
 * The original denominator is retained; no pole/zero cancellation is performed. */
export interface Model { a: number[]; b: number[] }
export interface Pole { re: number; im: number }
export type Excitation = 'step' | 'impulse' | 'ramp' | 'free';
export interface Experiment {
  T: number; count: number; amplitude: number; history: [number, number]; input: Excitation;
}
export interface Sample { k: number; t: number; u: number; forced: number; free: number; y: number }
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
  s = s.replace(/^G\(z\)=/, '');
  let pos = 0, depth = 0;
  interface Part { text: string; shape: string; endsWithNumber: boolean; containsFraction: boolean }
  function visibleGroup(shape: string): boolean {
    if (!shape.startsWith('(') || !shape.endsWith(')')) return false;
    let level = 0;
    for (let i = 0; i < shape.length; i++) {
      if (shape[i] === '(') level++;
      else if (shape[i] === ')') level--;
      if (level < 0 || level === 0 && i < shape.length - 1) return false;
    }
    return level === 0;
  }
  const fractionCommand = (): string | undefined => /^(?:\\dfrac|\\tfrac|\\frac)/.exec(s.slice(pos))?.[0];
  function fraction(): string {
    pos += fractionCommand()!.length;
    const n = group(), d = group();
    return `((${n.text})/(${d.text}))`;
  }
  function group(): Part {
    if (++depth > 20) fail('Use at most 20 nested groups.');
    let value: Part;
    if (s[pos] === '{') {
      pos++; value = sequence(true);
      if (s[pos++] !== '}') fail('Complete each fraction and brace group.');
    } else if (fractionCommand()) value = { text: fraction(), shape: 'F', endsWithNumber: false, containsFraction: true };
    else {
      if (pos >= s.length || s[pos] === '}') fail('Complete the numerator and denominator of each fraction.');
      const token = s[pos++]; // TeX permits a single unbraced token, as in \frac12.
      value = { text: token, shape: token, endsWithNumber: /[0-9.]/.test(token), containsFraction: false };
    }
    depth--; return value;
  }
  function sequence(stopAtBrace: boolean): Part {
    let text = '', shape = '', endsWithNumber = false, containsFraction = false;
    while (pos < s.length && !(stopAtBrace && s[pos] === '}')) {
      if (fractionCommand()) {
        // Preserve the distinction between a mixed number and a product before
        // fractions and hidden brace groups lose their original boundaries.
        if (endsWithNumber) fail('Write an explicit + or × between a number and a fraction; mixed-number adjacency is not supported.');
        text += fraction(); shape += 'F'; endsWithNumber = false; containsFraction = true;
      } else if (s[pos] === '{') {
        const part = group();
        // TeX braces are invisible. Only retain an atomic wrapper or a group
        // already enclosed by visible parentheses, never invent precedence.
        const unsigned = part.shape.replace(/^[+-]/, '');
        if (!/^(?:\d+(?:\.\d*)?|\.\d+|z|F)(?:\^(?:[012]|\([012]\)))?$/.test(unsigned) && !visibleGroup(unsigned)) {
          fail('Use visible parentheses to group an expression; TeX braces do not display parentheses.');
        }
        if (/^[+-]/.test(part.shape) && (/[0-9.zF)]$/.test(shape) || s[pos] === '^')) {
          fail('Use visible parentheses around a signed group, or write an explicit + or × before it.');
        }
        if (endsWithNumber && /^[0-9.]/.test(part.shape)) fail('Write an explicit + or × between separate numbers instead of hidden TeX braces.');
        if (endsWithNumber && part.containsFraction) fail('Write an explicit + or × before a fraction-containing group; hidden braces do not show multiplication.');
        text += `(${part.text})`; shape += part.shape; endsWithNumber = part.endsWithNumber; containsFraction ||= part.containsFraction;
      } else if (s[pos] === '^') {
        // A numeric exponent is not a mixed-number whole part: a fraction
        // following z² remains an ordinary implicit product.
        text += s[pos++]; const braced = s[pos] === '{', power = group();
        text += braced ? `(${power.text})` : power.text; shape += `^${power.shape}`; endsWithNumber = false; containsFraction ||= power.containsFraction;
      }
      else if (s[pos] === '}') fail('Remove the unmatched closing brace.');
      else { const token = s[pos++]; text += token; shape += token; endsWithNumber = /[0-9.]/.test(token); }
    }
    return { text, shape, endsWithNumber, containsFraction };
  }
  return sequence(false).text;
}

/** Bounded recursive-descent rational polynomial parser. +,-,*,/, implicit
 * multiplication, parentheses and integer powers 0..2; z is the only variable. */
export function parseModel(latex: string): Model {
  const s = plain(latex);
  const tokens = s.match(/(?:\d+(?:\.\d*)?|\.\d+)|z|[()+\-*/^]/g) ?? [];
  if (tokens.join('') !== s || !tokens.length) fail('Use real numbers and z with fractions, powers 0–2, sums or products.');
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
    } else if (t === 'z') r = { n: [0, 1], d: [1] };
    else if (t && /^(?:\d|\.)/.test(t)) {
      const x = Number(t);
      if (!Number.isFinite(x) || x > 1e6) fail('Each entered number must be finite and at most 10⁶ in magnitude.');
      if (x === 0 && /[1-9]/.test(t)) fail('A nonzero decimal is too small for numeric representation. Rescale the expression.');
      r = { n: [x], d: [1] };
    } else return fail('Complete each term with a number, z or a parenthesized expression.');
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
      } else if (t === '(' || t === 'z') r = product(r, unary());
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
  if (r.d.length < 2 || r.d.length > 3) fail('Use a first- or second-order denominator in z.');
  if (r.n.length > r.d.length) fail('This is improper: a future input would be needed. Use numerator degree no greater than denominator degree.');
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

export function poles(model: Model): Pole[] {
  const a = model.a;
  if (a.length === 2) return [{ re: -a[1], im: 0 }];
  const d = a[1] * a[1] - 4 * a[2];
  if (d < 0) return [{ re: -a[1] / 2, im: Math.sqrt(-d) / 2 }, { re: -a[1] / 2, im: -Math.sqrt(-d) / 2 }];
  // Stable quadratic formula avoids subtracting nearly equal numbers.
  const q = -0.5 * (a[1] + (a[1] >= 0 ? 1 : -1) * Math.sqrt(d));
  return q === 0 ? [{ re: 0, im: 0 }, { re: 0, im: 0 }]
    : [{ re: q, im: 0 }, { re: a[2] / q, im: 0 }];
}

export function classify(p: Pole): string {
  const r = Math.hypot(p.re, p.im);
  const envelope = r < 1 - 1e-9 ? 'decays' : r > 1 + 1e-9 ? 'grows' : 'on the unit circle (within 10⁻⁹)';
  return `${envelope}; ${p.im !== 0 ? 'oscillates' : p.re < 0 ? 'alternates sign' : 'no sign alternation'}`;
}

export function simulate(model: Model, e: Experiment): Sample[] {
  const { T, count, amplitude, history, input } = e;
  if (!Number.isFinite(T) || T < 1e-4 || T > 100) fail('Sample period T must be from 0.0001 to 100 seconds.');
  if (!Number.isInteger(count) || count < 4 || count > 200) fail('Show an integer from 4 to 200 samples.');
  if (![amplitude, ...history].every(x => Number.isFinite(x) && Math.abs(x) <= 1e4)) fail('Amplitude and output histories must be finite, with magnitude at most 10⁴.');
  if (!['step', 'impulse', 'ramp', 'free'].includes(input)) fail('Select step, impulse, ramp or free response.');
  const rows: Sample[] = [];
  const forcing = (k: number): number => k < 0 ? 0 : input === 'step' ? amplitude
    : input === 'impulse' ? (k === 0 ? amplitude : 0) : input === 'ramp' ? amplitude * k * T : 0;
  for (let k = 0; k < count; k++) {
    let forced = model.b.reduce((total, b, i) => total + b * forcing(k - i), 0);
    let free = 0;
    for (let i = 1; i < model.a.length; i++) {
      forced -= model.a[i] * (rows[k - i]?.forced ?? 0);
      free -= model.a[i] * (k - i < 0 ? history[i - k - 1] : rows[k - i].free);
    }
    const y = forced + free;
    if (![forced, free, y].every(x => Number.isFinite(x) && Math.abs(x) <= 1e10)) fail(`Response exceeded the 10¹⁰ display bound at sample ${k}. Shorten the horizon or reduce the gain/history.`);
    rows.push({ k, t: k * T, u: forcing(k), forced, free, y });
  }
  return rows;
}

export const format = (x: number): string => x === 0 ? '0' : Number(x.toPrecision(6)).toString();
export const tex = (x: number): string => format(x).replace(/e([+-]?\d+)/, '\\times10^{$1}');
const num = (x: number): string => `(${tex(x)})`;

/** Decomposition of the zero-input response for k>=0. Forced response is
 * computed independently by recurrence, not by an ill-conditioned residue sum. */
export function freeDecomposition(model: Model, rows: Sample[]): string {
  return `y_{free}[k]=${modalFormula(model, rows[0].free, rows[1].free, 'k')}`;
}

function modalFormula(model: Model, f0: number, f1: number, index: string): string {
  const p = poles(model);
  if (p.length === 1) return `${num(f0)}${num(p[0].re)}^{${index}}`;
  if (p[0].im !== 0) {
    const r = Math.hypot(p[0].re, p[0].im);
    const theta = Math.atan2(p[0].im, p[0].re);
    const c = (f1 / r - f0 * Math.cos(theta)) / Math.sin(theta);
    return `${num(r)}^{${index}}[${num(f0)}\\cos(${tex(theta)}${index})+${num(c)}\\sin(${tex(theta)}${index})]`;
  }
  const x = p[0].re, y = p[1].re;
  if (x === y) {
    if (x === 0) return f0 === 0 && f1 === 0 ? '0' : `${num(f0)}\\delta[${index}]+${num(f1)}\\delta[${index}-1]`;
    return `[${num(f0)}+${num(f1 / x - f0)}${index}]${num(x)}^{${index}}`;
  }
  if (Math.abs(x - y) < 1e-7 * Math.max(1, Math.abs(x), Math.abs(y))) {
    return '\\text{Nearly coincident poles: use the displayed recurrence for the free response.}';
  }
  const c = (f1 - y * f0) / (x - y);
  return `${num(c)}${num(x)}^{${index}}+${num(f0 - c)}${num(y)}^{${index}}`;
}

export function impulseDecomposition(model: Model): string {
  const n = model.a.length - 1;
  // Four explanatory unit-kernel coefficients are bounded work. They do not
  // share the amplitude/display bound of the student's selected experiment.
  // With normalized coefficients <=10^6 these four values remain finite.
  const h: number[] = [];
  for (let k = 0; k < 4; k++) {
    h[k] = (model.b[k] ?? 0) - model.a.slice(1).reduce((sum, a, j) => sum + a * (h[k - j - 1] ?? 0), 0);
  }
  const prefix = h.slice(0, n).map((value, k) => `h[${k}]=${tex(value)}`).join(',\\quad ');
  return `${prefix};\\quad h[k]=${modalFormula(model, h[n], h[n + 1], `(k-${n})`)}\\quad(k\\geq${n})`;
}

export function recurrence(model: Model): string {
  const terms = model.a.slice(1).map((a, j) => `${num(-a)}y[k-${j + 1}]`)
    .concat(model.b.map((b, j) => `${num(b)}u[${j ? `k-${j}` : 'k'}]`));
  return `y[k]=${terms.join('+')}`;
}

export function modalSamples(radius: number, angle: number, count: number): number[] {
  return Array.from({ length: count }, (_, k) => radius ** k * Math.cos(k * angle));
}
