import type { Model } from './parser';
import { ZERO, add, sub, mul as qmul, neg, fromNumber, toNumber, div, type Q } from './rational';
export type Matrix = number[][];
export interface StateModel { A: Matrix; B: number[]; C: number[]; D: number; labels: string[] }
export interface Experiment {
  T: number; count: number; delay: number; amplitude: number;
  kind: 'step' | 'pulse' | 'ramp' | 'alternating'; pastY: number[]; pastU: number[];
}
export interface Row { k: number; t: number; u: number; y: number; x: number[]; next: number[] }
export interface Comparison { base: StateModel; system: StateModel; initial: number[]; rows: Row[]; recovered: Model; coefficientResidual: number; outputResidual: number }
export interface Result {
  model: Model; history: StateModel; initial: number[]; rows: Row[]; reference: number[]; inputs: number[];
  historyResidual: number; controller?: Comparison; observer?: Comparison;
  historyMap?: Matrix; coordinateMap?: Matrix; canonicalWarning: string;
}
const fail = (message: string): never => { throw new Error(message); };
const zeros = (n: number, m = n): Matrix => Array.from({ length: n }, () => Array(m).fill(0) as number[]);
const sumQ = (...values: Q[]): Q => values.reduce(add, ZERO);
const convert = (value: Q): number => toNumber(value, Number.MIN_VALUE, 1e300);
const norm = (a: Matrix): number => Math.max(0, ...a.map(row => row.reduce((s, v) => s + Math.abs(v), 0)));

/** Accumulate each small dot product exactly on its binary input values,
 * then round once to the browser-number state. Reject nonzero underflow. */
export function dot(a: number[], b: number[]): number {
  if (a.length !== b.length) fail('Dot-product dimensions do not match.');
  return convert(a.reduce((s, v, i) => add(s, qmul(fromNumber(v), fromNumber(b[i]))), ZERO));
}
export const mv = (a: Matrix, x: number[]): number[] => a.map(row => dot(row, x));
const mm = (a: Matrix, b: Matrix): Matrix => {
  if (!a.length) return [];
  if (a[0].length !== b.length) fail('Matrix-product dimensions do not match.');
  return a.map(row => Array.from({ length: b[0]?.length ?? 0 }, (_, j) => dot(row, b.map(r => r[j]))));
};
const transpose = (a: Matrix): Matrix => a.length ? a[0].map((_, j) => a.map(row => row[j])) : [];
function checked(values: number[], bound: number, label: string): void {
  if (values.some(v => !Number.isFinite(v) || Math.abs(v) > bound)) fail(label + ' exceeds its finite magnitude bound ' + bound + '. Rescale or shorten the experiment.');
}
export function validateModel(model: Model): number {
  const n = model.a.length - 1;
  if (!Number.isInteger(n) || n < 0 || n > 2 || model.b.length !== n + 1 || model.a[0] !== 1) fail('Use a monic denominator of order 0–2 and equally padded numerator coefficients.');
  checked([...model.a, ...model.b], 1e6, 'Normalized coefficients');
  if ([...model.a, ...model.b].some(v => v !== 0 && Math.abs(v) < 1e-300)) fail('A nonzero coefficient is below magnitude 10⁻³⁰⁰. Rescale the model.');
  return n;
}
function validateDelay(delay: number): void {
  if (!Number.isInteger(delay) || delay < 0 || delay > 4) fail('Use an integer input delay from 0 to 4 samples. Fractional delays are never rounded.');
}
function validateState(s: StateModel): void {
  const n = s.A.length;
  if (n > 8 || s.A.some(row => row.length !== n) || s.B.length !== n || s.C.length !== n || s.labels.length !== n) fail('State matrices must be square SISO models of at most eight scalar states.');
  checked([...s.A.flat(), ...s.B, ...s.C, s.D], 1e12, 'Generated state/map entries');
}

