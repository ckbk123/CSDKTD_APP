/** Small dense real matrices, row-major, bounded to the five-state augmented step model. */
export type Matrix = number[][];
export const eye = (n: number): Matrix => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Number(i === j)));
export const normM = (a: Matrix) => Math.max(...a.map(row => row.reduce((s, v) => s + Math.abs(v), 0)));
export const multiplyM = (a: Matrix, b: Matrix): Matrix => a.map(row => b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)));
export const applyM = (a: Matrix, x: readonly number[]) => a.map(row => row.reduce((s, v, i) => s + v * x[i], 0));
export function exponential(a: Matrix, t: number): Matrix {
  if (a.length < 1 || a.length > 5 || a.some(row => row.length !== a.length || row.some(v => !Number.isFinite(v))) || !Number.isFinite(t) || t < 0) throw new Error('Use a finite square state model of size1–5 and nonnegative time.');
  const n = a.length, scale = Math.max(0, Math.ceil(Math.log2(normM(a) * t / .5))); if (scale > 40) throw new Error('State propagation exceeds the scaling limit. Rescale seconds/model.');
  const b = a.map(row => row.map(v => v * t / 2 ** scale)); let sum = eye(n), term = eye(n), converged = false;
  for (let k = 1; k <= 60; k++) {
    term = multiplyM(term, b).map(row => row.map(v => v / k)); sum = sum.map((row, i) => row.map((v, j) => v + term[i][j]));
    if (normM(term) <= 1e-16 * Math.max(1, normM(sum))) { converged = true; break; }
  }
  if (!converged) throw new Error('State exponential did not converge. Rescale the model.');
  for (let k = 0; k < scale; k++) sum = multiplyM(sum, sum);
  if (sum.some(row => row.some(v => !Number.isFinite(v)))) throw new Error('State propagation exceeded numerical range. Shorten the horizon.'); return sum;
}
export function solve(a: Matrix, b: readonly number[]): number[] {
  const n = a.length, rows = a.map((r, i) => [...r, b[i]]), scales = rows.map(row => Math.max(...row.slice(0, n).map(Math.abs)));
  for (let k = 0; k < n; k++) {
    let pivot = k; for (let i = k + 1; i < n; i++) if (Math.abs(rows[i][k]) / scales[i] > Math.abs(rows[pivot][k]) / scales[pivot]) pivot = i;
    if (!scales[pivot] || Math.abs(rows[pivot][k]) < 1e-13 * scales[pivot]) throw new Error('The state/tail calculation is singular or ill-conditioned.');
    [rows[k], rows[pivot]] = [rows[pivot], rows[k]]; [scales[k], scales[pivot]] = [scales[pivot], scales[k]];
    for (let i = k + 1; i < n; i++) { const f = rows[i][k] / rows[k][k]; for (let j = k; j <= n; j++) rows[i][j] -= f * rows[k][j]; }
  }
  const x = Array.from({ length: n }, () => 0); for (let i = n - 1; i >= 0; i--) x[i] = (rows[i][n] - rows[i].slice(i + 1, n).reduce((v, c, j) => v + c * x[i + 1 + j], 0)) / rows[i][i];
  if (x.some(v => !Number.isFinite(v)) || a.some((row, i) => Math.abs(row.reduce((v, c, j) => v + c * x[j], 0) - b[i]) > 1e-8 * Math.max(1, Math.abs(b[i]), row.reduce((v, c, j) => v + Math.abs(c * x[j]), 0)))) throw new Error('State/tail linear solve failed its residual check.'); return x;
}
/** AᵀP+PA=−I, P>0 yields a conservative all-future output-error bound.
 * Failure returns no certificate, never an assumed settled result. */
export function tailCertificate(a: Matrix, c: readonly number[]): ((error: readonly number[]) => number) | undefined {
  try {
    const n = a.length, equations = Array.from({ length: n * n }, () => Array.from({ length: n * n }, () => 0)), rhs = Array.from({ length: n * n }, () => 0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const row = i * n + j; rhs[row] = i === j ? -1 : 0; for (let k = 0; k < n; k++) { equations[row][k * n + j] += a[k][i]; equations[row][i * n + k] += a[k][j]; } }
    const flat = solve(equations, rhs), p = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (flat[i * n + j] + flat[j * n + i]) / 2));
    const l = p.map(row => row.map(() => 0));
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let v = p[i][j]; for (let k = 0; k < j; k++) v -= l[i][k] * l[j][k]; if (i === j) { if (v <= 1e-13 * normM(p)) return; l[i][j] = Math.sqrt(v); } else l[i][j] = v / l[j][j]; }
    const dual = solve(p, c), outputEnergy = c.reduce((v, x, i) => v + x * dual[i], 0); if (!(outputEnergy >= 0)) return;
    return error => { const pe = applyM(p, error), energy = error.reduce((v, x, i) => v + x * pe[i], 0); return Math.sqrt(Math.max(0, energy) * outputEnergy); };
  } catch { return; }
}
