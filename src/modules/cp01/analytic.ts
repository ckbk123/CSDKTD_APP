import { initialState, type Excitation, type Model } from './model';
import { add, decimal, div, mul, neg, rational, sub, toNumber, ZERO, type Rational } from './rational';

/** Exact real basis: exp(rate*t) [c C_delta(t) + k S_delta(t)]. */
export interface Block { readonly rate: Rational; readonly delta: Rational; readonly c: Rational; readonly k: Rational }
export interface Expression { readonly polynomial: readonly Rational[]; readonly blocks: readonly Block[] }
const two = rational(2n), six = rational(6n);
const block = (rate: Rational, c: Rational, k = ZERO, delta = ZERO): Block => ({ rate, delta, c, k });
function expression(polynomial: readonly Rational[] = [], blocks: readonly Block[] = []): Expression {
  const p = [...polynomial], kept: Block[] = [];
  for (const b of blocks) {
    if (!b.c.n && !b.k.n) continue;
    if (!b.rate.n && !b.delta.n) { p[0] = add(p[0] ?? ZERO, b.c); p[1] = add(p[1] ?? ZERO, b.k); }
    else kept.push(b);
  }
  while (p.length && !p.at(-1)!.n) p.pop();
  return { polynomial: p, blocks: kept };
}
export function scale(e: Expression, gain: Rational): Expression {
  return expression(e.polynomial.map(c => mul(c, gain)), e.blocks.map(b => ({ ...b, c: mul(b.c, gain), k: mul(b.k, gain) })));
}
export function freeTerms(m: Model, initial: readonly Rational[]): Expression {
  initialState(m, initial);
  const [b0, b1 = ZERO] = m.b, [w, v = ZERO] = initial;
  const c = add(mul(b0, w), mul(b1, v));
  if (m.order === 1) return expression([], [block(neg(m.a0), c)]);
  const k = add(mul(sub(mul(m.alpha, b0), mul(m.a0, b1)), w), mul(sub(b0, mul(m.alpha, b1)), v));
  return expression([], [block(neg(m.alpha), c, k, m.delta)]);
}
/** Unit-input regular response, including ordinary direct feedthrough. */
export function unitTerms(m: Model, kind: 'step' | 'ramp' | 'impulse'): Expression {
  const [b0, b1 = ZERO] = m.b, d = m.direct;
  let p: Rational[] = [], blocks: Block[] = [];
  if (m.order === 1) {
    if (kind === 'impulse') blocks = [block(neg(m.a0), b0)];
    else if (m.a0.n) {
      const dc = div(b0, m.a0), moment = div(dc, m.a0);
      if (kind === 'step') { p = [dc]; blocks = [block(neg(m.a0), neg(dc))]; }
      else { p = [neg(moment), dc]; blocks = [block(neg(m.a0), moment)]; }
    } else p = kind === 'step' ? [ZERO, b0] : [ZERO, ZERO, div(b0, two)];
  } else if (kind === 'impulse') blocks = [block(neg(m.alpha), b1, sub(b0, mul(m.alpha, b1)), m.delta)];
  else if (m.a0.n) {
    const dc = div(b0, m.a0), moment = sub(div(b1, m.a0), div(mul(b0, m.a1), mul(m.a0, m.a0)));
    if (kind === 'step') { p = [dc]; blocks = [block(neg(m.alpha), neg(dc), sub(b1, mul(m.alpha, dc)), m.delta)]; }
    else { p = [moment, dc]; blocks = [block(neg(m.alpha), neg(moment), sub(neg(dc), mul(m.alpha, moment)), m.delta)]; }
  } else if (m.a1.n) {
    const dc = div(b0, m.a1), transient = sub(b1, dc), once = div(transient, m.a1), twice = div(once, m.a1);
    if (kind === 'step') { p = [once, dc]; blocks = [block(neg(m.a1), neg(once))]; }
    else { p = [neg(twice), once, div(dc, two)]; blocks = [block(neg(m.a1), twice)]; }
  } else p = kind === 'step' ? [ZERO, b1, div(b0, two)] : [ZERO, ZERO, div(b1, two), div(b0, six)];
  if (kind === 'step') p[0] = add(p[0] ?? ZERO, d);
  else if (kind === 'ramp') { p[0] ??= ZERO; p[1] = add(p[1] ?? ZERO, d); }
  return expression(p, blocks);
}
export function forcedTerms(m: Model, input: Excitation): Expression {
  return input.kind === 'free' ? expression() : scale(unitTerms(m, input.kind === 'pulse' ? 'step' : input.kind), input.kind === 'pulse' ? div(input.amplitude, input.width) : input.amplitude);
}
function exponentialProduct(coefficient: number, exponent: number): number {
  if (!coefficient) return 0; // A true zero component must never amplify numerical noise.
  const result = Math.abs(exponent) < 700 ? coefficient * Math.exp(exponent)
    : Math.sign(coefficient) * Math.exp(Math.log(Math.abs(coefficient)) + exponent);
  if (!Number.isFinite(result)) throw new Error('A modal response overflowed. Shorten the horizon or rescale the experiment.');
  return result;
}
/** Prepare modal coefficients before exponentiation, without rounding small modes to zero. */
export function compileTerms(e: Expression): (t: number) => number {
  const polynomial = e.polynomial.map(c => toNumber(c));
  const blocks = e.blocks.map(b => {
    const delta = toNumber(b.delta, true), c = toNumber(b.c), k = toNumber(b.k), rate = toNumber(b.rate, true);
    if (delta > 0) {
      const exactBeta = exactRoot(b.delta), beta = Math.sqrt(delta);
      let plus: number, minus: number, plusRate: number, minusRate: number;
      if (exactBeta) {
        // This includes exact stable/slow eigenvectors in an otherwise unstable realization.
        plus = toNumber(div(add(b.c, div(b.k, exactBeta)), two));
        minus = toNumber(div(sub(b.c, div(b.k, exactBeta)), two));
        plusRate = toNumber(add(b.rate, exactBeta), true); minusRate = toNumber(sub(b.rate, exactBeta), true);
      } else {
        // Compute the larger coefficient directly; obtain the small one from its
        // exact rational product. Subtracting rounded c and k/beta loses real modes.
        const modalProduct = div(sub(mul(b.c, b.c), div(mul(b.k, b.k), b.delta)), rational(4n));
        if (b.c.n * b.k.n >= 0n) {
          plus = (c + k / beta) / 2;
          minus = plus ? toNumber(div(modalProduct, decimal(plus.toString(), true))) : 0;
        } else {
          minus = (c - k / beta) / 2;
          plus = minus ? toNumber(div(modalProduct, decimal(minus.toString(), true))) : 0;
        }
        const rateProduct = toNumber(sub(mul(b.rate, b.rate), b.delta), true);
        if (rate >= 0) { plusRate = rate + beta; minusRate = rateProduct / plusRate; }
        else { minusRate = rate - beta; plusRate = rateProduct / minusRate; }
      }
      return (t: number): number => {
        if (!t) return c;
        // The regular basis avoids subtracting large nearly coincident modes.
        if (Math.abs(beta * t) < .5) return exponentialProduct(c * Math.cosh(beta * t) + k * Math.sinh(beta * t) / beta, rate * t);
        return exponentialProduct(plus, plusRate * t) + exponentialProduct(minus, minusRate * t);
      };
    }
    if (delta < 0) {
      const frequency = Math.sqrt(-delta);
      return (t: number): number => exponentialProduct(c * Math.cos(frequency * t) + k * Math.sin(frequency * t) / frequency, rate * t);
    }
    return (t: number): number => exponentialProduct(c + k * t, rate * t);
  });
  return (t: number): number => {
    const value = polynomial.reduceRight((sum, coefficient) => sum * t + coefficient, 0) + blocks.reduce((sum, at) => sum + at(t), 0);
    if (!Number.isFinite(value)) throw new Error('The numerical analytic response exceeded the finite range. Shorten the horizon.');
    return value;
  };
}
/** For a pulse this is its unshifted on-segment; subtract its delayed copy at width. */
export function evaluateTerms(e: Expression, t: number): number { return compileTerms(e)(t); }
function squareRoot(n: bigint): bigint | undefined {
  if (n < 0n) return undefined;
  if (n < 2n) return n;
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) { const y = (x + n / x) / 2n; if (y >= x) return x * x === n ? x : undefined; x = y; }
}
export function exactRoot(value: Rational): Rational | undefined {
  const n = squareRoot(value.n), d = squareRoot(value.d);
  return n === undefined || d === undefined ? undefined : rational(n, d);
}
export function fraction(value: Rational): string {
  const sign = value.n < 0n ? '-' : '', n = value.n < 0n ? -value.n : value.n;
  return value.d === 1n ? `${value.n}` : `${sign}\\frac{${n}}{${value.d}}`;
}
export function polynomial(coefficients: readonly Rational[], variable = 's'): string {
  const terms: string[] = [];
  for (let i = coefficients.length - 1; i >= 0; i--) {
    const c = coefficients[i]; if (!c.n) continue;
    const negative = c.n < 0n, magnitude = negative ? neg(c) : c;
    const coefficient = i && magnitude.n === magnitude.d ? '' : fraction(magnitude);
    const power = i ? `${variable}${i > 1 ? `^{${i}}` : ''}` : '';
    terms.push(`${terms.length ? negative ? '-' : '+' : negative ? '-' : ''}${coefficient}${power}`);
  }
  return terms.join('') || '0';
}
const parentheses = (text: string): string => `\\left(${text}\\right)`;
const exponential = (rate: Rational, t: string): string => !rate.n ? '' : `e^{${polynomial([ZERO, rate], t)}}`;
/** Typeset identities use exact rationals/radicals; no rounded roots decide identities. */
export function termsLatex(e: Expression, t = 't'): string {
  const terms: string[] = [];
  if (e.polynomial.some(c => c.n)) terms.push(polynomial(e.polynomial, t));
  function append(c: Rational, factor: string): void {
    if (!c.n) return;
    const negative = c.n < 0n, magnitude = negative ? neg(c) : c;
    const coeff = factor && magnitude.n === magnitude.d ? '' : fraction(magnitude);
    terms.push(`${negative ? '-' : '+'}${coeff}${factor}`);
  }
  for (const b of e.blocks) {
    const exp = exponential(b.rate, t);
    if (!b.delta.n) {
      if (b.k.n) terms.push(`+${exp}${parentheses(polynomial([b.c, b.k], t))}`);
      else append(b.c, exp);
    } else if (b.delta.n > 0n && exactRoot(b.delta)) {
      const beta = exactRoot(b.delta)!;
      append(div(add(b.c, div(b.k, beta)), two), exponential(add(b.rate, beta), t));
      append(div(sub(b.c, div(b.k, beta)), two), exponential(sub(b.rate, beta), t));
    } else {
      const positive = b.delta.n > 0n, magnitude = positive ? b.delta : neg(b.delta), exact = exactRoot(magnitude);
      const frequency = exact ? fraction(exact) : `\\sqrt{${fraction(magnitude)}}`;
      const argument = `${frequency}${t}`, inner: string[] = [];
      if (b.c.n) inner.push(`${fraction(b.c)}\\${positive ? 'cosh' : 'cos'}${parentheses(argument)}`);
      if (b.k.n) {
        const negative = b.k.n < 0n, sign = negative ? '-' : inner.length ? '+' : '';
        inner.push(`${sign}\\frac{${fraction(negative ? neg(b.k) : b.k)}}{${frequency}}\\${positive ? 'sinh' : 'sin'}${parentheses(argument)}`);
      }
      terms.push(`+${exp}${parentheses(inner.join(''))}`);
    }
  }
  return terms.join('').replace(/^\+/, '') || '0';
}
export function inputTransform(input: Excitation): string {
  const a = fraction(input.amplitude);
  if (input.kind === 'free') return '0';
  if (input.kind === 'impulse') return a;
  if (input.kind === 'pulse') return `\\frac{${a}}{${fraction(input.width)}s}\\left(1-e^{-${fraction(input.width)}s}\\right)`;
  return `\\frac{${a}}{s${input.kind === 'ramp' ? '^2' : ''}}`;
}
export function isZero(e: Expression): boolean { return !e.polynomial.some(c => c.n) && !e.blocks.length; }
