import type { Model } from './parser';
export type Matrix = number[][];
export interface Source { A: Matrix; B: number[]; C: number[]; D: number }
export interface Discrete { A: Matrix; B: number[] }
export type Method = 'forward' | 'backward' | 'trapezoid';
export interface Experiment {
  T: number; count: number; density: number; delay: number;
  amplitude: number; initial: number[]; input: 'step' | 'pulse' | 'ramp'; method: Method;
}
export interface Sample { k: number; t: number; held: number; y: number; x: number[] }
export interface Point { t: number; y: number; held: number }
export interface Result {
  exact: Discrete; approx?: Discrete; samples: Sample[]; comparison?: Sample[];
  segments: Point[][]; warning: string; maxError?: number;
}
const fail = (message: string): never => { throw new Error(message); };
const identity = (n: number): Matrix => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
export const norm = (a: Matrix): number => Math.max(...a.map(row => row.reduce((s, x) => s + Math.abs(x), 0)));
const scale = (a: Matrix, factor: number): Matrix => a.map(row => row.map(x => x * factor));
const add = (a: Matrix, b: Matrix): Matrix => a.map((row, i) => row.map((x, j) => x + b[i][j]));
const multiply = (a: Matrix, b: Matrix): Matrix => a.map(row => b[0].map((_, j) => row.reduce((s, x, k) => s + x * b[k][j], 0)));
const mv = (a: Matrix, x: number[]): number[] => a.map(row => row.reduce((s, v, i) => s + v * x[i], 0));
const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * b[i], 0);

/** Scaling/squaring, with a bounded Taylor series on a norm <= 1/2 matrix.
 * Sizes 1..3, input infinity norm <=64; numerical approximation to exp(M). */
export function matrixExp(a: Matrix): Matrix {
  const n = a.length;
  if (n < 1 || n > 3 || a.some(row => row.length !== n || row.some(x => !Number.isFinite(x)))) fail('Use a finite square matrix of size 1–3.');
  const size = norm(a);
  if (size > 64) fail('The interval matrix norm exceeds 64. Reduce T or rescale the plant/state coordinates.');
  const squarings = Math.max(0, Math.ceil(Math.log2(size / 0.5)));
  const small = scale(a, 2 ** -squarings);
  let result = identity(n), term = identity(n), converged = false;
  for (let k = 1; k <= 64; k++) {
    term = scale(multiply(term, small), 1 / k);
    result = add(result, term);
    if (norm(term) <= 2e-16 * Math.max(1, norm(result))) { converged = true; break; }
  }
  if (!converged) fail('The matrix exponential did not converge within 64 terms. Reduce the interval.');
  for (let k = 0; k < squarings; k++) result = multiply(result, result);
  if (result.some(row => row.some(x => !Number.isFinite(x)))) fail('The matrix exponential exceeded numeric range.');
  return result;
}

function inverse(a: Matrix): Matrix {
  const n = a.length, work = a.map((row, i) => [...row, ...identity(n)[i]]);
  const tolerance = 1e-12 * Math.max(1, norm(a));
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(work[row][col]) > Math.abs(work[pivot][col])) pivot = row;
    if (Math.abs(work[pivot][col]) <= tolerance) fail('The selected implicit approximation has a singular or poorly conditioned interval matrix (pivot tolerance 10⁻¹²). Try another method or T.');
    [work[col], work[pivot]] = [work[pivot], work[col]];
    const p = work[col][col]; work[col] = work[col].map(v => v / p);
    for (let row = 0; row < n; row++) if (row !== col) {
      const factor = work[row][col]; work[row] = work[row].map((v, j) => v - factor * work[col][j]);
    }
  }
  return work.map(row => row.slice(n));
}

export function realize(model: Model): Source {
  const { a, b } = model;
  return a.length === 2
    ? { A: [[-a[1]]], B: [1], C: [b[1] - a[1] * b[0]], D: b[0] }
    : { A: [[0, 1], [-a[2], -a[1]]], B: [0, 1], C: [b[2] - a[2] * b[0], b[1] - a[1] * b[0]], D: b[0] };
}

/** Augmentation computes the input integral even when A is singular. */
export function exactInterval(source: Source, h: number): Discrete {
  if (!Number.isFinite(h) || h < 0 || h > 10) fail('The propagation interval must be finite and from 0 to 10 seconds.');
  const n = source.A.length;
  const augmented = source.A.map((row, i) => [...row, source.B[i]]).concat([Array(n + 1).fill(0) as number[]]);
  const e = matrixExp(scale(augmented, h));
  return { A: e.slice(0, n).map(row => row.slice(0, n)), B: e.slice(0, n).map(row => row[n]) };
}

/** Approximations propagate one interval with u[k] CONSTANT, including the
 * interval's left limit at its right endpoint. They are not controller TF
 * substitutions and do not replace the hold by u[k+1]. */
export function approximate(source: Source, T: number, method: Method): Discrete {
  const n = source.A.length, I = identity(n);
  if (method === 'forward') return { A: add(I, scale(source.A, T)), B: source.B.map(b => T * b) };
  if (method !== 'backward' && method !== 'trapezoid') fail('Select a named interval approximation.');
  const weight = method === 'backward' ? 1 : 0.5;
  const inv = inverse(add(I, scale(source.A, -weight * T)));
  return { A: multiply(inv, method === 'backward' ? I : add(I, scale(source.A, T / 2))), B: mv(inv, source.B).map(b => T * b) };
}

