import { complex, magnitude, minus, plus, quotient, times, type Complex } from './complex';
export type Matrix = number[][];
const fail = (message: string): never => { throw new Error(message); };
export function sum(values: number[]): number {
  let total = 0, correction = 0;
  for (const value of values) {
    const next = total + value;
    correction += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total; total = next;
  }
  return total + correction;
}
export const norm = (a: Matrix): number => Math.max(0, ...a.map(row => row.reduce((s, v) => s + Math.abs(v), 0)));
export const mv = (a: Matrix, x: number[]): number[] => a.map(row => sum(row.map((value, i) => value * x[i])));
const mm = (a: Matrix, b: Matrix): Matrix => a.map(row => b[0].map((_, j) => sum(row.map((value, i) => value * b[i][j]))));
const identity = (n: number): Matrix => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
function finiteMatrix(a: Matrix): void {
  if (a.flat().some(v => !Number.isFinite(v) || Math.abs(v) > 1e10)) fail('The numerical transition exceeds its finite magnitude bound. Rescale or shorten the response.');
}
/** Small real scaling-and-squaring Taylor exponential. Only the model's
 * 2/3 physical states, at most20 squarings and64 terms per step. */
export function transition(a: Matrix, time: number): Matrix {
  const n = a.length;
  if (n < 1 || n > 3 || a.some(row => row.length !== n) || a.flat().some(v => !Number.isFinite(v)) ||
      !Number.isFinite(time) || time < 0 || time > 200) fail('Use a finite square transition matrix of size1–3 and time0–200 seconds.');
  finiteMatrix(a);
  const scale = Math.max(0, Math.ceil(Math.log2(Math.max(Number.MIN_VALUE, norm(a) * time) / .25)));
  if (scale > 20) fail('The response transition needs too much scaling work. Shorten the step or rescale.');
  const z = a.map(row => row.map(v => v * time / 2 ** scale));
  let out = identity(n), term = identity(n), converged = false;
  for (let k = 1; k <= 64; k++) {
    term = mm(term, z).map(row => row.map(v => v / k));
    out = out.map((row, i) => row.map((v, j) => sum([v, term[i][j]])));
    if (norm(term) <= 2e-16 * Math.max(1, norm(out))) { converged = true; break; }
  }
  if (!converged) fail('The response exponential did not converge within64 terms.');
  for (let k = 0; k < scale; k++) { out = mm(out, out); finiteMatrix(out); }
  finiteMatrix(out); return out;
}
export interface ComplexSolution { value: Complex[]; condition: number; residual: number }
/** Bounded partial-pivot elimination, with inverse condition estimate and
 * a backward residual. Inputs are copied; no model state is retained. */
export function solveComplex(a: Complex[][], b: Complex[]): ComplexSolution {
  const n = a.length;
  if (n < 1 || n > 3 || a.some(row => row.length !== n) || b.length !== n ||
      [...a.flat(), ...b].some(v => !Number.isFinite(v.re) || !Number.isFinite(v.im) || magnitude(v) > 1e10)) fail('Use a finite complex solve of size1–3 within magnitude10¹⁰.');
  const work = a.map((row, i) => row.map(v => complex(v.re, v.im)).concat([complex(b[i].re, b[i].im)], Array.from({ length: n }, (_, j) => complex(i === j ? 1 : 0))));
  for (let k = 0; k < n; k++) {
    let pivot = k; for (let i = k + 1; i < n; i++) if (magnitude(work[i][k]) > magnitude(work[pivot][k])) pivot = i;
    if (!magnitude(work[pivot][k])) fail('The modal estimate has a singular solve; nearby/repeated poles could not be resolved.');
    [work[k], work[pivot]] = [work[pivot], work[k]];
    const divisor = work[k][k]; work[k] = work[k].map(v => quotient(v, divisor));
    for (let i = 0; i < n; i++) if (i !== k) {
      const factor = work[i][k]; work[i] = work[i].map((v, j) => minus(v, times(factor, work[k][j])));
    }
  }
  const value = work.map(row => row[n]), anorm = Math.max(...a.map(row => row.reduce((s, v) => s + magnitude(v), 0)));
  const inverseNorm = Math.max(...work.map(row => row.slice(n + 1).reduce((s, v) => s + magnitude(v), 0))), condition = anorm * inverseNorm;
  if (!Number.isFinite(condition) || condition > 1e10) fail('The modal estimate is too ill-conditioned; the full sampled response remains available.');
  const residual = Math.max(...a.map((row, i) => {
    const actual = row.reduce((s, v, j) => plus(s, times(v, value[j])), complex(0));
    const scale = Math.max(1, magnitude(b[i]), row.reduce((s, v, j) => s + magnitude(v) * magnitude(value[j]), 0));
    return magnitude(minus(actual, b[i])) / scale;
  }));
  if (!Number.isFinite(residual) || residual > 1e-10 || value.some(v => !Number.isFinite(v.re) || !Number.isFinite(v.im))) fail('The modal solve residual is too large; no tail estimate is asserted.');
  return { value, condition, residual };
}
