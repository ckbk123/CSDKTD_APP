import { excitation, initialState, stateMatrix, type Excitation, type Model } from './model';
import { compileTerms, freeTerms } from './analytic';
import { div, mul, toNumber, ONE, ZERO, type Rational } from './rational';

export type Side = 'left' | 'right';
export interface Point {
  readonly t: number; readonly side: Side; readonly input: number;
  readonly free: number; readonly forced: number; readonly total: number;
  readonly freeState: readonly number[]; readonly forcedState: readonly number[];
}
export interface Trace {
  readonly points: readonly Point[]; readonly truncated: boolean; readonly reason?: string;
  readonly resolutionLimited: boolean; readonly baseIntervals: number; readonly pulseEndsAfterHorizon: boolean;
}
type Matrix = number[][];
const identity = (n: number): Matrix => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j)));
const norm = (matrix: Matrix): number => Math.max(...matrix.map(row => row.reduce((s, x) => s + Math.abs(x), 0)));
const matrixProduct = (a: Matrix, b: Matrix): Matrix => a.map(row => b[0].map((_, j) => row.reduce((s, x, k) => s + x * b[k][j], 0)));
const vectorProduct = (a: Matrix, b: readonly number[]): number[] => a.map(row => row.reduce((s, x, j) => s + x * b[j], 0));
/** Numerical exp(A*t), bounded to four states, 24 scalings and 32 terms. */
export function transition(matrix: Matrix, time: number): Matrix {
  const size = matrix.length;
  if (size < 1 || size > 4 || matrix.some(row => row.length !== size || row.some(x => !Number.isFinite(x))) || !Number.isFinite(time) || time < 0 || time > 60) throw new Error('Use a finite square transition matrix of size at most four and time between 0 and 60 seconds.');
  const magnitude = norm(matrix) * time, squarings = Math.max(0, Math.ceil(Math.log2(magnitude / .5)));
  if (!Number.isFinite(magnitude) || squarings > 24) throw new Error('The state transition exceeds its scaling budget. Rescale the model or shorten the horizon.');
  const scaled = matrix.map(row => row.map(x => x * time / 2 ** squarings));
  let sum = identity(size), term = identity(size), converged = false;
  for (let k = 1; k <= 32; k++) {
    term = matrixProduct(term, scaled).map(row => row.map(x => x / k));
    sum = sum.map((row, i) => row.map((x, j) => x + term[i][j]));
    if (norm(term) <= 1e-16 * Math.max(1, norm(sum))) { converged = true; break; }
  }
  if (!converged) throw new Error('The bounded state-transition series did not converge.');
  for (let i = 0; i < squarings; i++) sum = matrixProduct(sum, sum);
  if (sum.some(row => row.some(x => !Number.isFinite(x)))) throw new Error('The numerical state transition overflowed. Shorten the horizon.');
  return sum;
}
function augmented(model: Model, ramp: boolean): Matrix {
  const a = stateMatrix(model), size = model.order + (ramp ? 2 : 1);
  const result = Array.from({ length: size }, () => Array<number>(size).fill(0));
  a.forEach((row, i) => row.forEach((x, j) => { result[i][j] = x; }));
  result[model.order - 1][model.order] = 1;
  if (ramp) result[model.order][model.order + 1] = 1;
  return result;
}
function validate(model: Model, input: Excitation, initial: readonly Rational[]): void { initialState(model, initial); excitation(input.kind, input.amplitude, input.width); }
function inputValue(input: Excitation, t: number, side: Side): number {
  if (!t && side === 'left') return 0;
  const amplitude = toNumber(input.amplitude);
  if (input.kind === 'step') return amplitude;
  if (input.kind === 'ramp') return amplitude * t;
  if (input.kind === 'pulse') {
    const width = toNumber(input.width);
    return t < width || (t === width && side === 'left') ? toNumber(div(input.amplitude, input.width)) : 0;
  }
  return 0; // Regular part only; ideal impulse area is recorded separately.
}
function point(model: Model, input: Excitation, t: number, side: Side, freeState: readonly number[], forcedState: readonly number[], freeOutput: number): Point {
  const c = model.b.map(x => toNumber(x)), u = inputValue(input, t, side);
  const free = freeOutput;
  const forced = c.reduce((s, x, i) => s + x * forcedState[i], 0) + toNumber(model.direct) * u;
  return { t, side, input: u, free, forced, total: free + forced, freeState: [...freeState], forcedState: forcedState.slice(0, model.order) };
}
/** Absolute-time modal evaluation prevents iteration from inventing unexcited unstable modes. */
function freeEvaluation(model: Model, initial: readonly Rational[]) {
  const output = compileTerms(freeTerms(model, initial));
  const coordinates = Array.from({ length: model.order }, (_, i) => {
    const stateOutput: Model = { ...model, b: Array.from({ length: model.order }, (_, j) => i === j ? ONE : ZERO), direct: ZERO };
    return compileTerms(freeTerms(stateOutput, initial));
  });
  return { output, state: (t: number): number[] => coordinates.map(at => at(t)) };
}
function inRange(p: Point): boolean { return [p.t, p.input, p.free, p.forced, p.total, ...p.freeState, ...p.forcedState].every(x => Number.isFinite(x) && Math.abs(x) <= 1e10); }
export function impulseAreas(model: Model, input: Excitation): { input: Rational; output: Rational } {
  return input.kind === 'impulse' ? { input: input.amplitude, output: mul(model.direct, input.amplitude) } : { input: ZERO, output: ZERO };
}
function unitInputState(model: Model, t: number, ramp: boolean): number[] {
  const size = model.order + (ramp ? 2 : 1), initial = Array<number>(size).fill(0); initial[size - 1] = 1;
  return vectorProduct(transition(augmented(model, ramp), t), initial).slice(0, model.order);
}
/** Cursor evaluation at the declared one-sided time, independent of plot interpolation. */
export function sample(model: Model, input: Excitation, initial: readonly Rational[], t: number, side: Side = 'right'): Point {
  validate(model, input, initial);
  if (!Number.isFinite(t) || t < 0 || t > 60 || !['left', 'right'].includes(side)) throw new Error('Cursor time must be between 0 and 60 seconds with a left/right side.');
  const exactFree = freeEvaluation(model, initial), free = exactFree.state(t);
  let forced = Array<number>(model.order).fill(0);
  if (input.amplitude.n && (t > 0 || side === 'right')) {
    const amplitude = toNumber(input.amplitude);
    if (input.kind === 'step' || input.kind === 'ramp') forced = unitInputState(model, t, input.kind === 'ramp').map(x => x * amplitude);
    else if (input.kind === 'impulse') {
      const jump = [...forced]; jump[model.order - 1] = amplitude; forced = vectorProduct(transition(stateMatrix(model), t), jump);
    } else if (input.kind === 'pulse') {
      const width = toNumber(input.width), height = toNumber(div(input.amplitude, input.width));
      const during = unitInputState(model, Math.min(t, width), false).map(x => x * height);
      forced = t > width ? vectorProduct(transition(stateMatrix(model), t - width), during) : during;
    }
  }
  const result = point(model, input, t, side, free, forced, exactFree.output(t));
  if (!inRange(result)) throw new Error('The cursor response exceeds the 10¹⁰ state/signal range. Choose an earlier time or rescale the experiment.');
  return result;
}
export function trace(model: Model, input: Excitation, initial: readonly Rational[], horizon: number): Trace {
  validate(model, input, initial);
  if (!Number.isFinite(horizon) || horizon < .1 || horizon > 60) throw new Error('Trace horizon must be between 0.1 and 60 seconds.');
  const a = stateMatrix(model), m = model.order, ramp = input.kind === 'ramp';
  const forcedMatrix = input.kind === 'impulse' || input.kind === 'free' ? a : augmented(model, ramp);
  const coefficientBound = m === 1 ? Math.abs(toNumber(model.a0)) : 2 * Math.max(Math.abs(toNumber(model.a1)), Math.sqrt(Math.abs(toNumber(model.a0))));
  const wanted = Math.max(600, Math.ceil(horizon * Math.max(1, coefficientBound) * 20));
  const baseIntervals = Math.min(20_000, wanted), times = new Set(Array.from({ length: baseIntervals + 1 }, (_, i) => horizon * i / baseIntervals));
  const width = input.kind === 'pulse' ? toNumber(input.width) : Infinity;
  if (width <= horizon) times.add(width);
  if (input.kind === 'pulse') for (let k = 1; k < 20; k++) { const t = width * k / 20; if (t < horizon) times.add(t); }
  const exactFree = freeEvaluation(model, initial);
  let free = exactFree.state(0), forced = Array<number>(forcedMatrix.length).fill(0), previous = 0;
  const points: Point[] = [point(model, input, 0, 'left', free, forced, exactFree.output(0))];
  if (input.kind === 'impulse') forced[m - 1] = toNumber(input.amplitude);
  else if (input.kind !== 'free') forced[forced.length - 1] = input.kind === 'pulse' ? toNumber(div(input.amplitude, input.width)) : toNumber(input.amplitude);
  points.push(point(model, input, 0, 'right', free, forced, exactFree.output(0)));
  const cacheForced = new Map<number, Matrix>();
  function advance(matrix: Matrix, state: number[], dt: number, cache: Map<number, Matrix>): number[] {
    if (!state.some(x => x !== 0)) return state;
    let map = cache.get(dt); if (!map) { map = transition(matrix, dt); if (cache.size === 128) cache.delete(cache.keys().next().value!); cache.set(dt, map); }
    return vectorProduct(map, state);
  }
  const result = (truncated: boolean, reason?: string): Trace => ({ points, truncated, reason, resolutionLimited: wanted > baseIntervals, baseIntervals, pulseEndsAfterHorizon: input.kind === 'pulse' && width > horizon });
  for (const t of [...times].sort((x, y) => x - y)) {
    if (!t) continue;
    try {
      const dt = t - previous; free = exactFree.state(t); forced = advance(forcedMatrix, forced, dt, cacheForced); previous = t;
      if (t === width) {
        const left = point(model, input, t, 'left', free, forced, exactFree.output(t));
        if (!inRange(left)) return result(true, 'A state or response component exceeded 10¹⁰. The trace stopped before the requested horizon.');
        points.push(left); forced[m] = 0;
      }
      const p = point(model, input, t, 'right', free, forced, exactFree.output(t));
      if (!inRange(p)) return result(true, 'A state or response component exceeded 10¹⁰. The trace stopped before the requested horizon.');
      points.push(p);
    } catch (error) { return result(true, error instanceof Error ? error.message : 'The bounded numerical response could not continue.'); }
  }
  return result(false);
}
