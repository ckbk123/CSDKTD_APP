import { add, compare, decimal, div, mul, neg, ONE, rational, sub, toNumber, ZERO, type Rational } from './rational';
import type { ExactLinear } from './parser';

export type Polynomial = readonly Rational[]; // ascending powers
export type Channel = 'reference' | 'disturbance' | 'noise';
export type ErrorSignal = 'comparator' | 'physical';
export interface Stability { readonly kind: 'stable' | 'boundary' | 'unstable'; readonly degree: number; readonly determinant?: Rational }
export interface Model {
  readonly numerator: ExactLinear; readonly denominator: Polynomial; readonly closed: Polynomial;
  readonly a: Rational; readonly h: Rational; readonly integrators: number;
  readonly gain: Rational; readonly zero?: Rational; readonly stability: Stability;
}
export function trim(poly: Polynomial): Rational[] { const copy = [...poly]; while (copy.length > 1 && !copy.at(-1)!.n) copy.pop(); return copy.length ? copy : [ZERO]; }
export function plus(a: Polynomial, b: Polynomial): Rational[] { return trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => add(a[i] ?? ZERO, b[i] ?? ZERO))); }
export function scale(poly: Polynomial, value: Rational): Rational[] { return trim(poly.map(item => mul(item, value))); }
function bound(value: Rational, minimum: string, maximum: string, label: string): void {
  if (compare(value, decimal(minimum)) < 0 || compare(value, decimal(maximum)) > 0) throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  toNumber(value);
}
function stability(closed: Polynomial): Stability {
  const degree = closed.length - 1;
  const positive = closed.every(value => value.n > 0n);
  if (degree < 3) return { kind: positive ? 'stable' : 'unstable', degree };
  const determinant = sub(mul(closed[2], closed[1]), mul(closed[3], closed[0]));
  return { kind: positive && determinant.n > 0n ? 'stable' : positive && !determinant.n ? 'boundary' : 'unstable', degree, determinant };
}
export function makeModel(numerator: ExactLinear, poleFactor: ExactLinear, integrators: number, h: Rational): Model {
  if (!Number.isInteger(integrators) || integrators < 0 || integrators > 2) throw new Error('Choose zero, one or two origin integrators.');
  if (poleFactor[1].n <= 0n || poleFactor[0].n <= 0n) throw new Error('The finite pole factor must have positive s and constant coefficients.');
  const a = div(poleFactor[0], poleFactor[1]);
  const normalized: ExactLinear = [div(numerator[0], poleFactor[1]), div(numerator[1], poleFactor[1])];
  if (normalized[0].n <= 0n || normalized[1].n < 0n) throw new Error('Use a positive constant numerator, or a positive gain times one left-half-plane zero.');
  const gain = normalized[1].n ? normalized[1] : normalized[0];
  const zero = normalized[1].n ? div(normalized[0], normalized[1]) : undefined;
  bound(a, '0.1', '10', 'Finite pole rate a'); bound(gain, '0.05', '50', 'Normalized gain'); bound(h, '0.1', '10', 'Sensor gain H');
  if (zero) bound(zero, '0.05', '10', 'Zero rate');
  const denominator: Rational[] = Array.from({ length: integrators + 2 }, () => ZERO);
  denominator[integrators] = a; denominator[integrators + 1] = ONE;
  const closed = plus(denominator, scale(normalized, h));
  return { numerator: normalized, denominator, closed, a, h, integrators, gain, zero, stability: stability(closed) };
}

