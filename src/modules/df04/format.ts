const rounded = (value: number): string => value === 0 ? '0' : Number(value.toPrecision(8)).toString();
export const numberText = (value: number): string => rounded(value).replace(/e([+-]?\d+)$/, (_, exponent: string) => '×10' + String(Number(exponent)).split('').map(character => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(character)] ?? (character === '-' ? '⁻' : '⁺')).join(''));
export const numberTex = (value: number): string => rounded(value).replace(/e([+-]?\d+)$/, (_, exponent: string) => `\\times10^{${Number(exponent)}}`);
