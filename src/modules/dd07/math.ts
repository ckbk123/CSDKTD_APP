export type Vector = readonly [number, number];
export type Matrix = readonly [number, number, number, number];
export type Complex = readonly [number, number];
export type Timing = 'predictor' | 'current';
export interface Observer {
  A: Matrix; C: Vector; target: Vector; L: Vector; closed: Matrix;
  observability: Matrix; scaledDet: number; matching: Matrix; rhs: Vector;
  actual: Vector; poles: Complex[]; residual: number;
}
export interface CurrentCorrection { M: Vector; priorMatrix: Matrix; correctedMatrix: Matrix; residual: number }
export interface Feedback { A: Matrix; B: Vector; C: Vector; K: Vector; closed: Matrix; poles: Complex[]; actual: Vector; residual: number; dcGain: number | null; prefilter: number | null }
export interface Options {
  initial: Vector; prior: Vector; heldInput: number; reference: number;
  noiseAmplitude: number; noiseFrequency: number; noisePhase: number;
  period: number; steps: number; timing: Timing;
}
export interface Sample {
  k: number; t: number; x: Vector; prior: Vector; estimate: Vector; priorError: Vector; error: Vector;
  cleanOutput: number; measuredOutput: number; estimatedOutput: number; innovation: number; noise: number; effort: number;
}
export interface Run {
  samples: Sample[]; correction: CurrentCorrection | null; errorMatrix: Matrix; correctedErrorMatrix: Matrix;
  errorPoles: Complex[]; plantPoles: Complex[]; allPoles: Complex[]; referenceGain: number;
  rmsError: Vector; peakEffort: number; aliasedNoise: boolean;
}
export const dot = (a: Vector, b: Vector): number => a[0] * b[0] + a[1] * b[1];
export const mv = (a: Matrix, b: Vector): Vector => [a[0] * b[0] + a[1] * b[1], a[2] * b[0] + a[3] * b[1]];
const mm = (a: Matrix, b: Matrix): Matrix => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3]];
const transpose = (a: Matrix): Matrix => [a[0], a[2], a[1], a[3]];
const det = (a: Matrix): number => a[0] * a[3] - a[1] * a[2];
function bounded(values: readonly number[], size: number, bound: number, label: string): void {
  if (values.length !== size || values.some(v => !Number.isFinite(v) || Math.abs(v) > bound)) throw new Error(`${label} needs ${size} finite entries of magnitude at most ${bound}.`);
}
export function characteristic(a: Matrix): Vector { return [-(a[0] + a[3]), det(a)]; }
export function quadratic([b, c]: Vector): Complex[] {
  bounded([b, c], 2, 1e9, 'Characteristic coefficients');
  const d = b * b - 4 * c;
  if (d < 0) return [[-b / 2, Math.sqrt(-d) / 2], [-b / 2, -Math.sqrt(-d) / 2]];
  const q = -.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(d));
  if (q !== 0 && c !== 0 && c / q === 0) throw new Error('A mode underflows; rescale the data.');
  return q === 0 ? [[0, 0], [0, 0]] : [[q, 0], [c / q, 0]];
}
export function normalizedDet(a: Matrix): number {
  const n1 = Math.hypot(a[0], a[1]), n2 = Math.hypot(a[2], a[3]);
  return n1 && n2 ? a[0] / n1 * (a[3] / n2) - a[1] / n1 * (a[2] / n2) : 0;
}
export function solve(a: Matrix, b: Vector): Vector {
  const n1 = Math.hypot(a[0], a[1]), n2 = Math.hypot(a[2], a[3]), d = normalizedDet(a);
  if (!n1 || !n2 || Math.abs(d) <= 1e-9) throw new Error('The 2×2 solve is singular or poorly conditioned at scaled tolerance 10⁻⁹.');
  const answer: Vector = [(b[0] / n1 * (a[3] / n2) - a[1] / n1 * (b[1] / n2)) / d, (a[0] / n1 * (b[1] / n2) - b[0] / n1 * (a[2] / n2)) / d];
  if (answer.some(v => !Number.isFinite(v))) throw new Error('The linear solve exceeds numeric range.');
  return answer;
}
export function schur(target: Vector): boolean {
  const [b, c] = target;
  return Math.abs(c) < 1 - 1e-9 && 1 + b + c > 1e-9 && 1 - b + c > 1e-9;
}
function place(A: Matrix, C: Vector, target: Vector, kind: string): Observer {
  bounded(A, 4, 1000, 'Discrete A'); bounded(C, 2, 1000, 'Sensor/input'); bounded(target, 2, 10000, 'Target');
  if (!schur(target)) throw new Error('Use a strictly Schur quadratic: |d₀|<1, 1+d₁+d₀>0 and 1−d₁+d₀>0, with margin greater than 10⁻⁹.');
  const CA: Vector = [C[0] * A[0] + C[1] * A[2], C[0] * A[1] + C[1] * A[3]];
  const observability: Matrix = [C[0], C[1], CA[0], CA[1]], rank = normalizedDet(observability);
  if (Math.abs(rank) <= 1e-9) throw new Error(`${kind} rank is below 2 at scaled tolerance 10⁻⁹. Two arbitrary targets cannot be placed.`);
  const matching: Matrix = [C[0], C[1], C[0] * A[3] - C[1] * A[2], -C[0] * A[1] + C[1] * A[0]];
  const rhs: Vector = [A[0] + A[3] + target[0], det(A) - target[1]], L = solve(matching, rhs);
  bounded(L, 2, 1e6, 'Gain');
  const closed: Matrix = [A[0] - L[0] * C[0], A[1] - L[0] * C[1], A[2] - L[1] * C[0], A[3] - L[1] * C[1]];
  bounded(closed, 4, 10000, 'Closed matrix');
  const actual = characteristic(closed), residual = Math.max(...actual.map((v, i) => Math.abs(v - target[i]) / Math.max(1, Math.abs(target[i]))));
  if (!Number.isFinite(residual) || residual > 1e-10 || !schur(actual)) throw new Error('Actual coefficient verification lost accuracy; rescale the model or targets.');
  return { A: [...A], C: [...C], target: [...target], L, closed, observability, scaledDet: rank, matching, rhs, actual, poles: quadratic(actual), residual };
}
export function designObserver(A: Matrix, C: Vector, target: Vector): Observer { return place(A, C, target, 'Observability'); }
export function currentCorrection(observer: Observer): CurrentCorrection {
  const M = solve(observer.A, observer.L); bounded(M, 2, 1e6, 'Current correction gain');
  const [c, d] = observer.C, V: Matrix = [1 - M[0] * c, -M[0] * d, -M[1] * c, 1 - M[1] * d];
  const priorMatrix = mm(observer.A, V), correctedMatrix = mm(V, observer.A);
  const residual = Math.max(...priorMatrix.map((v, i) => Math.abs(v - observer.closed[i]) / Math.max(1, Math.abs(observer.closed[i]))));
  const actual = characteristic(correctedMatrix);
  if (residual > 1e-10 || actual.some((v, i) => Math.abs(v - observer.target[i]) > 1e-10 * Math.max(1, Math.abs(observer.target[i])))) throw new Error('Current/predictor equivalence lost accuracy; use predictor timing or rescale.');
  return { M, priorMatrix, correctedMatrix, residual };
}
export function designFeedback(A: Matrix, B: Vector, C: Vector, target: Vector): Feedback {
  bounded(C, 2, 1000, 'C');
  const dual = place(transpose(A), B, target, 'Controllability'), closed = transpose(dual.closed);
  let dcGain: number | null = null, prefilter: number | null = null;
  try {
    const invB = solve([1 - closed[0], -closed[1], -closed[2], 1 - closed[3]], B), scale = Math.hypot(...C) * Math.hypot(...invB), gain = dot(C, invB), N = 1 / gain;
    if (Number.isFinite(gain) && Number.isFinite(scale)) {
      dcGain = gain;
      if (scale > 0 && Math.abs(gain) > 1e-10 * scale && Number.isFinite(N) && Math.abs(N) <= 1e6) prefilter = N;
    }
  } catch { /* Keep checked K even when DC tracking cannot be supported. */ }
  return { A: [...A], B: [...B], C: [...C], K: dual.L, closed, poles: dual.poles, actual: dual.actual, residual: dual.residual, dcGain, prefilter };
}
/** Scaling/squaring Taylor exponential of the 3×3 ZOH augmented matrix. */
export function zoh(A: Matrix, B: Vector, period: number): { A: Matrix; B: Vector } {
  bounded(A, 4, 1000, 'Continuous A'); bounded(B, 2, 1000, 'Continuous B'); validatePeriod(period);
  const source = [A[0] * period, A[1] * period, B[0] * period, A[2] * period, A[3] * period, B[1] * period, 0, 0, 0];
  const norm = Math.max(...[0, 1, 2].map(i => source.slice(3 * i, 3 * i + 3).reduce((s, v) => s + Math.abs(v), 0)));
  const scaling = Math.max(0, Math.ceil(Math.log2(norm / .5)));
  if (scaling > 24) throw new Error('ZOH scaling limit exceeded; reduce period or matrix scale.');
  const reduced = source.map(v => v / 2 ** scaling), identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const multiply = (a: number[], b: number[]) => Array.from({ length: 9 }, (_, i) => [0, 1, 2].reduce((s, k) => s + a[3 * Math.floor(i / 3) + k] * b[3 * k + i % 3], 0));
  let result = [...identity], term = [...identity], converged = false;
  for (let k = 1; k <= 24; k++) {
    term = multiply(term, reduced).map(v => v / k); result = result.map((v, i) => v + term[i]);
    if (Math.max(...term.map(Math.abs)) < 1e-16) { converged = true; break; }
  }
  if (!converged) throw new Error('ZOH exponential did not converge within 24 terms.');
  for (let k = 0; k < scaling; k++) { result = multiply(result, result); if (result.some(v => !Number.isFinite(v))) throw new Error('ZOH model overflow; reduce period or matrix scale.'); }
  const Ad: Matrix = [result[0], result[1], result[3], result[4]], Bd: Vector = [result[2], result[5]];
  bounded(Ad, 4, 1000, 'ZOH A_d'); bounded(Bd, 2, 1000, 'ZOH B_d');
  const expectedDet = Math.exp((A[0] + A[3]) * period), actualDet = det(Ad);
  if (!Number.isFinite(expectedDet) || expectedDet === 0 || Math.abs(actualDet - expectedDet) > 1e-9 * expectedDet) throw new Error('ZOH determinant verification lost accuracy or underflowed; reduce period or rescale.');
  return { A: Ad, B: Bd };
}
export function validatePeriod(period: number): void { if (!Number.isFinite(period) || period < .0001 || period > 10) throw new Error('Sample period T must be between 0.0001 and 10 seconds.'); }
/** Bounded joint [truth, prior-error] allowance. Signed powers inside an
 * eight-step block avoid the artificial growth from repeatedly applying |F|.
 * Matrix-product rounding radii and every local error remain in the bound. */