/** Delay outputs are past y and past u; this is a valid, often nonminimal,
 * direct history realization. Every next cell reads the old vector. */
export function historyRealization(model: Model, delay: number): StateModel {
  const n = validateModel(model); validateDelay(delay);
  const inputCells = n + delay, size = n + inputCells, A = zeros(size), B = Array(size).fill(0) as number[], C = Array(size).fill(0) as number[];
  let D = 0;
  for (let i = 0; i < n; i++) C[i] = -model.a[i + 1];
  for (let i = 0; i <= n; i++) {
    const lag = delay + i;
    if (lag === 0) D = model.b[i]; else C[n + lag - 1] = model.b[i];
  }
  if (n) { A[0] = [...C]; B[0] = D; for (let i = 1; i < n; i++) A[i][i - 1] = 1; }
  if (inputCells) { B[n] = 1; for (let i = 1; i < inputCells; i++) A[n + i][n + i - 1] = 1; }
  const labels = Array.from({ length: n }, (_, i) => 'y[k-' + (i + 1) + ']')
    .concat(Array.from({ length: inputCells }, (_, i) => 'u[k-' + (i + 1) + ']'));
  return { A, B, C, D, labels };
}

export function controllerBase(model: Model): StateModel {
  const n = validateModel(model), A = zeros(n), B = Array(n).fill(0) as number[];
  if (n) { A[0] = model.a.slice(1).map(v => -v); B[0] = 1; for (let i = 1; i < n; i++) A[i][i - 1] = 1; }
  const C = Array.from({ length: n }, (_, i) => convert(sub(fromNumber(model.b[i + 1]), qmul(fromNumber(model.a[i + 1]), fromNumber(model.b[0])))));
  const result = { A, B, C, D: model.b[0], labels: Array.from({ length: n }, (_, i) => 'w[k-' + (i + 1) + ']') };
  validateState(result); return result;
}
export function observerBase(base: StateModel): StateModel {
  return { A: transpose(base.A), B: [...base.C], C: [...base.B], D: base.D, labels: base.labels.map((_, i) => 'v' + (i + 1) + '[k]') };
}

/** q1[k+1]=u[k], qj[k+1]=q(j-1)[k], with plant input qm[k].
 * Feedthrough D moves to the last delay tap when m>0. */
export function withInputDelay(base: StateModel, delay: number): StateModel {
  validateState(base); validateDelay(delay);
  if (!delay) return { ...base, A: base.A.map(row => [...row]), B: [...base.B], C: [...base.C], labels: [...base.labels] };
  const n = base.A.length, size = n + delay, A = zeros(size), B = Array(size).fill(0) as number[], C = [...base.C, ...Array(delay).fill(0)] as number[];
  for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) A[i][j] = base.A[i][j]; A[i][size - 1] = base.B[i]; }
  B[n] = 1; for (let i = 1; i < delay; i++) A[n + i][n + i - 1] = 1;
  C[size - 1] = base.D;
  const result = { A, B, C, D: 0, labels: base.labels.concat(Array.from({ length: delay }, (_, i) => 'u[k-' + (i + 1) + ']')) };
  validateState(result); return result;
}

/** Recover the actual numerical base matrices' coefficients; explicit
 * delay factors are derived separately from their shift-register equations. */