export function errorNumerator(model: Model, channel: Channel, error: ErrorSignal): Polynomial {
  if (channel === 'reference') return error === 'comparator' ? model.denominator : plus(model.denominator, scale(model.numerator, sub(model.h, ONE)));
  if (channel === 'disturbance') return scale(model.numerator, error === 'comparator' ? neg(model.h) : neg(ONE));
  return error === 'comparator' ? scale(model.denominator, neg(ONE)) : model.numerator;
}
export interface ErrorConstant { readonly kind: 'zero' | 'finite' | 'infinite'; readonly value?: Rational }
export function constants(model: Model): readonly ErrorConstant[] {
  const lowGain = div(mul(model.h, model.numerator[0]), model.a);
  return [0, 1, 2].map(order => order < model.integrators ? { kind: 'infinite' } : order === model.integrators ? { kind: 'finite', value: lowGain } : { kind: 'zero', value: ZERO });
}
export type Limit =
  | { readonly kind: 'finite'; readonly value: Rational; readonly polynomial: Polynomial; readonly zeroOrder: number | null; readonly reason: 'stable' | 'zero-input' | 'zero-channel' }
  | { readonly kind: 'growth'; readonly polynomial: Polynomial; readonly degree: number; readonly zeroOrder: number }
  | { readonly kind: 'uncertified'; readonly reason: string };
export function analyseLimit(model: Model, channel: Channel, error: ErrorSignal, inputOrder: number, amplitude: Rational): Limit {
  if (!Number.isInteger(inputOrder) || inputOrder < 0 || inputOrder > 2) throw new Error('Choose step, ramp or parabolic input.');
  bound(amplitude, '-10', '10', 'Input amplitude');
  const numerator = trim(errorNumerator(model, channel, error));
  if (!amplitude.n) return { kind: 'finite', value: ZERO, polynomial: [ZERO], zeroOrder: null, reason: 'zero-input' };
  if (numerator.every(value => !value.n)) return { kind: 'finite', value: ZERO, polynomial: [ZERO], zeroOrder: null, reason: 'zero-channel' };
  if (model.stability.kind !== 'stable') return { kind: 'uncertified', reason: 'The full closed loop is not strictly Hurwitz. The final-value theorem is not applied.' };
  const zeroOrder = numerator.findIndex(value => value.n !== 0n);
  const series: Rational[] = [];
  for (let k = 0; k <= inputOrder; k++) {
    let value = numerator[k] ?? ZERO;
    for (let i = 1; i <= k; i++) value = sub(value, mul(model.closed[i] ?? ZERO, series[k - i]));
    series.push(div(value, model.closed[0]));
  }
  const factorial = [ONE, ONE, rational(2n)];
  const polynomial = trim(Array.from({ length: inputOrder + 1 }, (_, power) => div(mul(amplitude, series[inputOrder - power]), factorial[power])));
  const degree = polynomial.length - 1;
  return degree ? { kind: 'growth', polynomial, degree, zeroOrder } : { kind: 'finite', value: polynomial[0], polynomial, zeroOrder, reason: 'stable' };
}

export interface Point { readonly t: number; readonly input: number; readonly output: number; readonly comparator: number; readonly physical: number }
export interface Trace { readonly points: readonly Point[]; readonly truncated: boolean; readonly resolutionLimited: boolean; readonly interval: number }

