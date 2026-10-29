/** Continuous SISO models. Polynomials descend in s; matrix arrays contain rows. */
export type Matrix = readonly (readonly number[])[];
export type Polynomial = readonly number[];
export interface Transfer { readonly numerator: Polynomial; readonly denominator: Polynomial }
export interface StateModel { readonly A: Matrix; readonly B: readonly number[]; readonly C: readonly number[]; readonly D: number }
export interface Sample { readonly t: number; readonly state: readonly number[]; readonly output: number }
export const BASELINE: StateModel = Object.freeze({ A: [[0, 1], [-2, -3]], B: [0, 1], C: [1, 0], D: 0 });
export const MAX_ORDER = 4;
function fail(message: string): never { throw new Error(message); }
function bounded(values: readonly number[], label: string, maximum = 1e12): void {
  if (values.some(value => !Number.isFinite(value) || Math.abs(value) > maximum)) fail(`${label} exceeds the finite numerical range (magnitude ${maximum}).`);
}
export function trim(values: Polynomial): number[] {
  if (!values.length) fail('Enter at least one polynomial coefficient.');
  bounded(values, 'Polynomial');
  let first = 0; while (first < values.length - 1 && values[first] === 0) first++;
  return values.slice(first);
}
export function normalize(transfer: Transfer): Transfer {
  const denominator = trim(transfer.denominator), numerator = trim(transfer.numerator);
  if (denominator[0] === 0) fail('The denominator cannot be the zero polynomial.');
  if (denominator.length - 1 > MAX_ORDER) fail('Use a denominator of order zero through four.');
  if (numerator.length > denominator.length) fail('This transfer is improper. An ordinary standard state realization cannot silently absorb a higher input derivative.');
  const scale = denominator[0];
  const divide = (values: Polynomial) => values.map(value => {
    const next = value / scale;
    if (value !== 0 && next === 0) fail('Normalization underflows a nonzero coefficient.');
    return next;
  });
  const result = { numerator: divide(numerator), denominator: divide(denominator) };
  bounded([...result.numerator, ...result.denominator], 'Normalized coefficients', 1e6);
  return result;
}
export function identity(size: number): number[][] { return Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => Number(i === j))); }
export function norm(matrix: Matrix): number { return Math.max(0, ...matrix.map(row => row.reduce((sum, value) => sum + Math.abs(value), 0))); }
function add(a: Matrix, b: Matrix): number[][] { return a.map((row, i) => row.map((value, j) => value + b[i][j])); }
function scale(a: Matrix, factor: number): number[][] { return a.map(row => row.map(value => value * factor)); }
export function multiply(a: Matrix, b: Matrix): number[][] {
  const rows = a.length, inner = rows ? a[0].length : b.length, columns = b.length ? b[0].length : 0;
  if (b.length !== inner || a.some(row => row.length !== inner) || b.some(row => row.length !== columns)) fail('Matrix multiplication dimensions do not agree.');
  const result = Array.from({ length: rows }, (_, i) => Array.from({ length: columns }, (_, j) => {
    let sum = 0; for (let k = 0; k < inner; k++) sum += a[i][k] * b[k][j]; return sum;
  }));
  bounded(result.flat(), 'Matrix calculation', 1e100); return result;
}
export function vector(matrix: Matrix, values: readonly number[]): number[] {
  if (matrix.some(row => row.length !== values.length)) fail('State vector dimensions do not agree.');
  return matrix.map(row => row.reduce((sum, value, j) => sum + value * values[j], 0));
}
function dot(a: readonly number[], b: readonly number[]): number { return a.reduce((sum, value, i) => sum + value * b[i], 0); }
export function validateModel(model: StateModel): void {
  const n = model.A.length;
  if (n > MAX_ORDER || model.A.some(row => row.length !== n) || model.B.length !== n || model.C.length !== n) fail('Use square A, column B, row C and scalar D, with zero to four states.');
  bounded([...model.A.flat(), ...model.B, ...model.C, model.D], 'State coefficients', 1e6);
}
export function inverse(matrix: Matrix): { matrix: number[][]; condition: number } {
  const n = matrix.length;
  if (n > MAX_ORDER || matrix.some(row => row.length !== n)) fail('The coordinate matrix must be square with the model dimension.');
  bounded(matrix.flat(), 'Coordinate entries', 1e6);
  if (n === 0) return { matrix: [], condition: 1 };
  const magnitude = norm(matrix); if (magnitude === 0) fail('The coordinate matrix is singular.');
  const augmented = matrix.map((row, i) => [...row, ...identity(n)[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col; for (let row = col + 1; row < n; row++) if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col])) pivot = row;
    if (Math.abs(augmented[pivot][col]) <= 1e-12 * magnitude) fail('The coordinate matrix is singular or too close to singular at tolerance 10⁻¹².');
    [augmented[pivot], augmented[col]] = [augmented[col], augmented[pivot]];
    const value = augmented[col][col]; for (let j = 0; j < 2 * n; j++) augmented[col][j] /= value;
    for (let row = 0; row < n; row++) if (row !== col) {
      const factor = augmented[row][col]; for (let j = 0; j < 2 * n; j++) augmented[row][j] -= factor * augmented[col][j];
    }
  }
  const result = augmented.map(row => row.slice(n)), condition = magnitude * norm(result);
  if (!Number.isFinite(condition) || condition > 1e8) fail('The coordinate matrix is too ill-conditioned (infinity-norm condition exceeds 10⁸).');
  return { matrix: result, condition };
}
export function canonical(input: Transfer): StateModel {
  const tf = normalize(input), n = tf.denominator.length - 1, padded = Array(n + 1 - tf.numerator.length).fill(0).concat(tf.numerator) as number[];
  const D = padded[0], C = padded.slice(1).map((value, i) => value - D * tf.denominator[i + 1]).reverse();
  const A = identity(n).map(row => row.map(() => 0));
  for (let i = 0; i < n - 1; i++) A[i][i + 1] = 1;
  if (n) A[n - 1] = tf.denominator.slice(1).map(value => -value).reverse();
  const model = { A, B: Array.from({ length: n }, (_, i) => Number(i === n - 1)), C, D };
  validateModel(model); return model;
}
/** Faddeev identities for det(sI-A) and C adj(sI-A) B + D det(sI-A). No cancellation. */
export function transferOf(model: StateModel): Transfer {
  validateModel(model); const n = model.A.length, denominator = [1], moments: number[] = []; let F = identity(n);
  for (let k = 1; k <= n; k++) {
    moments.push(dot(model.C, vector(F, model.B)));
    const AF = multiply(model.A, F), coefficient = -AF.reduce((sum, row, i) => sum + row[i], 0) / k;
    denominator.push(coefficient); F = add(AF, scale(identity(n), coefficient));
  }
  const numerator = denominator.map((value, i) => model.D * value + (i ? moments[i - 1] : 0));
  bounded([...denominator, ...numerator], 'Recovered transfer coefficients');
  return { numerator: trim(numerator), denominator };
}
export function coordinates(model: StateModel, T: Matrix, initial: readonly number[]): { model: StateModel; initial: number[]; condition: number; residual: number } {
  validateModel(model); const n = model.A.length;
  if (T.length !== n || initial.length !== n) fail('Coordinate and initial-state dimensions must match A.');
  bounded(initial, 'Initial state', 100); const inverted = inverse(T);
  const A = multiply(multiply(T, model.A), inverted.matrix), B = vector(T, model.B), C = n ? multiply([model.C], inverted.matrix)[0] : [];
  const next = { A, B, C, D: model.D }; validateModel(next);
  const left = multiply(A, T), right = multiply(T, model.A), output = n ? multiply([C], T)[0] : [];
  const residual = Math.max(0, ...left.flatMap((row, i) => row.map((value, j) => Math.abs(value - right[i][j]))), ...output.map((value, i) => Math.abs(value - model.C[i])));
  return { model: next, initial: vector(T, initial), condition: inverted.condition, residual };
}
export function observability(model: StateModel): number[][] {
  validateModel(model); const rows: number[][] = []; let row = [...model.C];
  for (let k = 0; k < model.A.length; k++) { rows.push(row); row = multiply([row], model.A)[0]; }
  return rows;
}
export function controllability(model: StateModel): number[][] {
  validateModel(model); const columns: number[][] = []; let column = [...model.B];
  for (let k = 0; k < model.A.length; k++) { columns.push(column); column = vector(model.A, column); }
  return model.A.map((_, i) => columns.map(column => column[i]));
}
export function rank(matrix: Matrix): number {
  if (!matrix.length) return 0;
  const a = matrix.map(row => [...row]), columns = a[0].length, tolerance = 1e-12 * norm(a); let result = 0;
  for (let j = 0; j < columns && result < a.length; j++) {
    let pivot = result; for (let i = result + 1; i < a.length; i++) if (Math.abs(a[i][j]) > Math.abs(a[pivot][j])) pivot = i;
    if (Math.abs(a[pivot][j]) <= tolerance) continue;
    [a[pivot], a[result]] = [a[result], a[pivot]];
    for (let i = result + 1; i < a.length; i++) { const factor = a[i][j] / a[result][j]; for (let k = j; k < columns; k++) a[i][k] -= factor * a[result][k]; }
    result++;
  }
  return result;
}
export function physical(model: StateModel, initial: readonly number[]): ReturnType<typeof coordinates> & { T: Matrix } {
  const T = observability(model); return { ...coordinates(model, T, initial), T };
}
function convolution(a: Polynomial, b: Polynomial): number[] {
  const result = Array(a.length + b.length - 1).fill(0) as number[];
  a.forEach((x, i) => b.forEach((y, j) => { result[i + j] += x * y; })); return result;
}
export function equivalence(first: Transfer, second: Transfer): { matches: boolean; residual: number } {
  const a = convolution(first.numerator, second.denominator), b = convolution(second.numerator, first.denominator), length = Math.max(a.length, b.length);
  while (a.length < length) a.unshift(0); while (b.length < length) b.unshift(0);
  bounded([...a, ...b], 'Equivalence comparison', 1e30);
  const residual = Math.max(0, ...a.map((value, i) => Math.abs(value - b[i]))) / Math.max(1, ...a.map(Math.abs), ...b.map(Math.abs));
  return { matches: residual <= 1e-8, residual };
}
function exponential(matrix: Matrix): number[][] {
  const n = matrix.length, magnitude = norm(matrix), squarings = Math.max(0, Math.ceil(Math.log2(magnitude / .5)));
  if (!Number.isFinite(magnitude) || squarings > 36) fail('The coefficient/time scale exceeds the bounded trajectory calculation.');
  const reduced = scale(matrix, 2 ** -squarings); let result = identity(n), term = identity(n);
  for (let k = 1; k <= 26; k++) { term = scale(multiply(term, reduced), 1 / k); result = add(result, term); }
  for (let k = 0; k < squarings; k++) result = multiply(result, result);
  return result;
}
export function at(model: StateModel, initial: readonly number[], command: number, time: number): Sample {
  validateModel(model); const n = model.A.length;
  if (initial.length !== n) fail('Enter one initial value per state.');
  bounded(initial, 'Initial state', 1e10); bounded([command], 'Constant command', 100);
  if (!Number.isFinite(time) || time < 0 || time > 20) fail('Inspect a time from 0 to 20 seconds.');
  const augmented = model.A.map((row, i) => [...row, model.B[i] * command]); augmented.push(Array(n + 1).fill(0) as number[]);
  const e = exponential(scale(augmented, time)), state = vector(e, [...initial, 1]).slice(0, n), output = dot(model.C, state) + model.D * command;
  bounded([...state, output], 'Trajectory', 1e10); return { t: time, state, output };
}
export function samples(model: StateModel, initial: readonly number[], command: number, horizon: number, count = 201): Sample[] {
  if (!Number.isFinite(horizon) || horizon < .001 || horizon > 20 || !Number.isInteger(count) || count < 2 || count > 401) fail('Use a 0.001–20 s horizon and 2–401 samples.');
  return Array.from({ length: count }, (_, i) => at(model, initial, command, horizon * i / (count - 1)));
}
export function formatNumber(value: number): string { return Number(value.toPrecision(7)).toString(); }
export function latexNumber(value: number): string { return formatNumber(value).replace(/e([+-]?\d+)$/, (_, exponent: string) => `\\times10^{${Number(exponent)}}`); }
export function matrixLatex(matrix: Matrix): string { return matrix.length ? `\\begin{bmatrix}${matrix.map(row => row.map(latexNumber).join('&')).join('\\\\')}\\end{bmatrix}` : '\\varnothing'; }
export function polynomialLatex(coefficients: Polynomial): string {
  const terms = coefficients.flatMap((coefficient, i) => {
    if (coefficient === 0) return []; const power = coefficients.length - 1 - i, magnitude = Math.abs(coefficient);
    return [{ negative: coefficient < 0, body: `${power && magnitude === 1 ? '' : latexNumber(magnitude)}${power ? power === 1 ? 's' : `s^{${power}}` : ''}` }];
  });
  return terms.length ? terms.map((term, i) => `${term.negative ? '-' : i ? '+' : ''}${term.body}`).join('') : '0';
}
export function transferLatex(tf: Transfer): string { return `G(s)=\\frac{${polynomialLatex(tf.numerator)}}{${polynomialLatex(tf.denominator)}}`; }
