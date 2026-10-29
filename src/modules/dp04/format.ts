import type { Complex, Segment } from './math';
const rounded = (value: number): string => value === 0 ? '0' : Number(value.toPrecision(8)).toString();
export function numberText(value: number): string {
  return rounded(value).replace(/e([+-]?\d+)$/, (_, exponent: string) => '×10' + String(Number(exponent)).split('').map(character => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(character)] ?? (character === '-' ? '⁻' : '⁺')).join(''));
}
export function numberTex(value: number): string { return rounded(value).replace(/e([+-]?\d+)$/, (_, exponent: string) => `\\times10^{${Number(exponent)}}`); }
export function complexText(value: Complex): string { return value.im === 0 ? numberText(value.re) : `${numberText(value.re)} ${value.im < 0 ? '−' : '+'} ${numberText(Math.abs(value.im))}j`; }
export function polynomialTex(coefficients: readonly number[], symbol = 'z'): string {
  return coefficients.map((value, index) => {
    if (value === 0) return '';
    const power = coefficients.length - index - 1;
    const variable = power === 0 ? '' : power === 1 ? symbol : `${symbol}^{${power}}`;
    return `${value < 0 ? '-' : '+'}${Math.abs(value) === 1 && power ? '' : numberTex(Math.abs(value))}${variable}`;
  }).join('').replace(/^\+/, '') || '0';
}
export function intervalText(segment: Segment): string { return `(${segment.left === null ? '−∞' : numberText(segment.left)}, ${segment.right === null ? '∞' : numberText(segment.right)})`; }
