import type { Polynomial } from './parser';
import { toNumber } from './rational';
export interface Complex { readonly re: number; readonly im: number }
export const c = (re: number, im = 0): Complex => ({ re, im });
export const addC = (a: Complex, b: Complex): Complex => c(a.re + b.re, a.im + b.im);
export const subC = (a: Complex, b: Complex): Complex => c(a.re - b.re, a.im - b.im);
export const mulC = (a: Complex, b: Complex): Complex => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const scaleC = (a: Complex, value: number): Complex => c(a.re * value, a.im * value);
export const absC = (a: Complex): number => Math.hypot(a.re, a.im);
export const distance = (a: Complex, b: Complex): number => absC(subC(a, b));
export function divC(a: Complex, b: Complex): Complex {
  if (!absC(b)) throw new Error('The complex denominator is zero at this point.');
  if (Math.abs(b.re) >= Math.abs(b.im)) { const r = b.im / b.re, d = b.re + b.im * r; return c((a.re + a.im * r) / d, (a.im - a.re * r) / d); }
  const r = b.re / b.im, d = b.im + b.re * r; return c((a.re * r + a.im) / d, (a.im * r - a.re) / d);
}
export const angle = (a: Complex): number => Math.atan2(a.im, a.re);
export function wrap(value: number): number { let result = (value + Math.PI) % (2 * Math.PI); if (result < 0) result += 2 * Math.PI; return result - Math.PI; }
export function evaluate(p: Polynomial, point: Complex): Complex { let result = c(0); for (let i = p.length - 1; i >= 0; i--) result = addC(mulC(result, point), c(toNumber(p[i]))); return result; }
export function residual(p: Polynomial, point: Complex): number {
  let bound = 0; const radius = absC(point);
  for (let i = p.length - 1; i >= 0; i--) bound = bound * radius + Math.abs(toNumber(p[i]));
  return bound ? absC(evaluate(p, point)) / bound : 0;
}