export function recoverBase(s: StateModel): Model {
  validateState(s); const n = s.A.length;
  if (n > 2) fail('Recover the order-0–2 base separately from its declared input-delay register.');
  if (!n) return { a: [1], b: [s.D] };
  const A = s.A.map(row => row.map(fromNumber)), B = s.B.map(fromNumber), C = s.C.map(fromNumber), D = fromNumber(s.D);
  if (n === 1) return { a: [1, convert(neg(A[0][0]))], b: [s.D, convert(sub(qmul(C[0], B[0]), qmul(D, A[0][0])))] };
  const [[a, b], [c, d]] = A, tr = add(a, d), det = sub(qmul(a, d), qmul(b, c));
  return { a: [1, convert(neg(tr)), convert(det)], b: [s.D,
    convert(sub(add(qmul(C[0], B[0]), qmul(C[1], B[1])), qmul(D, tr))),
    convert(sumQ(qmul(D, det), neg(qmul(qmul(C[0], d), B[0])), qmul(qmul(C[0], b), B[1]), qmul(qmul(C[1], c), B[0]), neg(qmul(qmul(C[1], a), B[1]))))] };
}
export function delayedTransfer(base: Model, delay: number): Model {
  validateModel(base); validateDelay(delay);
  return { a: [...base.a, ...Array(delay).fill(0)], b: [...Array(delay).fill(0), ...base.b] };
}
export function historyTransfer(base: Model, delay: number): Model {
  const n = validateModel(base); validateDelay(delay);
  return { a: [...base.a, ...Array(n + delay).fill(0)], b: [...Array(delay).fill(0), ...base.b, ...Array(n).fill(0)] };
}
export function coefficientResidual(expected: Model, recovered: Model): number {
  if (expected.a.length !== recovered.a.length || expected.b.length !== recovered.b.length) return Infinity;
  const target = [...expected.a, ...expected.b], actual = [...recovered.a, ...recovered.b], scale = Math.max(1, ...target.map(Math.abs));
  return Math.max(...target.map((v, i) => Math.abs(actual[i] - v) / (v === 0 ? scale : Math.abs(v))));
}

/** This scalar route uses original time indices and past arrays, not A*x.
 * Shared bounded rational primitives only control rounding of each sum. */
export function recurrenceSamples(model: Model, delay: number, pastY: number[], pastU: number[], inputs: number[]): number[] {
  const n = validateModel(model); validateDelay(delay);
  if (pastY.length !== n || pastU.length !== n + delay || inputs.length > 120) fail('Provide n past outputs and n+m past inputs, newest first.');
  checked([...pastY, ...pastU, ...inputs], 1e4, 'Input/history samples');
  const values: number[] = [];
  const u = (k: number): number => k < 0 ? pastU[-k - 1] : inputs[k];
  const y = (k: number): number => k < 0 ? pastY[-k - 1] : values[k];
  for (let k = 0; k < inputs.length; k++) {
    let value = ZERO;
    for (let j = 1; j <= n; j++) value = sub(value, qmul(fromNumber(model.a[j]), fromNumber(y(k - j))));
    for (let j = 0; j <= n; j++) value = add(value, qmul(fromNumber(model.b[j]), fromNumber(u(k - delay - j))));
    const sample = convert(value); checked([sample], 1e10, 'Recurrence output'); values.push(sample);
  }
  return values;
}

export function trace(system: StateModel, initial: number[], inputs: number[], T: number): Row[] {
  validateState(system);
  if (initial.length !== system.A.length || inputs.length > 120 || !Number.isFinite(T) || T < 1e-4 || T > 10) fail('Check initial-state dimensions, sample count and T from .0001 to 10 seconds.');
  checked(initial, 1e12, 'Initial state'); checked(inputs, 1e4, 'Input samples');
  let x = [...initial];
  return inputs.map((u, k) => {
    const y = dot([...system.C, system.D], [...x, u]);
    const next = system.A.map((row, i) => dot([...row, system.B[i]], [...x, u]));
    checked([y], 1e10, 'State-model output'); checked(next, 1e12, 'Next state');
    const result = { k, t: k * T, u, y, x: [...x], next }; x = next; return result;
  });
}