function accuracyStepper(F: number[][], initial: number[]): (local: number[]) => number[] {
  const round = 64 * Number.EPSILON, n = 4;
  let center = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Number(i === j))), radius = Array.from({ length: n }, () => Array(n).fill(0) as number[]);
  const absolute = [center];
  for (let k = 1; k <= 8; k++) {
    const next = Array.from({ length: n }, () => Array(n).fill(0) as number[]), nextRadius = next.map(row => [...row]);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let l = 0; l < n; l++) {
      const product = center[i][l] * F[l][j]; next[i][j] += product;
      nextRadius[i][j] += Math.abs(F[l][j]) * radius[i][l] + round * Math.abs(product);
    }
    center = next; radius = nextRadius;
    absolute.push(center.map((row, i) => row.map((value, j) => (Math.abs(value) + radius[i][j]) * (1 + round))));
  }
  let anchor = initial, errors: number[][] = [];
  return local => {
    errors.push(local); const length = errors.length;
    const result = Array.from({ length: n }, (_, i) => {
      let sum = absolute[length][i].reduce((s, value, j) => s + value * anchor[j], 0);
      errors.forEach((e, j) => { sum += absolute[length - j - 1][i].reduce((s, value, l) => s + value * e[l], 0); });
      return sum * (1 + 4 * round);
    });
    if (length === 8) { anchor = result; errors = []; }
    return result;
  };
}