function validate(e: Experiment, n: number): void {
  if (!Number.isFinite(e.T) || e.T < 1e-4 || e.T > 10) fail('T must be from 0.0001 to 10 seconds.');
  if (!Number.isInteger(e.count) || e.count < 4 || e.count > 120) fail('Use an integer from 4 to 120 sample instants.');
  if (!Number.isInteger(e.density) || e.density < 2 || e.density > 16) fail('Use 2–16 drawing subdivisions per sample interval. This does not change T.');
  if (!Number.isInteger(e.delay) || e.delay < 0 || e.delay > 12) fail('Use an integer delay m from 0 to 12 samples. Fractional delays are unsupported and are never rounded.');
  if (e.initial.length !== n || ![e.amplitude, ...e.initial].every(v => Number.isFinite(v) && Math.abs(v) <= 1e4)) fail('Provide one finite initial value per state; amplitude and initial values must have magnitude at most 10⁴.');
  if (!['step', 'pulse', 'ramp'].includes(e.input)) fail('Choose a held step, one-period pulse or sampled physical ramp.');
}
function held(e: Experiment, k: number): number {
  const index = k - e.delay;
  return index < 0 ? 0 : e.input === 'step' ? e.amplitude : e.input === 'pulse' ? (index === 0 ? e.amplitude : 0) : e.amplitude * index * e.T;
}
function checkValue(y: number, x: number[], where: string): void {
  if (!Number.isFinite(y) || Math.abs(y) > 1e10 || x.some(v => !Number.isFinite(v) || Math.abs(v) > 1e12)) fail(`The ${where} exceeds the output 10¹⁰ or state 10¹² bound. Shorten the horizon or reduce amplitude/initial values.`);
}
function advance(d: Discrete, x: number[], u: number): number[] { return mv(d.A, x).map((v, i) => v + d.B[i] * u); }
function samples(source: Source, d: Discrete, e: Experiment): Sample[] {
  let x = [...e.initial]; const rows: Sample[] = [];
  for (let k = 0; k < e.count; k++) {
    const u = held(e, k), y = dot(source.C, x) + source.D * u;
    checkValue(y, x, `sample ${k}`); rows.push({ k, t: k * e.T, held: u, y, x: [...x] });
    x = advance(d, x, u);
  }
  return rows;
}
export function run(source: Source, e: Experiment): Result {
  validate(e, source.A.length);
  const exact = exactInterval(source, e.T), rows = samples(source, exact, e);
  let approx: Discrete | undefined, comparison: Sample[] | undefined, warning = '';
  try { approx = approximate(source, e.T, e.method); comparison = samples(source, approx, e); }
  catch (error) { warning = error instanceof Error ? `Approximation unavailable: ${error.message}` : 'Approximation unavailable.'; }
  if (e.delay >= e.count - 1) warning += ' No full held interval after delayed input arrival is shown. Increase the sample count to inspect post-delay propagation.';
  const a = source.A;
  let rate = Math.abs(a[0][0]);
  if (a.length === 2) {
    const tr = a[0][0] + a[1][1], det = a[0][0] * a[1][1] - a[0][1] * a[1][0], d = tr * tr - 4 * det;
    rate = d < 0 ? Math.sqrt(Math.max(0, det)) : Math.max(Math.abs((tr + Math.sqrt(d)) / 2), Math.abs((tr - Math.sqrt(d)) / 2));
  }
  // A conservative drawing diagnostic, not an accuracy certificate. Values
  // still use the exponential independently of the rendering grid.
  if (rate * e.T / e.density > 0.5) warning += ' Drawing intervals exceed half an inverse pole-magnitude scale. The joined line may underresolve fast motion; increase drawing density. Exact sample values do not use the drawing grid.';
  const steps = Array.from({ length: e.density + 1 }, (_, j) => exactInterval(source, e.T * j / e.density));
  const segments = rows.slice(0, -1).map(row => steps.map((step, j) => {
    const x = advance(step, row.x, row.held), y = dot(source.C, x) + source.D * row.held;
    checkValue(y, x, 'continuous trajectory'); return { t: row.t + e.T * j / e.density, y, held: row.held };
  }));
  return { exact, approx, samples: rows, comparison, warning, segments,
    maxError: comparison ? Math.max(...rows.map((r, k) => Math.abs(r.y - comparison![k].y))) : undefined };
}

export function transfer(source: Source, d: Discrete): Model {
  if (d.A.length === 1) return { a: [1, -d.A[0][0]], b: [source.D, dot(source.C, d.B) - source.D * d.A[0][0]] };
  const [[a, b], [c, f]] = d.A, [v, w] = d.B;
  const tr = a + f, det = a * f - b * c;
  return { a: [1, -tr, det], b: [source.D, dot(source.C, d.B) - source.D * tr,
    source.C[0] * (-f * v + b * w) + source.C[1] * (c * v - a * w) + source.D * det] };
}
export const fmt = (x: number): string => x === 0 ? '0' : Number(x.toPrecision(7)).toString();
export const tex = (x: number): string => fmt(x).replace(/e([+-]?\d+)/, '\\times10^{$1}');
export const matrixTex = (a: Matrix): string => `\\begin{bmatrix}${a.map(row => row.map(tex).join('&')).join('\\\\')}\\end{bmatrix}`;
export function polyTex(values: number[], variable: string): string {
  return values.map((v, i) => `(${tex(v)})${i === values.length - 1 ? '' : `${variable}^{${values.length - i - 1}}`}`).join('+');
}
export function recurrence(model: Model, delay: number): string {
  return `y[k]=${model.a.slice(1).map((v, i) => `(${tex(-v)})y[k-${i + 1}]`).concat(model.b.map((v, i) => `(${tex(v)})u[k-${i + delay}]`)).join('+')}`;
}
