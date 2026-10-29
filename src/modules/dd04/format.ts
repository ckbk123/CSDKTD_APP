export function numberText(value: number): string { return value === 0 ? '0' : Number(value.toPrecision(7)).toString(); }
export function numberTex(value: number): string { return numberText(value).replace(/e([+-]?\d+)$/, (_, exponent: string) => `\\times10^{${Number(exponent)}}`); }
export function polynomialTex(coefficients: readonly number[], symbol: string, ascending = false): string {
  return coefficients.map((coefficient, index) => {
    if (coefficient === 0) return '';
    const power = ascending ? index : coefficients.length - index - 1;
    const variable = power ? power === 1 ? symbol : `${symbol}^{${power}}` : '';
    const value = Math.abs(coefficient) === 1 && power ? '' : numberTex(Math.abs(coefficient));
    return `${coefficient < 0 ? '-' : '+'}${value}${variable}`;
  }).join('').replace(/^\+/, '') || '0';
}