export function simulate(observer: Observer, B: Vector, options: Options, feedback?: Feedback): Run {
  bounded(B, 2, 1000, 'Discrete B'); validatePeriod(options.period);
  if (feedback && (feedback.A.some((v,i)=>v!==observer.A[i]) || feedback.B.some((v,i)=>v!==B[i]) || feedback.C.some((v,i)=>v!==observer.C[i]))) throw new Error('Feedback and observer must use the same sampled A_d, B_d and C.');
  bounded(options.initial, 2, 100, 'Initial state'); bounded(options.prior, 2, 100, 'Initial prior estimate');
  bounded([options.heldInput, options.reference, options.noiseAmplitude, options.noiseFrequency, options.noisePhase], 5, 100, 'Input/reference/noise controls');
  if (options.noiseAmplitude < 0 || options.noiseFrequency < 0) throw new Error('Noise amplitude and frequency must be nonnegative.');
  if (!Number.isInteger(options.steps) || options.steps < 1 || options.steps > 1000) throw new Error('Use an integer horizon from 1 to 1,000 sample steps.');
  if (!['predictor', 'current'].includes(options.timing)) throw new Error('Choose predictor or current-estimate timing.');
  const correction = options.timing === 'current' ? currentCorrection(observer) : null;
  const A = observer.A, C = observer.C, N = feedback?.prefilter ?? 1;
  let x: Vector = [...options.initial], p: Vector = [...options.prior];
  const round = 64 * Number.EPSILON;
  const V: Matrix = correction ? [1 - correction.M[0] * C[0], -correction.M[0] * C[1], -correction.M[1] * C[0], 1 - correction.M[1] * C[1]] : [1, 0, 0, 1];
  const K = feedback?.K ?? [0, 0], BK: Matrix = [B[0] * K[0], B[0] * K[1], B[1] * K[0], B[1] * K[1]], coupling = mm(BK, V), plantClosed = feedback?.closed ?? A, errorTransition = correction?.priorMatrix ?? observer.closed;
  // x'=(A-BK)x+BK*V*e_prior+known inputs; e_prior'=(A-LC)e_prior+known noise.
  const transition = [[plantClosed[0], plantClosed[1], coupling[0], coupling[1]], [plantClosed[2], plantClosed[3], coupling[2], coupling[3]], [0, 0, errorTransition[0], errorTransition[1]], [0, 0, errorTransition[2], errorTransition[3]]];
  let allowance = [...options.initial.map(value => round * Math.abs(value)), ...options.initial.map((value, i) => 2 * round * (Math.abs(value) + Math.abs(options.prior[i])))];
  const advanceAllowance = accuracyStepper(transition, allowance);
  const samples: Sample[] = [];
  for (let k = 0; k <= options.steps; k++) {
    const t = k * options.period, noise = options.noiseAmplitude * Math.sin(options.noiseFrequency * t + options.noisePhase), cleanOutput = dot(C, x), measuredOutput = cleanOutput + noise, innovation = measuredOutput - dot(C, p);
    const estimate: Vector = correction ? [p[0] + correction.M[0] * innovation, p[1] + correction.M[1] * innovation] : [...p];
    const effort = feedback ? -dot(feedback.K, estimate) + N * options.reference : options.heldInput;
    const error: Vector = [x[0] - estimate[0], x[1] - estimate[1]], priorError: Vector = [x[0] - p[0], x[1] - p[1]], estimatedOutput = dot(C, estimate);
    if ([...x, ...p, ...estimate, ...error, ...priorError, noise, cleanOutput, measuredOutput, innovation, estimatedOutput, effort].some(v => !Number.isFinite(v) || Math.abs(v) > 1e8)) throw new Error('Sampled response exceeds the magnitude limit 10⁸; reduce horizon, input or model growth.');
    const absoluteDot = (a: Vector, b: Vector) => Math.abs(a[0] * b[0]) + Math.abs(a[1] * b[1]);
    const innovationLocal = round * (absoluteDot(C, x) + absoluteDot(C, p) + 2 * Math.abs(noise));
    const estimateLocal: Vector = correction ? [Math.abs(correction.M[0]) * innovationLocal + round * (Math.abs(p[0]) + Math.abs(correction.M[0] * innovation)), Math.abs(correction.M[1]) * innovationLocal + round * (Math.abs(p[1]) + Math.abs(correction.M[1] * innovation))] : [0, 0];
    const estimateAllowance: Vector = [0, 1].map(i => allowance[i] + Math.abs(V[2 * i]) * allowance[2] + Math.abs(V[2 * i + 1]) * allowance[3] + estimateLocal[i] + (correction ? round * Math.abs(correction.M[i]) * (Math.abs(C[0] * priorError[0]) + Math.abs(C[1] * priorError[1])) : 0)) as unknown as Vector;
    const effortLocal = feedback ? Math.abs(K[0]) * estimateLocal[0] + Math.abs(K[1]) * estimateLocal[1] + round * (absoluteDot(K, estimate) + Math.abs(N * options.reference)) : round * Math.abs(options.heldInput);
    const effortAllowance = Math.abs(K[0]) * estimateAllowance[0] + Math.abs(K[1]) * estimateAllowance[1] + effortLocal;
    const outputAllowance = Math.abs(C[0]) * allowance[0] + Math.abs(C[1]) * allowance[1] + round * absoluteDot(C, x);
    const truthUnresolved = allowance.slice(0, 2).some((e, i) => !Number.isFinite(e) || e > 1e-8 * Math.max(1, Math.abs(x[i])));
    const estimateUnresolved = estimateAllowance.some((e, i) => !Number.isFinite(e) || e > 1e-8 * Math.max(1, Math.abs(estimate[i])));
    const errorUnresolved = estimateAllowance.some((e, i) => e + allowance[i] > 1e-8 * Math.max(1, Math.abs(error[i])));
    if (truthUnresolved || estimateUnresolved || errorUnresolved || outputAllowance > 1e-8 * Math.max(1, Math.abs(cleanOutput)) || effortAllowance > 1e-8 * Math.max(1, Math.abs(effort))) throw new Error(`Roundoff amplification makes the state/estimate/error at sample ${k} numerically unresolved (10⁻⁸ relative/absolute allowance). Shorten the horizon or rescale the model/initial states; no observer trajectory is reported.`);
    samples.push({ k, t, x: [...x], prior: [...p], estimate, error, priorError, cleanOutput, measuredOutput, estimatedOutput, innovation, noise, effort });
    if (k === options.steps) break;
    const Ax = mv(A, x), Ap = mv(A, correction ? estimate : p);
    x = [Ax[0] + B[0] * effort, Ax[1] + B[1] * effort];
    const localX = [0, 1].map(i => Math.abs(B[i]) * effortLocal + round * (Math.abs(A[2 * i] * samples[k].x[0]) + Math.abs(A[2 * i + 1] * samples[k].x[1]) + Math.abs(B[i] * effort)));
    const localP = [0, 1].map(i => Math.abs(B[i]) * effortLocal + (correction ? Math.abs(A[2 * i]) * estimateLocal[0] + Math.abs(A[2 * i + 1]) * estimateLocal[1] : Math.abs(observer.L[i]) * innovationLocal) + round * (Math.abs(A[2 * i] * (correction ? estimate[0] : p[0])) + Math.abs(A[2 * i + 1] * (correction ? estimate[1] : p[1])) + Math.abs(B[i] * effort) + (correction ? 0 : Math.abs(observer.L[i] * innovation))));
    // Include coefficient-formation uncertainty in the joint transition too.
    const formation = [0, 1].map(i => {
      let bound = 0;
      for (let j = 0; j < 2; j++) {
        let couplingScale = 0, errorScale = correction ? 0 : Math.abs(A[2 * i + j]) + Math.abs(observer.L[i] * C[j]);
        for (let l = 0; l < 2; l++) {
          const scale = Math.abs(V[2 * l + j]) + (correction ? Math.abs(correction.M[l] * C[j]) : 0);
          couplingScale += Math.abs(BK[2 * i + l]) * scale;
          if (correction) errorScale += Math.abs(A[2 * i + l]) * scale;
        }
        bound += (Math.abs(A[2 * i + j]) + Math.abs(BK[2 * i + j])) * (Math.abs(samples[k].x[j]) + allowance[j]) + (couplingScale + errorScale) * (Math.abs(priorError[j]) + allowance[2 + j]);
      }
      return round * bound;
    });
    allowance = advanceAllowance([localX[0] + formation[0], localX[1] + formation[1], localX[0] + localP[0] + 2 * formation[0], localX[1] + localP[1] + 2 * formation[1]]);
    p = [Ap[0] + B[0] * effort + (correction ? 0 : observer.L[0] * innovation), Ap[1] + B[1] * effort + (correction ? 0 : observer.L[1] * innovation)];
  }
  const errorMatrix = correction?.priorMatrix ?? observer.closed, correctedErrorMatrix = correction?.correctedMatrix ?? observer.closed;
  const errorPoles = quadratic(characteristic(errorMatrix)), plantPoles = feedback?.poles ?? quadratic(characteristic(A));
  return { samples, correction, errorMatrix, correctedErrorMatrix, errorPoles, plantPoles, allPoles: [...plantPoles, ...errorPoles], referenceGain: N,
    rmsError: [0, 1].map(i => Math.sqrt(samples.reduce((s, v) => s + v.error[i] ** 2, 0) / samples.length)) as unknown as Vector,
    peakEffort: Math.max(...samples.map(s => Math.abs(s.effort))), aliasedNoise: options.noiseAmplitude > 0 && options.noiseFrequency * options.period >= Math.PI };
}
