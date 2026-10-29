export type Matrix = readonly [number, number, number, number]; // row-major 2 by 2
export type Vector = readonly [number, number];
export interface Model { readonly A: Matrix; readonly B: Vector; readonly C: Vector }
export const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1];
export const mv = (a: Matrix, x: Vector): Vector => [a[0] * x[0] + a[1] * x[1], a[2] * x[0] + a[3] * x[1]];
export const determinant = (a: Matrix) => a[0] * a[3] - a[1] * a[2];
export const characteristic = (a: Matrix): Vector => [-a[0] - a[3], determinant(a)];
export const RANK_TOLERANCE = 1e-9;
function finite(values: readonly number[], bound: number, label: string) {
  if (!values.every(v => Number.isFinite(v) && Math.abs(v) <= bound)) throw new Error(`${label} must be finite with magnitudes at most ${bound}.`);
}
function solve(a: Matrix, b: Vector): Vector {
  const s0 = Math.hypot(a[0], a[1]), s1 = Math.hypot(a[2], a[3]);
  if (!s0 || !s1) throw new Error('The matching equations are singular.');
  const n: Matrix = [a[0] / s0, a[1] / s0, a[2] / s1, a[3] / s1], rhs: Vector = [b[0] / s0, b[1] / s1], d = determinant(n);
  if (Math.abs(d) <= RANK_TOLERANCE) throw new Error('The matching equations are too ill-conditioned; rescale the state coordinates or change the model.');
  return [(rhs[0] * n[3] - n[1] * rhs[1]) / d, (n[0] * rhs[1] - rhs[0] * n[2]) / d];
}
export function eigenvalues(a: Matrix): Vector[] {
  const [d1, d0] = characteristic(a), disc = d1 * d1 - 4 * d0;
  if (disc < 0) return [[-d1 / 2, Math.sqrt(-disc) / 2], [-d1 / 2, -Math.sqrt(-disc) / 2]];
  const q = -(d1 + (d1 < 0 ? -1 : 1) * Math.sqrt(disc)) / 2;
  return q ? [[q, 0], [d0 / q, 0]] : [[0, 0], [0, 0]];
}
export function design(model: Model, desired: Vector) {
  const { A, B, C } = model;
  finite([...A, ...B, ...C], 1000, 'Matrix entries'); finite(desired, 10000, 'Desired coefficients');
  if (desired[0] <= 0 || desired[1] <= 0) throw new Error('Choose strictly stable targets: both d₁ and d₀ must be positive.');
  const AB = mv(A, B), n0 = Math.hypot(...B), n1 = Math.hypot(...AB);
  const controllability: Matrix = [B[0], AB[0], B[1], AB[1]];
  const scaledDet = n0 && n1 ? determinant([B[0] / n0, AB[0] / n1, B[1] / n0, AB[1] / n1]) : 0;
  if (Math.abs(scaledDet) <= RANK_TOLERANCE) throw new Error('Controllability rank is below 2 at the declared scaled tolerance 10⁻⁹. Arbitrary two-pole placement is unavailable.');
  const adjB: Vector = [A[3] * B[0] - A[1] * B[1], -A[2] * B[0] + A[0] * B[1]];
  const matching: Matrix = [B[0], B[1], adjB[0], adjB[1]], rhs: Vector = [A[0] + A[3] + desired[0], determinant(A) - desired[1]];
  const K = solve(matching, rhs); finite(K, 1e6, 'Feedback gain');
  const closed: Matrix = [A[0] - B[0] * K[0], A[1] - B[0] * K[1], A[2] - B[1] * K[0], A[3] - B[1] * K[1]];
  finite(closed, 10000, 'Closed-loop matrix entries');
  const actual = characteristic(closed);
  const residual = Math.max(...actual.map((v, j) => Math.abs(v - desired[j]) / Math.max(1e-12, Math.abs(desired[j]))));
  if (actual[0] <= 0 || actual[1] <= 0 || residual > 1e-9) throw new Error('Coefficient verification lost accuracy; rescale the state coordinates.');
  const inverseB = solve(closed, B), dcGain = -dot(C, inverseB), dcScale = Math.hypot(...C) * Math.hypot(...inverseB);
  const tracking = Math.abs(dcGain) > 1e-10 * dcScale && dcScale > 0 && Math.abs(1 / dcGain) <= 1e6;
  return { model, desired, AB, controllability, scaledDet, rank: 2, matching, rhs, K, closed, actual, residual, poles: eigenvalues(closed), dcGain,
    prefilter: tracking ? 1 / dcGain : null,
    trackingNote: tracking ? 'Static prefilter exists.' : 'No reliable static unity-tracking prefilter: DC channel is zero/too small or the required gain exceeds 10⁶.' };
}

/** Bounded scaling/Taylor/squaring for a 3×3 augmented state transition.
 * The last column integrates a held input without subtracting near-equal
 * steady-state terms or dividing by a slow pole. */
function multiply3(a: readonly number[], b: readonly number[]): number[] {
  const out = Array<number>(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) out[3 * i + j] += a[3 * i + k] * b[3 * k + j];
  return out;
}
function exp3(matrix: readonly number[]): number[] {
  const norm = Math.max(...[0, 1, 2].map(i => matrix.slice(3 * i, 3 * i + 3).reduce((sum, n) => sum + Math.abs(n), 0)));
  const scaling = Math.max(0, Math.ceil(Math.log2(norm / .5)));
  if (scaling > 30) throw new Error('State transition exceeds its scaling limit. Reduce time or rescale the model.');
  const x = matrix.map(n => n / 2 ** scaling), identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  let term = identity.slice(), total = identity.slice(), converged = false;
  for (let k = 1; k <= 24; k++) {
    term = multiply3(term, x).map(n => n / k); total = total.map((n, j) => n + term[j]);
    if (Math.max(...term.map(Math.abs)) <= 1e-16 * Math.max(1, ...total.map(Math.abs))) { converged = true; break; }
  }
  if (!converged) throw new Error('The state-transition series did not converge within 24 terms.');
  for (let k = 0; k < scaling; k++) total = multiply3(total, total);
  if (!total.every(Number.isFinite)) throw new Error('State transition overflowed; reduce the requested horizon.');
  return total;
}
export interface Sample { readonly t: number; readonly state: Vector; readonly output: number; readonly effort: number }
export function response(result: ReturnType<typeof design>, gain: number, initial: Vector, reference: number, horizon: number, count = 401): Sample[] {
  finite([gain], 1e6, 'Reference gain'); finite([...initial, reference], 100, 'Initial state and reference');
  if (!Number.isFinite(horizon) || horizon < .1 || horizon > 50 || !Number.isInteger(count) || count < 2 || count > 1001) throw new Error('Use 0.1–50 seconds and 2–1,001 samples.');
  const { closed: a, model: { B, C }, K } = result, samples: Sample[] = [];
  for (let i = 0; i < count; i++) {
    const t = horizon * i / (count - 1), e = exp3([a[0] * t, a[1] * t, B[0] * t, a[2] * t, a[3] * t, B[1] * t, 0, 0, 0]);
    const state: Vector = [e[0] * initial[0] + e[1] * initial[1] + e[2] * gain * reference, e[3] * initial[0] + e[4] * initial[1] + e[5] * gain * reference];
    const output = dot(C, state), effort = -dot(K, state) + gain * reference;
    finite([...state, output, effort], 1e8, 'Response values'); samples.push({ t, state, output, effort });
  }
  return samples;
}
