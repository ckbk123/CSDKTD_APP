export const fmt = (v: number): string => v === 0 ? '0' : Number(v.toPrecision(7)).toString();
export const tex = (v: number): string => fmt(v).replace(/e([+-]?\d+)/, '\\times10^{$1}');
export const polynomial = (a: number[]): string => a.map((v, i) => v === 0 ? '' : '(' + tex(v) + ')' + (i < a.length - 1 ? 's^{' + (a.length - i - 1) + '}' : '')).filter(Boolean).join('+') || '0';
