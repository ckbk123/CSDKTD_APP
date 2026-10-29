import { add, compare, decimal, div, mul, neg, ONE, rational, toNumber, ZERO, type Rational } from './rational';

/** Polynomials use ascending powers; the visual grammar is bounded to degree 3. */
export type Polynomial = readonly Rational[];
export function trim(poly: Polynomial): Rational[] { const result = [...poly]; while (result.length > 1 && !result.at(-1)!.n) result.pop(); return result.length ? result : [ZERO]; }
export function plus(a: Polynomial, b: Polynomial): Rational[] { return trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => add(a[i] ?? ZERO, b[i] ?? ZERO))); }
export function scale(poly: Polynomial, value: Rational): Rational[] { return trim(poly.map(item => mul(item, value))); }

export function parsePolynomial(latex: string): Rational[] {
  if (!latex.trim()) throw new Error('Enter a numerator or denominator polynomial.');
  if (latex.length > 400) throw new Error('Use at most 400 characters in a polynomial.');
  const source = latex.replace(/\\(?:left|right)/g, '').replace(/\\(?:,|;|!|quad|qquad)|\s/g, '')
    .replace(/\\(?:cdot|times)/g, '*').replace(/−/g, '-');
  let position = 0, operations = 0, depth = 0;
  const fail = (): never => { throw new Error('Use a polynomial in s with decimals, visible parentheses, sums/products, powers 0–3 and fractions with numeric denominators. Other symbols/functions, e/E shortcuts and negative powers are unsupported.'); };
  function checked(poly: Polynomial): Rational[] {
    const result = trim(poly), bound = rational(1_000_000_000n);
    if (result.length > 4) throw new Error('Use a polynomial of degree at most three.');
    if (result.some(value => compare(value, bound) > 0 || compare(value, neg(bound)) < 0)) throw new Error('Keep intermediate coefficients within 10⁹ in magnitude. Rescale the expression.');
    result.forEach(value => toNumber(value)); return result;
  }
  function productOf(a: Polynomial, b: Polynomial): Rational[] {
    const result = Array.from({ length: a.length + b.length - 1 }, () => ZERO);
    a.forEach((value, i) => b.forEach((other, j) => { result[i + j] = add(result[i + j], mul(value, other)); }));
    return checked(result);
  }
  function group(closing: string): Rational[] {
    if (++depth > 12) throw new Error('Use at most 12 nested groups or fractions.');
    const result = expression();
    if (source[position] !== closing) throw new Error('Complete the parentheses or fraction boxes.');
    position++; depth--; return result;
  }
  function argument(): Rational[] {
    if (source[position] === '{') { position++; return group('}'); }
    // A bare TeX argument is one token, not an arbitrary run of digits.
    if (/\d/.test(source[position] ?? '') && position < source.length) return [decimal(source[position++])];
    if (source[position] === 's' || source[position] === '\\') return primary();
    throw new Error('Complete the fraction or power using its visual boxes.');
  }
  function primary(): Rational[] {
    if (++operations > 160) throw new Error('Use a shorter expression (at most 160 operations).');
    if (source[position] === '(') { position++; return group(')'); }
    if (source[position] === '{') throw new Error('Hidden braces are not visible parentheses. Use the parentheses button to show grouping.');
    if (source[position] === 's') { position++; return [ZERO, ONE]; }
    if (source[position] === '\\') {
      const command = /^\\([a-zA-Z]+)/.exec(source.slice(position)); if (!command) return fail();
      position += command[0].length;
      if (['frac', 'dfrac', 'tfrac'].includes(command[1])) {
        if (++depth > 12) throw new Error('Use at most 12 nested groups or fractions.');
        const numerator = argument(), denominator = argument(); depth--;
        if (denominator.length !== 1) throw new Error('A fraction inside a polynomial must have a numeric denominator.');
        return checked(numerator.map(value => div(value, denominator[0])));
      }
      if (['mathrm', 'mathit', 'mathbf', 'mathsf', 'mathtt'].includes(command[1])) {
        const start = position, value = argument();
        const atom = source.slice(start, position).replace(/\\(?:mathrm|mathit|mathbf|mathsf|mathtt)/g, '').replace(/[{}]/g, '');
        if (!/^(?:\d+(?:\.\d*)?|\.\d+|s)$/.test(atom)) throw new Error('A font wrapper cannot group arithmetic. Re-enter with ordinary math keys and visible parentheses.');
        return value;
      }
      return fail();
    }
    const literal = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(position)); if (!literal) return fail();
    position += literal[0].length; return checked([decimal(literal[0])]);
  }
  function power(): Rational[] {
    const base = primary(); if (source[position] !== '^') return base;
    position++;
    const braced = source[position] === '{';
    const groupingMessage = 'Use the power boxes to group the whole exponent. Adjacent digits, decimal points or a leading sign need explicit grouping.';
    if (!braced && /[+\-.]/.test(source[position] ?? '')) throw new Error(groupingMessage);
    const exponent = argument();
    if (!braced && /[\d.]/.test(source[position] ?? '')) throw new Error(groupingMessage);
    if (exponent.length !== 1 || exponent[0].d !== 1n || exponent[0].n < 0n || exponent[0].n > 3n) throw new Error('Polynomial powers must be the integers 0, 1, 2 or 3.');
    if (!exponent[0].n && base.every(value => !value.n)) throw new Error('Zero to the zeroth power is not supported.');
    let result: Rational[] = [ONE]; for (let i = 0n; i < exponent[0].n; i++) result = productOf(result, base); return result;
  }
  function unary(): Rational[] {
    let negative = false; while (source[position] === '+' || source[position] === '-') { if (source[position++] === '-') negative = !negative; }
    const result = power(); return negative ? scale(result, neg(ONE)) : result;
  }
  function product(): Rational[] {
    const first = position;
    let value = unary(), lastFactor = source.slice(first, position);
    // A power is a complete displayed factor, not a mixed-number integer.
    const numericFactor = (text: string): boolean => !text.includes('^') && !text.replace(/\\[a-zA-Z]+/g, '').includes('s');
    while (position < source.length) {
      if (source[position] === '*') { position++; const start = position; value = productOf(value, unary()); lastFactor = source.slice(start, position); }
      else if (/[\d.s(\\{]/.test(source[position])) {
        const start = position, next = unary();
        const nextFactor = source.slice(start, position);
        if ((numericFactor(lastFactor) && numericFactor(nextFactor) && source[start] !== '(')
          || (numericFactor(lastFactor) && /\\(?:dfrac|tfrac|frac)(?![A-Za-z])/.test(nextFactor))) {
          throw new Error('Numeric/fraction adjacency can mean joined digits or a mixed number. Insert + for addition or × for multiplication.');
        }
        value = productOf(value, next); lastFactor = nextFactor;
      } else break;
    }
    return value;
  }
  function expression(): Rational[] {
    let value = product();
    while (source[position] === '+' || source[position] === '-') { const sign = source[position++] === '+' ? ONE : neg(ONE); value = checked(plus(value, scale(product(), sign))); }
    return value;
  }
  const result = expression(); if (position !== source.length) return fail(); return result;
}