function inverse(a: Matrix): Matrix {
  const n = a.length;
  if (!n) return [];
  if (n > 2 || a.some(row => row.length !== n)) fail('The coordinate solve supports only base dimension 1 or 2.');
  const singular = (): never => fail('The canonical coordinate/history map is singular, nonminimal or too ill-conditioned. The history register remains available.');
  let result: Matrix;
  if (n === 1) { if (a[0][0] === 0) return singular(); result = [[convert(div(fromNumber(1), fromNumber(a[0][0])))]]; }
  else {
    const [[p, q], [r, s]] = a.map(row => row.map(fromNumber)), det = sub(qmul(p, s), qmul(q, r));
    if (!det.n) return singular();
    result = [[convert(div(s, det)), convert(div(neg(q), det))], [convert(div(neg(r), det)), convert(div(p, det))]];
  }
  const condition = norm(a) * norm(result);
  if (!Number.isFinite(condition) || condition > 1e10) return singular();
  return result;
}
function observability(base: StateModel): Matrix { return base.A.length === 2 ? [[...base.C], mm([base.C], base.A)[0]] : base.A.length ? [[base.C[0]]] : []; }
function relativeMatrix(a: Matrix, b: Matrix): number {
  if (a.length !== b.length || a.some((r, i) => r.length !== b[i].length)) return Infinity;
  const scale = Math.max(1, norm(a), norm(b));
  return Math.max(0, ...a.flatMap((r, i) => r.map((v, j) => Math.abs(v - b[i][j]) / scale)));
}
function outputResidual(rows: Row[], expected: number[]): number {
  return Math.max(0, ...rows.map((row, i) => Math.abs(row.y - expected[i]) / Math.max(1, Math.abs(expected[i]))));
}

/** Linear map from declared y/u prehistory to controllable base coordinates.
 * Subtract the SAME delayed-input prehistory response before solving O*x. */
export function historyMap(model: Model, delay: number, controller: StateModel): Matrix {
  const n = validateModel(model), columns = 2 * n + delay;
  if (!n) return [];
  const inv = inverse(observability(controller)), out = zeros(n, columns), future = Array(n).fill(0) as number[], delayed = withInputDelay(controller, delay);
  for (let col = 0; col < columns; col++) {
    const initial = Array(columns).fill(0) as number[]; initial[col] = 1;
    const expected = recurrenceSamples(model, delay, initial.slice(0, n), initial.slice(n), future);
    const forced = trace(delayed, [...Array(n).fill(0), ...initial.slice(n, n + delay)], future, 1).map(p => p.y);
    const value = mv(inv, expected.map((v, i) => convert(sub(fromNumber(v), fromNumber(forced[i])))));
    value.forEach((v, i) => { out[i][col] = v; });
  }
  checked(out.flat(), 1e12, 'History map entries'); return out;
}
function coordinateMap(controller: StateModel, observer: StateModel): Matrix {
  const n = controller.A.length;
  if (!n) return [];
  const map = mm(inverse(observability(observer)), observability(controller)); inverse(map);
  checked(map.flat(), 1e12, 'Coordinate map entries');
  if (relativeMatrix(mm(map, controller.A), mm(observer.A, map)) > 1e-9 ||
      relativeMatrix(mv(map, controller.B).map(v => [v]), observer.B.map(v => [v])) > 1e-9 ||
      relativeMatrix(mm([observer.C], map), [controller.C]) > 1e-9) fail('The numerical coordinate-map residual is too large. Rescale the coefficients.');
  return map;
}

