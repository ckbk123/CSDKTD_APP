export interface Complex { re: number; im: number }
export const complex = (re: number, im = 0): Complex => ({ re, im });
export const plus = (a: Complex, b: Complex): Complex => complex(a.re + b.re, a.im + b.im);
export const minus = (a: Complex, b: Complex): Complex => complex(a.re - b.re, a.im - b.im);
export const times = (a: Complex, b: Complex): Complex => complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const scale = (a: Complex, factor: number): Complex => complex(a.re * factor, a.im * factor);
export const magnitude = (a: Complex): number => Math.hypot(a.re, a.im);
export function quotient(a: Complex, b: Complex): Complex {
  const denominator = b.re * b.re + b.im * b.im;
  if (!Number.isFinite(denominator) || denominator === 0) throw new Error('The numerical complex solve has a zero or unrepresentable pivot.');
  return complex((a.re * b.re + a.im * b.im) / denominator, (a.im * b.re - a.re * b.im) / denominator);
}
export const exponential = (a: Complex): Complex => scale(complex(Math.cos(a.im), Math.sin(a.im)), Math.exp(a.re));
