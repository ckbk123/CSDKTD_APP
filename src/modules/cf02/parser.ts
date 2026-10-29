/** Private bounded polynomial entry for CF02. Coefficients are [constant, s]. */
export type Linear = readonly [number, number];

export function parseLinear(latex: string): Linear {
  if (!latex.trim()) throw new Error('Enter a numerator or a finite pole factor.');
  if (latex.length > 400) throw new Error('Use at most 400 characters in this polynomial.');
  const source = latex.replace(/\\(?:left|right)/g, '')
    .replace(/\\(?:,|;|!|quad|qquad)|\s/g, '')
    .replace(/\\(?:cdot|times)/g, '*').replace(/−/g, '-');
  let position = 0, operations = 0, depth = 0;
  const fail = (): never => {
    throw new Error('Use a linear polynomial in s with decimals, sums, products, parentheses and fractions with constant denominators. Other symbols, powers and functions are unsupported.');
  };
  const checked = (values: Linear): Linear => {
    if (values.some(value => !Number.isFinite(value) || Math.abs(value) > 1e12)) throw new Error('Keep each intermediate coefficient finite and at most 10¹² in magnitude. Rescale the expression.');
    return values;
  };
  const multiplyNumber = (a: number, b: number): number => {
    const value = a * b;
    if (value === 0 && a !== 0 && b !== 0) throw new Error('A nonzero product is too small to represent. Rescale the numbers.');
    return value;
  };
  const multiply = (a: Linear, b: Linear): Linear => {
    if (multiplyNumber(a[1], b[1]) !== 0) throw new Error('This entry supports degree at most one. Put the origin integrators in the integrator-count control.');
    return checked([multiplyNumber(a[0], b[0]), multiplyNumber(a[0], b[1]) + multiplyNumber(a[1], b[0])]);
  };
  const divide = (a: Linear, b: Linear): Linear => {
    if (b[1] !== 0) throw new Error('The denominator of a fraction in this polynomial must be constant.');
    if (b[0] === 0) throw new Error('A fraction cannot have a zero denominator.');
    return checked(a.map(value => {
      const quotient = value / b[0];
      if (quotient === 0 && value !== 0) throw new Error('A nonzero ratio is too small to represent. Rescale the numbers.');
      return quotient;
    }) as unknown as Linear);
  };
  function group(closing: string): Linear {
    if (++depth > 12) throw new Error('Use at most 12 nested groups or fractions.');
    const result = expression();
    if (source[position] !== closing) throw new Error('Complete the parentheses or fraction boxes.');
    position++; depth--; return result;
  }
  function argument(): Linear {
    // A bare TeX fraction argument is one token: \\frac123 means (1/2)*3.
    if (source[position] === '{') { position++; return group('}'); }
    if (/\d/.test(source[position] ?? '') && position < source.length) {
      const value = Number(source[position++]); return [value, 0];
    }
    if (source[position] === 's' || source[position] === '\\') return primary();
    throw new Error('Complete the fraction using the visual numerator and denominator boxes.');
  }
  function primary(): Linear {
    if (++operations > 160) throw new Error('Use a shorter expression (at most 160 operations).');
    if (source[position] === '(') { position++; return group(')'); }
    if (source[position] === '{') { position++; return group('}'); }
    if (source[position] === 's') { position++; return [0, 1]; }
    if (source[position] === '\\') {
      const command = /^\\([a-zA-Z]+)/.exec(source.slice(position));
      if (!command) return fail();
      position += command[0].length;
      if (['frac', 'dfrac', 'tfrac'].includes(command[1])) {
        if (++depth > 12) throw new Error('Use at most 12 nested groups or fractions.');
        const numerator = argument(), denominator = argument();
        depth--; return divide(numerator, denominator);
      }
      if (['mathrm', 'mathit', 'mathbf', 'mathsf', 'mathtt', 'text'].includes(command[1])) return argument();
      return fail();
    }
    const literal = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(position));
    if (!literal) return fail();
    position += literal[0].length;
    const value = Number(literal[0]);
    if (value === 0 && /[1-9]/.test(literal[0])) throw new Error('A nonzero literal is too small to represent. Rescale it.');
    return checked([value, 0]);
  }
  function unary(): Linear {
    let sign = 1;
    while (source[position] === '+' || source[position] === '-') { if (source[position++] === '-') sign *= -1; }
    const value = primary(); return [sign * value[0], sign * value[1]];
  }
  function product(): Linear {
    let value = unary();
    while (position < source.length) {
      if (source[position] === '*') { position++; value = multiply(value, unary()); }
      else if (/[\d.s(\\{]/.test(source[position])) value = multiply(value, unary());
      else break;
    }
    return value;
  }
  function expression(): Linear {
    let value = product();
    while (source[position] === '+' || source[position] === '-') {
      const sign = source[position++] === '+' ? 1 : -1;
      const next = product(); value = checked([value[0] + sign * next[0], value[1] + sign * next[1]]);
    }
    return value;
  }
  const result = expression();
  if (position !== source.length) return fail();
  return result.map(value => value === 0 ? 0 : value) as unknown as Linear;
}
