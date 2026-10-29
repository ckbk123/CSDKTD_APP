import { rejectSpacingArguments } from '../../shared/tex-arguments';

/** Numeric mathematics only. TeX arguments are consumed before any spacing is removed. */
export function parseNumber(source: string): number {
  if (!source.trim()) throw new Error('Enter a number in each model field.');
  if (source.length > 512) throw new Error('Use at most 512 characters in a model field.');
  rejectSpacingArguments(source);
  const tokens = source.match(/\\[a-zA-Z]+|\\.|\d+(?:\.\d*)?|\.\d+|[^\s]/g) ?? [];
  let at = 0, depth = 0, work = 0;
  const peek = () => tokens[at];
  const take = () => tokens[at++];
  function spaces(): void {
    while (/^\\(?:[,;! ]|quad|qquad)$/.test(peek() ?? '')) at++;
  }
  function finite(n: number): number {
    if (++work > 128 || !Number.isFinite(n) || Math.abs(n) > 1e8 || (n !== 0 && Math.abs(n) < 1e-8)) {
      throw new Error('Keep intermediate numbers between 10⁻⁸ and 10⁸ (or exactly zero), with at most 128 operations.');
    }
    return n;
  }
  function argument(): number {
    spaces();
    if (peek() === '{') {
      take(); const n = expression(); spaces();
      if (take() !== '}') throw new Error('Complete the fraction or power box.');
      return n;
    }
    // One unbraced TeX token, including one digit rather than one decimal literal.
    const token = peek();
    if (token && /^\d/.test(token)) {
      const digit = token[0];
      if (token.length === 1) take(); else tokens[at] = token.slice(1);
      return Number(digit);
    }
    throw new Error('Complete each fraction or power box; use the visual buttons.');
  }
  function atom(): number {
    spaces();
    if (++depth > 12) throw new Error('Use at most 12 nested number groups.');
    let n: number;
    const token = take();
    if (token && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) {
      n = Number(token);
      if (n === 0 && /[1-9]/.test(token)) throw new Error('This nonzero number is too small to represent. Rescale the model.');
      n = finite(n);
    }
    else if (token === '(' || token === '\\left') {
      if (token === '\\left' && take() !== '(') throw new Error('Use visible parentheses for grouping.');
      n = expression(); spaces();
      if (token === '\\left' && take() !== '\\right') throw new Error('Close the visible parentheses.');
      if (take() !== ')') throw new Error('Close the visible parentheses.');
    } else if (/^\\(?:dfrac|tfrac|frac)$/.test(token ?? '')) {
      const numerator = argument(), denominator = argument();
      if (denominator === 0) throw new Error('A fraction denominator cannot be zero.');
      n = finite(numerator / denominator);
    } else throw new Error('Use numbers, fractions, visible parentheses, +, −, ×, ÷ and integer powers. Symbols and hidden brace groups are unsupported.');
    spaces();
    if (peek() === '^') {
      take(); const grouped = peek() === '{';
      const power = argument();
      if (!grouped && /^\d/.test(peek() ?? '')) throw new Error('Put the whole exponent inside the power box.');
      if (!Number.isInteger(power) || Math.abs(power) > 6) throw new Error('Use an integer power from −6 to 6.');
      if (n === 0 && power <= 0) throw new Error('Zero to a nonpositive power is unsupported.');
      n = finite(n ** power);
    }
    depth--; return n;
  }
  function signed(): number {
    spaces();
    if (peek() === '+' || peek() === '-') { const sign = take(); return (sign === '-' ? -1 : 1) * atom(); }
    return atom();
  }
  function product(): number {
    let n = signed(); spaces();
    while (['*', '/', '\\times', '\\cdot', '\\div'].includes(peek() ?? '')) {
      const op = take(), rhs = signed();
      if ((op === '/' || op === '\\div') && rhs === 0) throw new Error('A denominator cannot be zero.');
      n = finite(op === '/' || op === '\\div' ? n / rhs : n * rhs); spaces();
    }
    return n;
  }
  function expression(): number {
    let n = product(); spaces();
    while (peek() === '+' || peek() === '-') {
      const op = take(), rhs = product(); n = finite(op === '+' ? n + rhs : n - rhs); spaces();
    }
    return n;
  }
  const result = expression(); spaces();
  if (at !== tokens.length) throw new Error('Use an explicit + or × between numbers and fractions. Mixed numbers, e/E notation, symbols and hidden groups are unsupported.');
  return finite(result);
}
