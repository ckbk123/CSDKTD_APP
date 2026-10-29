export type V2 = readonly [number, number];
export type M2 = readonly [V2, V2];
export interface Pole { readonly re: number; readonly im: number }
export interface Plant { readonly A: M2; readonly B: V2; readonly C: V2; readonly T: number }
export interface Targets {
  readonly sum: number; readonly product: number; readonly poles: readonly Pole[];
  readonly description: string; readonly aliasWarning: string;
}
export interface Model extends Plant {
  readonly Ad: M2; readonly Bd: V2; readonly W: M2;
  readonly rank: 0 | 1 | 2; readonly scaledDeterminant: number;
}
export interface Feedback {
  readonly K: V2; readonly closed: M2; readonly sum: number; readonly product: number;
  readonly coefficientMatrix: M2; readonly coefficientRhs: V2;
  readonly poles: readonly Pole[]; readonly conditions: readonly number[];
  readonly stability: 'stable' | 'unstable' | 'boundary'; readonly residual: number;
}
export type Tracking = { readonly available: false; readonly reason: string } | {
  readonly available: true; readonly N: number; readonly dc: number;
  readonly equilibrium: V2; readonly residual: number; readonly certified: boolean;
};
export interface Design {
  readonly model: Model; readonly targets: Targets; readonly feedback?: Feedback;
  readonly tracking?: Tracking; readonly issue: string;
}
export interface Sample { readonly k: number; readonly t: number; readonly x1: number; readonly x2: number; readonly r: number; readonly y: number; readonly u: number; readonly error: number }
export interface Trace {
  readonly samples: readonly Sample[]; readonly warning: string; readonly requested: number;
  readonly maxEffort: number; readonly overshoot?: number; readonly bandEntry?: number;
}
const RANK_TOLERANCE = 1e-10, RESIDUAL_TOLERANCE = 1e-8;
const v = (a: number, b: number): V2 => [a, b];
const mv = (a: M2, b: V2): V2 => v(a[0][0] * b[0] + a[0][1] * b[1], a[1][0] * b[0] + a[1][1] * b[1]);
const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1];
const det = (a: M2) => a[0][0] * a[1][1] - a[0][1] * a[1][0];
const adj = (a: M2): M2 => [v(a[1][1], -a[0][1]), v(-a[1][0], a[0][0])];
const norm = (a: readonly (readonly number[])[]) => Math.max(...a.map(row => row.reduce((s, x) => s + Math.abs(x), 0)));
function finite(value: number, name: string, lo: number, hi: number): void {
  if (!Number.isFinite(value) || value < lo || value > hi) throw new Error(`Enter ${name} between ${lo} and ${hi}.`);
}
function coefficient(value: number): void {
  finite(value, 'each matrix entry', -100, 100);
  if (value !== 0 && Math.abs(value) < 1e-12) throw new Error('Use zero or matrix-entry magnitudes at least 10⁻¹².');
}
function validate(plant: Plant): void {
  if (plant.A.length !== 2 || plant.A.some(row => row.length !== 2) || plant.B.length !== 2 || plant.C.length !== 2) throw new Error('Use A with two rows/two columns, B with two rows/one column, and C with one row/two columns.');
  [...plant.A.flat(), ...plant.B, ...plant.C].forEach(coefficient);
  finite(plant.T, 'sample period T in seconds', 0.001, 2);
}

/** Bounded scaling/squaring Taylor exponential of the ZOH augmented matrix.
 * The scaled norm is at most .5; no inverse of A is needed for integrators. */
