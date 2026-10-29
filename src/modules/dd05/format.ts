import type { Complex } from './math';
const rounded = (value: number) => Number(value.toPrecision(8)).toString();
export function numberText(value: number | null): string {
  if (value === null || Number.isNaN(value)) return 'Undefined';
  if (value === Infinity) return '∞'; if (value === -Infinity) return '−∞';
  return rounded(value).replace(/e([+-]?\d+)$/, ' × 10^$1');
}
export function numberTex(value: number): string { return rounded(value).replace(/e([+-]?\d+)$/, (_, e: string) => `\\times10^{${Number(e)}}`); }
export function complexText(p: Complex) { return p.im === 0 ? numberText(p.re) : `${numberText(p.re)} ${p.im < 0 ? '−' : '+'} ${numberText(Math.abs(p.im))}j`; }
export function polynomialTex(coefficients: number[], variable = 'z') {
  const parts: string[] = [];
  coefficients.forEach((x, i) => { if (x === 0) return; const power = coefficients.length - i - 1; parts.push(`${x < 0 ? '-' : parts.length ? '+' : ''}${power && Math.abs(x) === 1 ? '' : `(${numberTex(Math.abs(x))})`}${power ? power === 1 ? variable : `${variable}^{${power}}` : ''}`); });
  return parts.join('') || '0';
}