type Matrix = number[][];
const identity = (size: number): Matrix => Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => row === column ? 1 : 0));
const norm = (matrix: Matrix): number => Math.max(...matrix.map(row => row.reduce((sum, value) => sum + Math.abs(value), 0)));
function matrixMultiply(a: Matrix, b: Matrix): Matrix { return a.map(row => b[0].map((_, column) => row.reduce((sum, value, k) => sum + value * b[k][column], 0))); }
/** Size <=6. Scaling and a bounded Taylor series approximate exp(A*dt). */
export function transition(matrix: Matrix, dt: number): Matrix {
  const size = matrix.length;
  if (!size || size > 6 || matrix.some(row => row.length !== size || row.some(value => !Number.isFinite(value))) || !Number.isFinite(dt) || dt < 0 || dt > 120) throw new Error('The state transition needs a finite square matrix of size at most six and bounded nonnegative time.');
  const magnitude = norm(matrix) * dt;
  const squarings = Math.max(0, Math.ceil(Math.log2(magnitude / .5)));
  if (!Number.isFinite(magnitude) || squarings > 24) throw new Error('The state transition exceeds its scaling budget. Reduce the horizon or rescale the model.');
  const scaled = matrix.map(row => row.map(value => value * dt / 2 ** squarings));
  let sum = identity(size), term = identity(size), converged = false;
  for (let k = 1; k <= 32; k++) {
    term = matrixMultiply(term, scaled).map(row => row.map(value => value / k));
    sum = sum.map((row, i) => row.map((value, j) => value + term[i][j]));
    if (norm(term) <= 1e-16 * Math.max(1, norm(sum))) { converged = true; break; }
  }
  if (!converged) throw new Error('The bounded state-transition series did not converge.');
  for (let i = 0; i < squarings; i++) sum = matrixMultiply(sum, sum);
  if (sum.some(row => row.some(value => !Number.isFinite(value)))) throw new Error('The transition overflowed. Reduce the horizon.');
  return sum;
}
export function trace(model: Model, channel: Channel, inputOrder: number, amplitude: Rational, horizon: number): Trace {
  if (!Number.isFinite(horizon) || horizon < .1 || horizon > 120) throw new Error('Plot horizon must be between 0.1 and 120 seconds.');
  if (!Number.isInteger(inputOrder) || inputOrder < 0 || inputOrder > 2) throw new Error('Choose step, ramp or parabolic input.');
  bound(amplitude, '-10', '10', 'Input amplitude');
  const m = model.integrators + 1, size = m + inputOrder + 1;
  const d = model.denominator.map(value => toNumber(value));
  const b = model.numerator.map(value => toNumber(value));
  const h = toNumber(model.h), direct = m === 1 ? b[1] : 0, loop = 1 + h * direct;
  const c = Array.from({ length: m }, (_, i) => (b[i] ?? 0) - direct * d[i]);
  const matrix = Array.from({ length: size }, () => Array<number>(size).fill(0));
  for (let i = 0; i < m - 1; i++) matrix[i][i + 1] = 1;
  for (let i = 0; i < m; i++) matrix[m - 1][i] = -d[i] - h * c[i] / loop;
  matrix[m - 1][m] = 1 / loop;
  for (let i = m; i < size - 1; i++) matrix[i][i + 1] = 1;
  const closed = model.closed.map(value => toNumber(value));
  const leading = closed.at(-1)!;
  const poleBound = Math.max(1, 2 * Math.max(...closed.slice(0, -1).map((value, i) => (Math.abs(value / leading)) ** (1 / (m - i)))));
  const wanted = Math.max(600, Math.ceil(horizon * poleBound * 4));
  const intervals = Math.min(40_000, wanted), dt = horizon / intervals;
  const map = transition(matrix, dt);
  let state = Array<number>(size).fill(0);
  const amplitudeNumber = toNumber(amplitude), sign = channel === 'noise' ? -1 : 1;
  state[size - 1] = sign * amplitudeNumber;
  const points: Point[] = [];
  for (let k = 0; k <= intervals; k++) {
    const t = k * dt, input = amplitudeNumber * (inputOrder === 0 ? 1 : inputOrder === 1 ? t : t * t / 2);
    const r = channel === 'reference' ? input : 0, noise = channel === 'noise' ? input : 0;
    const output = c.reduce((sum, value, i) => sum + value * state[i], 0) / loop + direct * state[m] / loop;
    const point = { t, input, output, comparator: r - h * output - noise, physical: r - output };
    if ([...state, ...Object.values(point)].some(value => !Number.isFinite(value) || Math.abs(value) > 1e12)) return { points, truncated: true, resolutionLimited: wanted > intervals, interval: dt };
    points.push(point);
    if (k < intervals) state = map.map(row => row.reduce((sum, value, i) => sum + value * state[i], 0));
  }
  return { points, truncated: false, resolutionLimited: wanted > intervals, interval: dt };
}