function exponential(input: number[][]): number[][] {
  const n = input.length, size = norm(input);
  if (size > 40) throw new Error('The ZOH matrix/time scale exceeds 40. Reduce T or rescale the model.');
  const squarings = Math.max(0, Math.ceil(Math.log2(size / 0.5))), divisor = 2 ** squarings;
  const x = input.map(row => row.map(value => value / divisor));
  const identity = () => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Number(i === j)));
  const product = (a: number[][], b: number[][]) => a.map(row => b[0].map((_, j) => row.reduce((sum, value, k) => sum + value * b[k][j], 0)));
  let result = identity(), term = identity(), converged = false;
  for (let j = 1; j <= 32; j++) {
    term = product(term, x).map(row => row.map(value => value / j));
    result = result.map((row, r) => row.map((value, c) => value + term[r][c]));
    if (norm(term) <= 1e-16 * Math.max(1, norm(result))) { converged = true; break; }
  }
  if (!converged) throw new Error('The bounded ZOH series did not converge; change the model scale or T.');
  for (let j = 0; j < squarings; j++) result = product(result, result);
  if (result.flat().some(value => !Number.isFinite(value) || Math.abs(value) > 1e8)) throw new Error('The ZOH model exceeds the numerical range 10⁸; reduce T or rescale.');
  return result;
}
export function discretize(plant: Plant): Model {
  validate(plant);
  const { A, B, C, T } = plant;
  const exp = exponential([[A[0][0] * T, A[0][1] * T, B[0] * T], [A[1][0] * T, A[1][1] * T, B[1] * T], [0, 0, 0]]);
  const Ad: M2 = [v(exp[0][0], exp[0][1]), v(exp[1][0], exp[1][1])], Bd = v(exp[0][2], exp[1][2]);
  const AB = mv(Ad, Bd), W: M2 = [v(Bd[0], AB[0]), v(Bd[1], AB[1])];
  const first = Math.hypot(...Bd), second = Math.hypot(...AB);
  const scaledDeterminant = first && second ? Math.abs(det(W)) / first / second : 0;
  // Relative to the continuous input scale: detect a numerically zero sampled
  // input (e.g. a complete oscillation) without penalizing small input units.
  const inputScale = Math.hypot(...B) * T * Math.max(1, norm(Ad));
  const rank = inputScale === 0 || first <= 1e-12 * inputScale ? 0 : scaledDeterminant <= RANK_TOLERANCE ? 1 : 2;
  return { A: [v(...A[0]), v(...A[1])], B: v(...B), C: v(...C), T, Ad, Bd, W, rank, scaledDeterminant };
}
export function realTargets(first: number, second: number): Targets {
  finite(first, 'first discrete target', -2, 2); finite(second, 'second discrete target', -2, 2);
  return { sum: first + second, product: first * second, poles: [{ re: first, im: 0 }, { re: second, im: 0 }], description: 'Entered discrete poles stay fixed when T changes.', aliasWarning: '' };
}
export function dampingTargets(zeta: number, wn: number, T: number): Targets {
  finite(zeta, 'damping ratio ζ', 0, 3); finite(wn, 'natural frequency ωn in rad/s', 0.01, 100); finite(T, 'sample period T in seconds', 0.001, 2);
  let sum: number, product: number, poles: Pole[], aliasWarning = '';
  if (zeta <= 1) {
    const radius = Math.exp(-zeta * wn * T), angle = wn * Math.sqrt(1 - zeta * zeta) * T;
    if (zeta * wn * T > 20) throw new Error('The mapped target decay exceeds 20 per sample. Choose a smaller T or slower targets.');
    const re = radius * Math.cos(angle), im = radius * Math.sin(angle);
    sum = 2 * re; product = radius * radius; poles = [{ re, im }, { re, im: -im }];
    if (angle > Math.PI) aliasWarning = 'The damped target frequency exceeds π/T. Exponential mapping aliases angle; these sampled poles do not uniquely identify the continuous target.';
  } else {
    const root = Math.sqrt(zeta * zeta - 1), slow = -wn / (zeta + root), fast = -wn * (zeta + root);
    if (-fast * T > 20) throw new Error('The mapped target decay exceeds 20 per sample. Choose a smaller T or slower targets.');
    const first = Math.exp(slow * T), second = Math.exp(fast * T);
    sum = first + second; product = first * second; poles = [{ re: first, im: 0 }, { re: second, im: 0 }];
  }
  return { sum, product, poles, description: 'ζ and ωn stay fixed; s targets are remapped by z=exp(sT) and feedback is redesigned when T changes.', aliasWarning };
}
export function polesOf(sum: number, product: number): Pole[] {
  const discriminant = sum * sum - 4 * product;
  if (discriminant < 0) return [{ re: sum / 2, im: Math.sqrt(-discriminant) / 2 }, { re: sum / 2, im: -Math.sqrt(-discriminant) / 2 }];
  const first = (sum + (sum >= 0 ? 1 : -1) * Math.sqrt(discriminant)) / 2;
  return [{ re: first, im: 0 }, { re: first === 0 ? 0 : product / first, im: 0 }];
}
function solve(matrix: M2, rhs: V2): V2 { const numerator = mv(adj(matrix), rhs), denominator = det(matrix); return v(numerator[0] / denominator, numerator[1] / denominator); }
function trackingGain(model: Model, feedback: Feedback): Tracking {
  const { closed, K } = feedback, { Bd, C } = model;
  const matrix: M2 = [v(1 - closed[0][0], -closed[0][1]), v(-closed[1][0], 1 - closed[1][1])];
  const reciprocalCondition = Math.abs(det(matrix)) / Math.max(Number.MIN_VALUE, norm(matrix) * norm(adj(matrix)));
  if (reciprocalCondition <= 1e-12) return { available: false, reason: 'I−(Ad−BdKd) is singular or too ill-conditioned for this DC tracking solve. A pole at 1 needs separate tracking reasoning.' };
  const steady = solve(matrix, Bd), dc = dot(C, steady), scale = Math.hypot(...C) * Math.hypot(...steady);
  if (!scale || Math.abs(dc) <= 1e-10 * scale) return { available: false, reason: 'The reference-to-output DC gain is zero or numerically canceled. A finite static reference multiplier cannot enforce unity tracking here.' };
  const N = 1 / dc, equilibrium = v(N * steady[0], N * steady[1]);
  if (![N, ...equilibrium].every(value => Number.isFinite(value) && Math.abs(value) <= 1e8)) return { available: false, reason: 'The reference multiplier or unit-reference equilibrium exceeds 10⁸. Rescale the model/output or choose other targets.' };
  const lhs = mv(matrix, equilibrium);
  const residual = Math.max(Math.abs(dot(C, equilibrium) - 1), ...lhs.map((value, i) => Math.abs(value - Bd[i] * N) / (1 + Math.abs(value) + Math.abs(Bd[i] * N))));
  if (residual > RESIDUAL_TOLERANCE) return { available: false, reason: 'The tracking equilibrium residual exceeds 10⁻⁸; the DC gain is not reliable enough to use.' };
  // K is retained in Feedback; no continuous gain is substituted for it.
  if (!K.every(Number.isFinite)) throw new Error('The feedback gain is not finite.');
  return { available: true, N, dc, equilibrium, residual, certified: feedback.stability === 'stable' };
}
export function design(plant: Plant, targets: Targets): Design {
  const model = discretize(plant), result = { model, targets };
  if (![targets.sum, targets.product].every(Number.isFinite) || Math.abs(targets.sum) > 4 || Math.abs(targets.product) > 4) throw new Error('The target polynomial is outside the supported range.');
  if (model.rank !== 2) return { ...result, issue: `The sampled controllability matrix has numerical rank ${model.rank} at relative tolerance 10⁻¹⁰. No unique arbitrary two-pole feedback is computed. Changing T can change sampled controllability.` };
  const { Ad, Bd } = model, originalSum = Ad[0][0] + Ad[1][1], originalProduct = det(Ad), adjAB = mv(adj(Ad), Bd);
  // tr(Ad−BdK)=tr(Ad)−K Bd; det(Ad−BdK)=det(Ad)−K adj(Ad)Bd.
  const matching: M2 = [Bd, adjAB], coefficientRhs = v(originalSum - targets.sum, originalProduct - targets.product);
  const K = solve(matching, coefficientRhs);
  if (!K.every(value => Number.isFinite(value) && Math.abs(value) <= 1e8)) return { ...result, issue: 'Feedback entries exceed 10⁸ or numerical range. Rescale the input/states or choose less demanding poles.' };
  const closed: M2 = [v(Ad[0][0] - Bd[0] * K[0], Ad[0][1] - Bd[0] * K[1]), v(Ad[1][0] - Bd[1] * K[0], Ad[1][1] - Bd[1] * K[1])];
  const sum = closed[0][0] + closed[1][1], product = det(closed);
  const residual = Math.max(Math.abs(sum - targets.sum) / (1 + Math.abs(targets.sum)), Math.abs(product - targets.product) / (1 + Math.abs(targets.product)));
  if (residual > RESIDUAL_TOLERANCE) return { ...result, issue: 'The actual coefficient residual exceeds 10⁻⁸. This feedback calculation is too ill-conditioned to certify.' };
  const conditions = [1 - sum + product, 1 + sum + product, 1 - product], tolerance = 1e-9 * (1 + Math.abs(sum) + Math.abs(product));
  const stability = conditions.every(value => value > tolerance) ? 'stable' : conditions.some(value => value < -tolerance) ? 'unstable' : 'boundary';
  const feedback: Feedback = { K, closed, sum, product, coefficientMatrix: matching, coefficientRhs, poles: polesOf(sum, product), conditions, stability, residual };
  return { ...result, feedback, tracking: trackingGain(model, feedback), issue: '' };
}
/** Eight-step blocks preserve signed transition cancellation before taking
 * absolute bounds. Power-rounding radii and local update errors are retained;
 * using |F| repeatedly would falsely amplify even the stable baseline. */
