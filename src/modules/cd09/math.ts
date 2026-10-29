export type Vector = readonly [number, number];
export type Matrix = readonly [number, number, number, number];
export type Complex = readonly [number, number];
export interface Observer {
  A: Matrix; C: Vector; target: Vector; L: Vector; closed: Matrix;
  observability: Matrix; scaledDet: number; matching: Matrix; rhs: Vector;
  actual: Vector; poles: readonly Complex[]; residual: number;
}
export interface Feedback {
  A: Matrix; B: Vector; C: Vector; K: Vector; closed: Matrix;
  target: Vector; actual: Vector; poles: readonly Complex[]; residual: number;
  dcGain: number | null; prefilter: number | null;
}
export interface Options {
  initial: Vector; estimate: Vector; heldInput: number; reference: number;
  noiseAmplitude: number; noiseFrequency: number; noisePhase: number;
  filterTau: number; horizon: number; count?: number;
}
export interface Sample {
  t: number; x: Vector; estimate: Vector; error: Vector;
  cleanOutput: number; measuredOutput: number; estimatedOutput: number;
  noise: number; innovation: number; injection: number; effort: number;
}
export interface Run {
  samples: Sample[]; errorMatrix: readonly number[]; errorPolynomial: readonly number[];
  errorPoles: readonly Complex[]; plantPoles: readonly Complex[]; allPoles: readonly Complex[];
  errorStability: 'stable' | 'unstable' | 'near boundary';
  referenceGain: number; step: number; coarse: boolean; rmsError: Vector; peakEffort: number;
}
const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1];
const transpose = (a: Matrix): Matrix => [a[0], a[2], a[1], a[3]];
const determinant = (a: Matrix) => a[0] * a[3] - a[1] * a[2];
function bounded(values: readonly number[], size: number, bound: number, label: string): void {
  if (values.length !== size || values.some(v => !Number.isFinite(v) || Math.abs(v) > bound)) {
    throw new Error(`${label} needs ${size} finite entries, each with magnitude at most ${bound}.`);
  }
}
export function characteristic(a: Matrix): Vector { return [-(a[0] + a[3]), determinant(a)]; }
export function quadratic([b, c]: Vector): Complex[] {
  const d = b * b - 4 * c;
  if (d < 0) return [[-b / 2, Math.sqrt(-d) / 2], [-b / 2, -Math.sqrt(-d) / 2]];
  const q = -.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(d));
  if (q !== 0 && c !== 0 && c / q === 0) throw new Error('A pole is too small to represent; rescale the model or target.');
  return q === 0 ? [[0, 0], [0, 0]] : [[q, 0], [c / q, 0]];
}
function scaledDet(a: Matrix): number {
  const n1 = Math.hypot(a[0], a[1]), n2 = Math.hypot(a[2], a[3]);
  return n1 && n2 ? a[0] / n1 * (a[3] / n2) - a[1] / n1 * (a[2] / n2) : 0;
}
function solve(a: Matrix, b: Vector): Vector {
  const n1 = Math.hypot(a[0], a[1]), n2 = Math.hypot(a[2], a[3]);
  const d = scaledDet(a);
  if (!n1 || !n2 || Math.abs(d) <= 1e-9) throw new Error('Matching equations are singular or poorly conditioned at scaled tolerance 10⁻⁹.');
  return [(b[0] / n1 * (a[3] / n2) - a[1] / n1 * (b[1] / n2)) / d,
    (a[0] / n1 * (b[1] / n2) - b[0] / n1 * (a[2] / n2)) / d];
}
function place(A: Matrix, C: Vector, target: Vector, kind: 'Observability' | 'Controllability'): Observer {
  bounded(A, 4, 1000, 'A'); bounded(C, 2, 1000, 'Sensor/input'); bounded(target, 2, 10000, 'Target coefficients');
  if (target.some(v => v <= 0)) throw new Error('Use a strictly Hurwitz real monic quadratic: both target coefficients must be positive.');
  const CA: Vector = [C[0] * A[0] + C[1] * A[2], C[0] * A[1] + C[1] * A[3]];
  const observability: Matrix = [C[0], C[1], CA[0], CA[1]], rankDet = scaledDet(observability);
  if (Math.abs(rankDet) <= 1e-9) throw new Error(`${kind} rank is below 2 at the declared scaled tolerance 10⁻⁹. Arbitrary two-pole placement is unavailable.`);
  const matching: Matrix = [C[0], C[1], C[0] * A[3] - C[1] * A[2], -C[0] * A[1] + C[1] * A[0]];
  const rhs: Vector = [A[0] + A[3] + target[0], determinant(A) - target[1]], L = solve(matching, rhs);
  bounded(L, 2, 1e6, 'Gain');
  const closed: Matrix = [A[0] - L[0] * C[0], A[1] - L[0] * C[1], A[2] - L[1] * C[0], A[3] - L[1] * C[1]];
  bounded(closed, 4, 10000, 'Closed matrix');
  const actual = characteristic(closed), residual = Math.max(...actual.map((v, i) => Math.abs(v - target[i]) / target[i]));
  if (!Number.isFinite(residual) || residual > 1e-9 || actual.some(v => v <= 0)) throw new Error('Coefficient verification lost accuracy; choose less extreme targets or rescale the model.');
  return { A: [...A], C: [...C], target: [...target], L, closed, observability, scaledDet: rankDet, matching, rhs, actual, poles: quadratic(actual), residual };
}
export function designObserver(A: Matrix, C: Vector, target: Vector): Observer { return place(A, C, target, 'Observability'); }
export function designFeedback(A: Matrix, B: Vector, C: Vector, target: Vector): Feedback {
  bounded(C, 2, 1000, 'C');
  const dual = place(transpose(A), B, target, 'Controllability'), closed = transpose(dual.closed);
  let dcGain: number | null = null, prefilter: number | null = null;
  try {
    const invB = solve(closed, B), dcScale = Math.hypot(...C) * Math.hypot(...invB), gain = -dot(C, invB), candidate = 1 / gain;
    if (Number.isFinite(gain) && Number.isFinite(dcScale)) {
      dcGain = gain;
      if (dcScale > 0 && Math.abs(gain) > 1e-10 * dcScale && Number.isFinite(candidate) && Math.abs(candidate) <= 1e6) prefilter = candidate;
    }
  } catch { /* A poorly conditioned DC solve does not invalidate the checked K. */ }
  return { A: [...A], B: [...B], C: [...C], K: dual.L, closed, target: [...target], actual: dual.actual, poles: dual.poles, residual: dual.residual, dcGain, prefilter };
}
export function characteristic3(m: readonly number[]): [number, number, number] {
  if (m.length !== 9 || m.some(v => !Number.isFinite(v))) throw new Error('Use a finite 3 by 3 error/filter matrix.');
  const [a, b, c, d, e, f, g, h, i] = m;
  return [-(a + e + i), a * e - b * d + a * i - c * g + e * i - f * h,
    -(a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g))];
}
const complexMultiply = ([a, b]: Complex, [c, d]: Complex): Complex => [a * c - b * d, a * d + b * c];
/** Analytic cubic roots, followed by independent backward/multiplicity checks. */
export function cubic(coefficients: readonly number[]): Complex[] {
  bounded(coefficients, 3, 1e15, 'Cubic coefficients');
  const scale = Math.max(1, Math.abs(coefficients[0]), Math.sqrt(Math.abs(coefficients[1])), Math.cbrt(Math.abs(coefficients[2])));
  const [b, c, d] = coefficients.map((v, i) => v / scale ** (i + 1));
  const p = c - b * b / 3, q = 2 * b ** 3 / 27 - b * c / 3 + d, delta = (q / 2) ** 2 + (p / 3) ** 3;
  let roots: Complex[];
  if (delta >= 0) {
    const u = Math.cbrt(-q / 2 + Math.sqrt(delta));
    const v = Math.abs(u) > 1e-15 ? -p / (3 * u) : Math.cbrt(-q / 2 - Math.sqrt(delta));
    const sum = u + v, imaginary = Math.sqrt(3) / 2 * (u - v);
    roots = [[sum - b / 3, 0], [-sum / 2 - b / 3, imaginary], [-sum / 2 - b / 3, -imaginary]];
  } else {
    if (p >= 0) throw new Error('Cubic mode calculation lost accuracy. Rescale the model or filter.');
    const angle = Math.acos(Math.max(-1, Math.min(1, -q / (2 * Math.sqrt(-((p / 3) ** 3)))))) / 3;
    roots = [0, 1, 2].map(k => [2 * Math.sqrt(-p / 3) * Math.cos(angle - 2 * Math.PI * k / 3) - b / 3, 0]);
  }
  for (const root of roots) {
    let value: Complex = [1, 0];
    for (const coefficient of [b, c, d]) { const next = complexMultiply(value, root); value = [next[0] + coefficient, next[1]]; }
    const magnitude = Math.hypot(...root), normalizer = magnitude ** 3 + Math.abs(b) * magnitude ** 2 + Math.abs(c) * magnitude + Math.abs(d);
    if (!value.every(Number.isFinite) || Math.hypot(...value) > 1e-9 * normalizer) throw new Error('Cubic mode residual lost accuracy. Rescale the model or filter.');
  }
  let reconstruction: Complex[] = [[1, 0]];
  for (const root of roots) {
    const next: Complex[] = Array.from({ length: reconstruction.length + 1 }, () => [0, 0]);
    reconstruction.forEach((coefficient, i) => {
      next[i] = [next[i][0] + coefficient[0], next[i][1] + coefficient[1]];
      const product = complexMultiply(coefficient, root);
      next[i + 1] = [next[i + 1][0] - product[0], next[i + 1][1] - product[1]];
    }); reconstruction = next;
  }
  if (reconstruction.some(([re, im], i) => Math.hypot(re - [1, b, c, d][i], im) > 1e-8)) throw new Error('Complete cubic mode verification lost accuracy.');
  return roots.map(([re, im]) => [re * scale, im * scale]);
}
function multiply(a: number[], b: number[], n: number): number[] {
  const result = Array(n * n).fill(0) as number[];
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) result[i * n + j] += a[i * n + k] * b[k * n + j];
  if (result.some(v => !Number.isFinite(v))) throw new Error('Numerical transition overflowed. Shorten the horizon or rescale the model.');
  return result;
}
const matrixNorm = (m: number[], n: number) => Math.max(...Array.from({ length: n }, (_, i) => m.slice(i * n, (i + 1) * n).reduce((s, v) => s + Math.abs(v), 0)));
function exponential(m: number[], n: number): number[] {
  const norm = matrixNorm(m, n), scaling = norm > .5 ? Math.ceil(Math.log2(norm / .5)) : 0;
  if (!Number.isFinite(norm) || scaling > 30) throw new Error('Transition exceeds 30 scaling steps. Shorten the horizon or rescale the model.');
  const reduced = m.map(v => v / 2 ** scaling), identity: number[] = Array.from({ length: n * n }, (_, k) => Math.floor(k / n) === k % n ? 1 : 0);
  let result = [...identity], term = [...identity], converged = false;
  for (let k = 1; k <= 24; k++) {
    term = multiply(term, reduced, n).map(v => v / k); result = result.map((v, i) => v + term[i]);
    if (matrixNorm(term, n) <= 1e-16) { converged = true; break; }
  }
  if (!converged) throw new Error('Matrix exponential did not converge in 24 terms.');
  for (let k = 0; k < scaling; k++) result = multiply(result, result, n);
  return result;
}
export function simulate(observer: Observer, B: Vector, options: Options, feedback?: Feedback): Run {
  bounded(B, 2, 1000, 'B'); bounded(options.initial, 2, 100, 'Initial state'); bounded(options.estimate, 2, 100, 'Initial estimate');
  bounded([options.heldInput, options.reference, options.noiseAmplitude, options.noiseFrequency, options.noisePhase], 5, 100, 'Input/reference/noise controls');
  const { A, C, L } = observer, { filterTau: tau, horizon } = options, count = options.count ?? 401;
  if (!Number.isFinite(tau) || tau < 0 || tau > 10 || (tau > 0 && tau < .001)) throw new Error('Innovation-filter time must be 0 (off) or 0.001–10 seconds.');
  if (!Number.isFinite(horizon) || horizon < .1 || horizon > 50 || !Number.isInteger(count) || count < 2 || count > 1001) throw new Error('Use a 0.1–50 second horizon and 2–1,001 samples.');
  if (options.noiseAmplitude < 0 || options.noiseFrequency < 0) throw new Error('Noise amplitude and frequency must be nonnegative.');
  if (feedback && ([...A, ...B, ...C].some((v, i) => v !== [...feedback.A, ...feedback.B, ...feedback.C][i]))) throw new Error('The feedback and observer must use the same plant model.');
  const K: Vector = feedback?.K ?? [0, 0], referenceGain = feedback?.prefilter ?? 1;
  const filtered = tau > 0, n = filtered ? 8 : 7, f = filtered ? 4 : -1, noise = filtered ? 5 : 4, held = n - 1;
  const g = Array(n * n).fill(0) as number[], put = (row: number, col: number, value: number) => { g[row * n + col] += value; };
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      put(i, j, A[i * 2 + j]); put(i, j + 2, -B[i] * K[j]);
      put(i + 2, j + 2, A[i * 2 + j] - B[i] * K[j]);
      if (!filtered) { put(i + 2, j, L[i] * C[j]); put(i + 2, j + 2, -L[i] * C[j]); }
    }
    put(i, held, B[i]); put(i + 2, held, B[i]);
    put(i + 2, filtered ? f : noise, L[i]);
  }
  if (filtered) { for (let j = 0; j < 2; j++) { put(f, j, C[j] / tau); put(f, j + 2, -C[j] / tau); } put(f, f, -1 / tau); put(f, noise, 1 / tau); }
  put(noise, noise + 1, options.noiseFrequency); put(noise + 1, noise, -options.noiseFrequency);
  const errorMatrix = filtered ? [A[0], A[1], -L[0], A[2], A[3], -L[1], C[0] / tau, C[1] / tau, -1 / tau] : [...observer.closed];
  const errorPolynomial = filtered ? characteristic3(errorMatrix) : [...observer.actual];
  const errorPoles = filtered ? cubic(errorPolynomial) : [...observer.poles], plantPoles = feedback?.poles ?? quadratic(characteristic(A));
  const scale = Math.max(1, ...errorPoles.map(p => Math.hypot(...p))), tolerance = 1e-9 * scale;
  const errorStability = errorPoles.every(([re]) => re < -tolerance) ? 'stable' : errorPoles.some(([re]) => re > tolerance) ? 'unstable' : 'near boundary';
  const step = horizon / (count - 1), transition = exponential(g.map(v => v * step), n);
  const wave0 = options.noiseAmplitude * Math.sin(options.noisePhase), wave1 = options.noiseAmplitude * Math.cos(options.noisePhase);
  let state = [...options.initial, ...options.estimate, ...(filtered ? [dot(C, [options.initial[0] - options.estimate[0], options.initial[1] - options.estimate[1]]) + wave0] : []), wave0, wave1,
    feedback ? referenceGain * options.reference : options.heldInput];
  const samples: Sample[] = [], squaredError: [number, number] = [0, 0]; let peakEffort = 0;
  for (let k = 0; k < count; k++) {
    const x: Vector = [state[0], state[1]], estimate: Vector = [state[2], state[3]], error: Vector = [x[0] - estimate[0], x[1] - estimate[1]];
    const cleanOutput = dot(C, x), measuredOutput = cleanOutput + state[noise], estimatedOutput = dot(C, estimate), innovation = measuredOutput - estimatedOutput;
    const effort = state[held] - dot(K, estimate), injection = filtered ? state[f] : innovation;
    if ([...state, ...error, cleanOutput, measuredOutput, estimatedOutput, innovation, effort, injection].some(v => !Number.isFinite(v) || Math.abs(v) > 1e8)) throw new Error('Response leaves the finite magnitude limit 10⁸. Shorten the horizon or reduce the input/model scale.');
    samples.push({ t: k * step, x, estimate, error, cleanOutput, measuredOutput, estimatedOutput, noise: state[noise], innovation, injection, effort });
    squaredError[0] += error[0] ** 2; squaredError[1] += error[1] ** 2; peakEffort = Math.max(peakEffort, Math.abs(effort));
    if (k < count - 1) state = Array.from({ length: n }, (_, i) => state.reduce((sum, v, j) => sum + transition[i * n + j] * v, 0));
  }
  const allPoles = [...plantPoles, ...errorPoles], fastest = Math.max(options.noiseFrequency, ...allPoles.map(p => Math.hypot(...p)));
  return { samples, errorMatrix, errorPolynomial, errorPoles, plantPoles, allPoles, errorStability, referenceGain, step, coarse: step * fastest > .25, rmsError: [Math.sqrt(squaredError[0] / count), Math.sqrt(squaredError[1] / count)], peakEffort };
}
