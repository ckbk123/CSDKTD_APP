import { add, compare, decimal, div, mul, neg, ONE, rational, toNumber, ZERO, type Rational } from './rational';

/** Private bounded polynomial entry for CF02. Coefficients are [constant, s]. */
export type Linear = readonly [number, number];
export type ExactLinear = readonly [Rational, Rational];

export function parseLinearExact(latex: string): ExactLinear {
  if (!latex.trim()) throw new Error('Enter a numerator or a finite pole factor.');
  if (latex.length > 400) throw new Error('Use at most 400 characters in this polynomial.');
  const source = latex.replace(/\\(?:left|right)/g, '')
    .replace(/\\(?:,|;|!|quad|qquad)|\s/g, '')
    .replace(/\\(?:cdot|times)/g, '*').replace(/−/g, '-');
  let position = 0, operations = 0, depth = 0;
  const fail = (): never => {
    throw new Error('Use a linear polynomial in s with decimals, sums, products, parentheses and fractions with constant denominators. Other symbols, powers and functions are unsupported.');
  };
  const checked = (values: ExactLinear): ExactLinear => {
    const bound = rational(1_000_000_000_000n);
    if (values.some(value => compare(value, bound) > 0 || compare(value, neg(bound)) < 0)) throw new Error('Keep each intermediate coefficient finite and at most 10¹² in magnitude. Rescale the expression.');
    values.forEach(value => toNumber(value));
    return values;
  };
  const multiply = (a: ExactLinear, b: ExactLinear): ExactLinear => {
    if (a[1].n && b[1].n) throw new Error('This entry supports degree at most one. Put the origin integrators in the integrator-count control.');
    return checked([mul(a[0], b[0]), add(mul(a[0], b[1]), mul(a[1], b[0]))]);
  };
  const divide = (a: ExactLinear, b: ExactLinear): ExactLinear => {
    if (b[1].n) throw new Error('The denominator of a fraction in this polynomial must be constant.');
    return checked([div(a[0], b[0]), div(a[1], b[0])]);
  };
  function group(closing: string): ExactLinear {
    if (++depth > 12) throw new Error('Use at most 12 nested groups or fractions.');
    const result = expression();
    if (source[position] !== closing) throw new Error('Complete the parentheses or fraction boxes.');
    position++; depth--; return result;
  }
  function argument(): ExactLinear {
    // A bare TeX fraction argument is one token: \\frac123 means (1/2)*3.
    if (source[position] === '{') { position++; return group('}'); }
    if (/\d/.test(source[position] ?? '') && position < source.length) {
      const value = decimal(source[position++]); return [value, ZERO];
    }
    if (source[position] === 's' || source[position] === '\\') return primary();
    throw new Error('Complete the fraction using the visual numerator and denominator boxes.');
  }
  function primary(): ExactLinear {
    if (++operations > 160) throw new Error('Use a shorter expression (at most 160 operations).');
    if (source[position] === '(') { position++; return group(')'); }
    if (source[position] === '{') throw new Error('Hidden braces are not visible parentheses. Use the parentheses button to show grouping explicitly.');
    if (source[position] === 's') { position++; return [ZERO, ONE]; }
    if (source[position] === '\\') {
      const command = /^\\([a-zA-Z]+)/.exec(source.slice(position));
      if (!command) return fail();
      position += command[0].length;
      if (['frac', 'dfrac', 'tfrac'].includes(command[1])) {
        if (++depth > 12) throw new Error('Use at most 12 nested groups or fractions.');
        const numerator = argument(), denominator = argument();
        depth--; return divide(numerator, denominator);
      }
      if (['mathrm', 'mathit', 'mathbf', 'mathsf', 'mathtt'].includes(command[1])) {
        const start = position, value = argument();
        const atom = source.slice(start, position).replace(/\\(?:mathrm|mathit|mathbf|mathsf|mathtt)/g, '').replace(/[{}]/g, '');
        if (!/^(?:\d+(?:\.\d*)?|\.\d+|s)$/.test(atom)) throw new Error('A font wrapper cannot group arithmetic. Re-enter with ordinary math keys and visible parentheses.');
        return value;
      }
      return fail();
    }
    const literal = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(position));
    if (!literal) return fail();
    position += literal[0].length;
    return checked([decimal(literal[0]), ZERO]);
  }
  function unary(): ExactLinear {
    let sign = 1;
    while (source[position] === '+' || source[position] === '-') { if (source[position++] === '-') sign *= -1; }
    const value = primary(); return sign === 1 ? value : [neg(value[0]), neg(value[1])];
  }
  function product(): ExactLinear {
    const first = position;
    let value = unary(), lastFactor = source.slice(first, position);
    // Validated factor text, rather than its polynomial result, determines
    // numeric adjacency. In s2½ the last factor is 2; in 2s½ it is s.
    const numericFactor = (text: string): boolean => !text.replace(/\\[a-zA-Z]+/g, '').includes('s');
    while (position < source.length) {
      if (source[position] === '*') {
        position++; const start = position;
        value = multiply(value, unary()); lastFactor = source.slice(start, position);
      }
      else if (/[\d.s(\\{]/.test(source[position])) {
        const start = position, next = unary();
        const nextFactor = source.slice(start, position);
        if (numericFactor(lastFactor) && numericFactor(nextFactor) && source[start] !== '(') throw new Error('Adjacent numeric factors can display as a mixed number or joined digits. Insert + for addition or × for multiplication.');
        // MathLive can typeset number/fraction adjacency as a mixed number
        // (invisible plus). Require an explicit operator for this narrower
        // grammar, including wrapped/grouped/nested fraction forms.
        if (numericFactor(lastFactor) && /\\(?:dfrac|tfrac|frac)(?![A-Za-z])/.test(nextFactor)) {
          throw new Error('A constant next to a fraction can be a mixed number. Insert + for addition or × for multiplication, including before a fraction-containing group.');
        }
        value = multiply(value, next); lastFactor = nextFactor;
      }
      else break;
    }
    return value;
  }
  function expression(): ExactLinear {
    let value = product();
    while (source[position] === '+' || source[position] === '-') {
      const sign = source[position++] === '+' ? 1 : -1;
      const next = product(); value = checked([add(value[0], sign === 1 ? next[0] : neg(next[0])), add(value[1], sign === 1 ? next[1] : neg(next[1]))]);
    }
    return value;
  }
  const result = expression();
  if (position !== source.length) return fail();
  return result;
}

export function parseLinear(latex: string): Linear { const result = parseLinearExact(latex); return [toNumber(result[0]), toNumber(result[1])]; }
