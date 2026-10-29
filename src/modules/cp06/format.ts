import { neg, ZERO, type Rational } from './rational';
export function fraction(value: Rational): string {
  const negative = value.n < 0n, n = negative ? -value.n : value.n;
  return value.d === 1n ? String(value.n) : `${negative ? '-' : ''}\\frac{${n}}{${value.d}}`;
}
export function polynomial(coefficients: readonly Rational[], variable = 's'): string {
  const terms: string[] = [];
  for (let i = coefficients.length - 1; i >= 0; i--) {
    const value = coefficients[i]; if (!value.n) continue;
    const negative = value.n < 0n, magnitude = negative ? neg(value) : value;
    const coefficient = i && magnitude.n === magnitude.d ? '' : fraction(magnitude);
    terms.push(`${terms.length ? negative ? '-' : '+' : negative ? '-' : ''}${coefficient}${i ? variable + (i > 1 ? `^{${i}}` : '') : ''}`);
  }
  return terms.join('') || fraction(ZERO);
}
export const numeric = (value: number): string => value === 0 ? '0' : Number(value.toPrecision(7)).toString();
export function numericLatex(value: number): string {
  const text = numeric(value), match = /^(.+)e([+-]?\d+)$/.exec(text);
  return match ? `${match[1]}\\times10^{${Number(match[2])}}` : text;
}