function allowanceStepper(F: M2, initial: V2): (local: V2) => V2 {
  const round = 64 * Number.EPSILON, absolute: number[][][] = [[[1, 0], [0, 1]]];
  let center = [[1, 0], [0, 1]], radius = [[0, 0], [0, 0]];
  for (let k = 1; k <= 8; k++) {
    const next = [[0, 0], [0, 0]], nextRadius = [[0, 0], [0, 0]];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let l = 0; l < 2; l++) {
      const product = center[i][l] * F[l][j]; next[i][j] += product;
      nextRadius[i][j] += Math.abs(F[l][j]) * radius[i][l] + round * Math.abs(product);
    }
    center = next; radius = nextRadius;
    absolute.push(center.map((row, i) => row.map((value, j) => (Math.abs(value) + radius[i][j]) * (1 + round))));
  }
  let anchor = initial, localErrors: V2[] = [];
  return local => {
    localErrors.push(local); const length = localErrors.length;
    const error = [0, 1].map(i => {
      let sum = absolute[length][i][0] * anchor[0] + absolute[length][i][1] * anchor[1];
      localErrors.forEach((e, j) => { sum += absolute[length - j - 1][i][0] * e[0] + absolute[length - j - 1][i][1] * e[1]; });
      return sum * (1 + round);
    }) as unknown as V2;
    if (length === 8) { anchor = error; localErrors = []; }
    return error;
  };
}

