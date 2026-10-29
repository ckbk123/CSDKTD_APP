/** Private bounded scalar rational algebra; inputs are displayed numeric values. */
export interface Rational { readonly n: bigint; readonly d: bigint }
function gcdInt(a: bigint, b: bigint): bigint { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { const r = a % b; a = b; b = r; } return a; }
export function rat(n: bigint, d = 1n): Rational {
  if (!d) throw new Error('A fraction denominator cannot be zero.'); const divisor = gcdInt(n, d), sign = d < 0n ? -1n : 1n; return { n: sign * n / divisor, d: sign * d / divisor };
}
export const add = (a: Rational, b: Rational): Rational => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const neg = (a: Rational): Rational => rat(-a.n, a.d);
export const sub = (a: Rational, b: Rational): Rational => add(a, neg(b));
export const mul = (a: Rational, b: Rational): Rational => rat(a.n * b.n, a.d * b.d);
export const div = (a: Rational, b: Rational): Rational => rat(a.n * b.d, a.d * b.n);
export const num = (a: Rational): number => Number(a.n) / Number(a.d);
export const equal = (a: Rational, b: Rational): boolean => a.n === b.n && a.d === b.d;
export const latexRat = (a: Rational): string => a.d === 1n ? String(a.n) : `${a.n < 0n ? '-' : ''}\\frac{${a.n < 0n ? -a.n : a.n}}{${a.d}}`;
export const textRat = (a: Rational): string => a.d === 1n ? String(a.n) : `${a.n}/${a.d}`;
export const zero = rat(0n), one = rat(1n);

/** Decimal entries have <=12 decimal places; exact fractions also hold generated pole products. */
export function parseRational(source: string, limit = 100): Rational {
  if (!source.trim() || source.length > 512) throw new Error('Enter one bounded real number (at most 512 input characters).');
  const s = source.replace(/\s|\\[,;!]/g, '').replace(/−/g, '-').replace(/\\(?:dfrac|tfrac)/g, '\\frac').replace(/\\(?:left|right)/g, '');
  if (s.length > 100) throw new Error('Use at most 100 characters of numeric notation.');
  const decimal = (text: string): Rational => {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || text.replace(/\D/g, '').length > 24) throw new Error('Enter a single numeric value or simple fraction. Mixed numbers, sums, products, e/E symbols and functions are unsupported; evaluate them first (for example, 2½ → 2.5).');
    const negative = text.startsWith('-'), [whole, tail = ''] = text.replace(/^[+-]/, '').split('.');
    if (tail.length > 12) throw new Error('Use at most 12 decimal places.');
    return rat(BigInt((whole || '0') + tail) * (negative ? -1n : 1n), 10n ** BigInt(tail.length));
  };
  const grouped = (text: string): boolean => {
    const open = text[0], close = open === '(' ? ')' : open === '{' ? '}' : ''; if (!close || !text.endsWith(close)) return false;
    let depth = 0; for (let i = 0; i < text.length; i++) { if (text[i] === open) depth++; else if (text[i] === close) depth--; if (depth < 0 || (depth === 0 && i < text.length - 1)) return false; } return depth === 0;
  };
  const scalar = (text: string, depth: number): Rational => {
    if (depth > 8) throw new Error('Use at most eight outer groups/unary signs.');
    if (grouped(text)) return scalar(text.slice(1, -1), depth + 1);
    if (text.startsWith('-') || text.startsWith('+')) { const value = scalar(text.slice(1), depth + 1); return text[0] === '-' ? neg(value) : value; }
    const fraction = /^\\frac(\{[^{}]+\}|\d)(\{[^{}]+\}|\d)$/.exec(text), slash = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\/([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/.exec(text);
    if (!fraction && !slash) return decimal(text);
    const argument = (value: string): string => value.startsWith('{') ? value.slice(1, -1) : value;
    return div(decimal(fraction ? argument(fraction[1]) : slash![1]), decimal(fraction ? argument(fraction[2]) : slash![2]));
  };
  const value = scalar(s, 0);
  if ((value.n < 0n ? -value.n : value.n) > BigInt(limit) * value.d || value.d > 1000000000000000000n) throw new Error(`Numeric magnitude must be at most ${limit} and the reduced denominator at most 10¹⁸.`);
  return value;
}
