import type { Complex, Loop } from './math';
export function number(value: number | null, digits = 8): string {
  if (value === null || Number.isNaN(value)) return 'Undefined';
  if (value === Infinity) return '∞'; if (value === -Infinity) return '−∞';
  return Number(value.toPrecision(digits)).toString().replace(/e([+-]?\d+)/, ' × 10^$1');
}
/** Round-trip decimal for the visual parser, without programming exponents. */
export function decimal(value: number): string {
  const text = value.toString(); if (!/[eE]/.test(text)) return text;
  const negative = value < 0 ? '-' : '', [mantissa, exponent] = text.replace('-', '').split('e'), digits = mantissa.replace('.', '');
  const point = (mantissa.indexOf('.') < 0 ? mantissa.length : mantissa.indexOf('.')) + Number(exponent);
  return negative + (point <= 0 ? '0.' + '0'.repeat(-point) + digits : point >= digits.length ? digits + '0'.repeat(point - digits.length) : digits.slice(0, point) + '.' + digits.slice(point));
}
export function polynomial(values: number[]): string {
  const parts: string[] = [];
  values.forEach((value, i) => {
    if (value === 0) return;
    const power = values.length - i - 1, sign = value < 0 ? '-' : parts.length ? '+' : '', coefficient = Math.abs(value);
    parts.push(sign + (power && coefficient === 1 ? '' : decimal(coefficient)) + (power === 0 ? '' : power === 1 ? 'z' : `z^{${power}}`));
  });
  return parts.join('') || '0';
}
export function loopLatex(loop: Loop) { return `\\frac{${polynomial(loop.numerator)}}{${polynomial(loop.denominator)}}`; }
export function complex(p: Complex) { return p.im === 0 ? number(p.re) : `${number(p.re)} ${p.im < 0 ? '−' : '+'} ${number(Math.abs(p.im))}j`; }