export function simulate(design: Design, initial: V2, reference: number, count: number): Trace {
  if (initial.length !== 2) throw new Error('Enter exactly two initial state coordinates.');
  initial.forEach(value => finite(value, 'initial state coordinates', -100, 100));
  finite(reference, 'constant reference', -10, 10);
  if (!Number.isInteger(count) || count < 10 || count > 2000) throw new Error('Use an integer final sample index N from 10 to 2000.');
  if (!design.feedback) throw new Error(design.issue || 'Calculate valid feedback before simulating.');
  if (reference !== 0 && !design.tracking?.available) throw new Error('A nonzero reference needs a valid tracking multiplier. Use a zero-reference regulator experiment or change the model/targets.');
  const { Ad, Bd, C, T } = design.model, feedback = design.feedback, N = design.tracking?.available ? design.tracking.N : 0;
  const growth = Math.max(0, ...feedback.poles.map(pole => Math.log(Math.hypot(pole.re, pole.im))));
  const round = 64 * Number.EPSILON;
  let allowance = v(round * Math.abs(initial[0]), round * Math.abs(initial[1]));
  const advanceAllowance = allowanceStepper(feedback.closed, allowance);
  let state = v(...initial), warning = '', maxEffort = 0; const samples: Sample[] = [];
  for (let k = 0; k <= count; k++) {
    if (growth * k > 20) { warning = `Stopped before k=${k}: unstable-mode growth exceeds k log|pole|≤20. A finite trace does not certify stability.`; break; }
    const r = reference, y = dot(C, state), u = -dot(feedback.K, state) + N * r;
    if (![...state, y, u].every(value => Number.isFinite(value) && Math.abs(value) <= 1e8)) { warning = `Stopped before k=${k}: a state, output or effort exceeded 10⁸ or numerical range.`; break; }
    const outputAllowance = dot(C.map(Math.abs) as unknown as V2, allowance) + round * (Math.abs(C[0] * state[0]) + Math.abs(C[1] * state[1]));
    const controlLocal = round * (Math.abs(feedback.K[0] * state[0]) + Math.abs(feedback.K[1] * state[1]) + Math.abs(N * r));
    const controlAllowance = dot(feedback.K.map(Math.abs) as unknown as V2, allowance) + controlLocal;
    if (allowance.some((e, i) => !Number.isFinite(e) || e > 1e-8 * Math.max(1, Math.abs(state[i]))) || outputAllowance > 1e-8 * Math.max(1, Math.abs(y)) || controlAllowance > 1e-8 * Math.max(1, Math.abs(u))) {
      warning = `Stopped before k=${k}: roundoff amplification makes state/output/effort numerically unresolved at the 10⁻⁸ relative/absolute trace allowance. Shorten the horizon or rescale the model/initial state.`; break;
    }
    samples.push({ k, t: k * T, x1: state[0], x2: state[1], r, y, u, error: r - y }); maxEffort = Math.max(maxEffort, Math.abs(u));
    const local = [0, 1].map(i => {
      let error = Math.abs(Bd[i]) * controlLocal + round * (Math.abs(Ad[i][0] * state[0]) + Math.abs(Ad[i][1] * state[1]) + Math.abs(Bd[i] * u));
      for (let j = 0; j < 2; j++) error += round * (Math.abs(Ad[i][j]) + Math.abs(Bd[i] * feedback.K[j])) * (Math.abs(state[j]) + allowance[j]);
      return error;
    }) as unknown as V2;
    const drift = mv(Ad, state); state = v(drift[0] + Bd[0] * u, drift[1] + Bd[1] * u);
    allowance = advanceAllowance(local);
  }
  let overshoot: number | undefined, bandEntry: number | undefined;
  if (reference !== 0 && samples.length) {
    overshoot = Math.max(0, ...samples.map(sample => sample.y / reference - 1)) * 100;
    let lastOutside = -1;
    samples.forEach((sample, i) => { if (Math.abs(sample.error) > 0.02 * Math.abs(reference)) lastOutside = i; });
    if (samples.length - 1 - lastOutside >= 10) bandEntry = samples[lastOutside + 1].t;
  }
  return { samples, warning, requested: count, maxEffort, overshoot, bandEntry };
}
export const baseline = (): Plant => ({ A: [v(0, 1), v(-2, -3)], B: v(0, 1), C: v(1, 0), T: 0.1 });