export function run(model: Model, e: Experiment): Result {
  const n = validateModel(model); validateDelay(e.delay);
  if (!Number.isInteger(e.count) || e.count < 4 || e.count > 120) fail('Choose 4–120 sample instants.');
  if (!Number.isFinite(e.T) || e.T < 1e-4 || e.T > 10) fail('Choose T from .0001 to 10 seconds.');
  if (!['step', 'pulse', 'ramp', 'alternating'].includes(e.kind)) fail('Choose a named sample sequence.');
  checked([e.amplitude], 1e4, 'Input amplitude');
  const inputs = Array.from({ length: e.count }, (_, k) => e.kind === 'step' ? e.amplitude : e.kind === 'pulse' ? (k === 0 ? e.amplitude : 0) : e.kind === 'alternating' ? e.amplitude * (-1) ** k : e.amplitude * k * e.T);
  const reference = recurrenceSamples(model, e.delay, e.pastY, e.pastU, inputs), history = historyRealization(model, e.delay), initial = [...e.pastY, ...e.pastU];
  const rows = trace(history, initial, inputs, e.T), historyResidual = outputResidual(rows, reference);
  if (historyResidual > 1e-10) fail('The generated history register disagrees with the independently indexed recurrence. Rescale the experiment.');
  const result: Result = { model, history, initial, rows, reference, inputs, historyResidual, canonicalWarning: '' };
  try {
    const base = controllerBase(model), observer = observerBase(base), recovered = recoverBase(base), recoveredObserver = recoverBase(observer);
    const coefficientError = Math.max(coefficientResidual(model, recovered), coefficientResidual(model, recoveredObserver));
    if (coefficientError > 1e-9) fail('Canonical coefficient recovery exceeds relative tolerance 10⁻⁹. Rescale the model.');
    const map = historyMap(model, e.delay, base), coordinates = coordinateMap(base, observer), xc = n ? mv(map, initial) : [], xo = n ? mv(coordinates, xc) : [];
    const delayInitial = e.pastU.slice(0, e.delay), controlled = withInputDelay(base, e.delay), observed = withInputDelay(observer, e.delay);
    const ic = [...xc, ...delayInitial], io = [...xo, ...delayInitial], rc = trace(controlled, ic, inputs, e.T), ro = trace(observed, io, inputs, e.T);
    const erc = outputResidual(rc, reference), ero = outputResidual(ro, reference);
    if (Math.max(erc, ero) > 1e-8) fail('Canonical output comparison exceeds scaled tolerance 10⁻⁸ on this horizon. Rescale or shorten the experiment.');
    result.controller = { base, system: controlled, initial: ic, rows: rc, recovered, coefficientResidual: coefficientError, outputResidual: erc };
    result.observer = { base: observer, system: observed, initial: io, rows: ro, recovered: recoveredObserver, coefficientResidual: coefficientError, outputResidual: ero };
    result.historyMap = map; result.coordinateMap = coordinates;
  } catch (error) { result.canonicalWarning = 'Canonical comparison unavailable: ' + (error instanceof Error ? error.message : 'Check the coefficients and history.'); }
  return result;
}

/** The declared mechanical source only: poles -1,-2. expm1 avoids losing
 * the O(T^2) first input-integral component at a small sample period. */
export function zohBaseline(T: number): { model: Model; continuous: StateModel; discrete: StateModel } {
  if (!Number.isFinite(T) || T < 1e-4 || T > 10) fail('Choose baseline T from .0001 to 10 seconds.');
  const p = Math.exp(-T), r = -Math.expm1(-T), off = p * r;
  const continuous: StateModel = { A: [[0, 1], [-2, -3]], B: [0, 1], C: [1, 0], D: 0, labels: ['x1', 'x2'] };
  const discrete: StateModel = { A: [[p * (1 + r), off], [-2 * off, p * (1 - 2 * r)]], B: [.5 * r * r, off], C: [1, 0], D: 0, labels: ['x1[k]', 'x2[k]'] };
  return { model: recoverBase(discrete), continuous, discrete };
}

export const fmt = (v: number): string => v === 0 ? '0' : Number(v.toPrecision(7)).toString();
export const tex = (v: number): string => fmt(v).replace(/e([+-]?\d+)/, '\\times10^{$1}');
export const matrixTex = (a: Matrix): string => a.length ? '\\begin{bmatrix}' + a.map(row => row.map(tex).join('&')).join('\\\\') + '\\end{bmatrix}' : '\\varnothing';
export const polyTex = (a: number[]): string => a.map((v, i) => '(' + tex(v) + ')' + (i < a.length - 1 ? 'z^{' + (a.length - 1 - i) + '}' : '')).join('+');
