import { complex, magnitude, minus, plus, times, type Complex } from './complex';
import { add, compare, div, fromNumber, mul, neg, rational, sub, toNumber, ZERO, type Q } from './rational';
export interface Pole extends Complex { multiplicity: number }
export interface PoleResult { values: Pole[]; residual: number; coefficientResidual: number }
const fail = (message: string): never => { throw new Error(message); };
const q = fromNumber;
const num = (a: Q): number => toNumber(a, Number.MIN_VALUE, 1e300);
const pole = (re: number, im = 0, multiplicity = 1): Pole => ({ re: re === 0 ? 0 : re, im: im === 0 ? 0 : im, multiplicity });
function quadratic(b: number, c: number): Pole[] {
  const disc = sub(mul(q(b), q(b)), mul(rational(4n), q(c))), sign = compare(disc, ZERO);
  if (!sign) return [pole(-b / 2, 0, 2)];
  if (sign < 0) { const im = Math.sqrt(num(neg(disc))) / 2; return [pole(-b / 2, im), pole(-b / 2, -im)]; }
  const root = Math.sqrt(num(disc)), stable = -.5 * (b + (b < 0 ? -root : root));
  if (stable === 0) return [pole(0), pole(-b)];
  return [pole(stable), pole(num(div(q(c), q(stable))))];
}
function refine(coefficients: number[], initial: number): number {
  let value = initial;
  for (let i = 0; i < 4; i++) {
    const at = q(value), residual = coefficients.reduce((s, c) => add(mul(s, at), q(c)), ZERO);
    if (!residual.n) break;
    const derivative = coefficients.slice(0, -1).reduce((s, c, j) => add(mul(s, at), mul(q(c), rational(BigInt(coefficients.length - j - 1)))), ZERO);
    if (!derivative.n) break;
    const candidate = num(sub(at, div(residual, derivative)));
    if (!Number.isFinite(candidate) || candidate === value) break; value = candidate;
  }
  return value;
}
function deflate(b: number, c: number, d: number, root: number): Pole[] {
  if (root === 0) { if (d !== 0) return fail('A small real pole could not be resolved. Rescale the coefficients.'); return quadratic(b, c); }
  const constant = num(div(neg(q(d)), q(root))), trace = num(add(q(b), q(root)));
  const linear = Math.abs(trace) < 1e-4 * Math.max(Math.abs(b), Math.abs(root))
    ? num(div(sub(q(constant), q(c)), q(root))) : trace;
  return quadratic(linear, constant);
}
export function poleResidual(coefficients: number[], value: Complex): number {
  let residual = complex(0), scale = 0; const radius = magnitude(value);
  for (const a of coefficients) { residual = plus(times(residual, value), complex(a)); scale = scale * radius + Math.abs(a); }
  return magnitude(residual) / Math.max(Number.MIN_VALUE, scale);
}
function recoveredCoefficients(poles: Pole[]): Complex[] {
  let polynomial = [complex(1)];
  for (const root of poles) for (let copy = 0; copy < root.multiplicity; copy++) {
    const next = Array.from({ length: polynomial.length + 1 }, () => complex(0));
    polynomial.forEach((a, i) => { next[i] = plus(next[i], a); next[i + 1] = minus(next[i + 1], times(a, root)); }); polynomial = next;
  }
  return polynomial;
}
/** Complete degree-2/3 root set, including exact binary-coefficient
 * discriminant signs/multiplicities. Explicit residual gates reject an
 * unresolved numerical set instead of presenting plausible poles. */
export function roots(coefficients: number[]): PoleResult {
  if (![3, 4].includes(coefficients.length) || coefficients[0] !== 1 ||
      coefficients.some(a => !Number.isFinite(a) || Math.abs(a) > 1e10 || (a !== 0 && Math.abs(a) < 1e-300))) fail('Use a bounded monic quadratic/cubic characteristic polynomial.');
  let values: Pole[];
  if (coefficients.length === 3) values = quadratic(coefficients[1], coefficients[2]);
  else {
    const [, b, c, d] = coefficients, B = q(b), C = q(c), D = q(d);
    const p = sub(C, div(mul(B, B), rational(3n)));
    const r = add(sub(div(mul(rational(2n), mul(mul(B, B), B)), rational(27n)), div(mul(B, C), rational(3n))), D);
    const disc = add(div(mul(r, r), rational(4n)), div(mul(mul(p, p), p), rational(27n))), sign = compare(disc, ZERO);
    if (!sign) {
      if (!p.n) values = [pole(num(neg(div(B, rational(3n)))), 0, 3)];
      else values = [pole(num(sub(div(mul(rational(3n), r), p), div(B, rational(3n))))),
        pole(num(sub(neg(div(mul(rational(3n), r), mul(rational(2n), p))), div(B, rational(3n)))), 0, 2)];
    } else {
      const P = num(p), R = num(r);
      let candidate: number;
      if (sign > 0) {
        const u = Math.cbrt(-R / 2 - (R < 0 ? -1 : 1) * Math.sqrt(num(disc))), v = u ? -P / (3 * u) : 0;
        candidate = u + v - b / 3;
        const real = -(u + v) / 2 - b / 3, imaginary = Math.sqrt(3) / 2 * (u - v), size = Math.hypot(real, imaginary);
        if (d !== 0 && Math.abs(candidate) < 1e-4 * size) candidate = -d / (real * real + imaginary * imaginary);
      } else {
        const radius = 2 * Math.sqrt(-P / 3), argument = -R / (2 * Math.sqrt(-((P / 3) ** 3)));
        if (!Number.isFinite(argument) || Math.abs(argument) > 1 + 1e-12) fail('The three-real-pole construction could not be resolved. Rescale the coefficients.');
        const angle = Math.acos(Math.max(-1, Math.min(1, argument)));
        const candidates = [0, 1, 2].map(j => radius * Math.cos((angle + 2 * Math.PI * j) / 3) - b / 3);
        candidate = candidates.reduce((best, value) => Math.abs(value) > Math.abs(best) ? value : best);
      }
      const realRoot = refine(coefficients, candidate), remaining = deflate(b, c, d, realRoot);
      if ((sign > 0 && remaining.some(pole => pole.im === 0)) || (sign < 0 && remaining.some(pole => pole.im !== 0))) fail('Nearly coincident poles could not be separated reliably. Change scale or parameters.');
      values = [pole(realRoot), ...remaining];
    }
  }
  values.sort((a, b) => a.re - b.re || a.im - b.im);
  if (values.some(p => !Number.isFinite(p.re) || !Number.isFinite(p.im)) || values.reduce((sum, p) => sum + p.multiplicity, 0) !== coefficients.length - 1) fail('The complete pole set could not be resolved.');
  const residual = Math.max(...values.map(value => poleResidual(coefficients, value))), reconstructed = recoveredCoefficients(values), scale = Math.max(1, ...coefficients.map(Math.abs));
  const coefficientResidual = Math.max(...coefficients.map((a, i) => magnitude(minus(reconstructed[i], complex(a))) / (a === 0 ? scale : Math.abs(a))));
  if (residual > 1e-10 || coefficientResidual > 1e-8) fail('The numerical full-pole residual is too large. Rescale or change the model; no partial root set is shown.');
  return { values, residual, coefficientResidual };
}
