export type Matrix = number[][];
export interface Model { A: Matrix; B: number[]; C: number[]; D: number }
export interface Experiment { horizon: number; count: number; input: number; initial1: number[]; initial2: number[] }
export interface Point {
  t: number; phi: Matrix; integral: number[]; free1: number[]; free2: number[]; forced: number[];
  total1: number[]; total2: number[]; difference: number[]; yFree1: number; yFree2: number; yForced: number; y1: number; y2: number;
}
export interface Mode { real: number; imag: number }
export interface Transfer { numerator: number[]; denominator: number[]; reducedNumerator: number[]; reducedDenominator: number[]; cancellations: number }
export interface Result { points: Point[]; modes: Mode[]; transfer: Transfer; warning: string }
const fail = (text: string): never => { throw new Error(text); };
const identity = (n: number): Matrix => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
const norm = (a: Matrix): number => Math.max(...a.map(row => row.reduce((s, x) => s + Math.abs(x), 0)));
const scale = (a: Matrix, v: number): Matrix => a.map(row => row.map(x => x * v));
const add = (a: Matrix, b: Matrix): Matrix => a.map((row, i) => row.map((x, j) => x + b[i][j]));
const mul = (a: Matrix, b: Matrix): Matrix => a.map(row => b[0].map((_, j) => row.reduce((s, x, k) => s + x * b[k][j], 0)));
export const mv = (a: Matrix, x: number[]): number[] => a.map(row => row.reduce((s, v, i) => s + v * x[i], 0));
export const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * b[i], 0);

/** Numerical exponential: size1–3, infinity norm≤64, scaled Taylor series. */
export function matrixExp(a: Matrix): Matrix {
  const n = a.length;
  if (n < 1 || n > 3 || a.some(row => row.length !== n || row.some(x => !Number.isFinite(x)))) fail('Use a finite square exponential matrix of size 1–3.');
  const size = norm(a);
  if (size > 64) fail('The horizon matrix norm exceeds 64. Shorten the horizon or rescale the state coordinates/input gains.');
  const squarings = Math.max(0, Math.ceil(Math.log2(size / 0.5))), small = scale(a, 2 ** -squarings);
  let out = identity(n), term = identity(n), converged = false;
  for (let k = 1; k <= 64; k++) {
    term = scale(mul(term, small), 1 / k); out = add(out, term);
    if (norm(term) <= 2e-16 * Math.max(1, norm(out))) { converged = true; break; }
  }
  if (!converged) fail('The exponential did not converge within 64 terms. Shorten the horizon.');
  for (let i = 0; i < squarings; i++) out = mul(out, out);
  if (out.some(row => row.some(x => !Number.isFinite(x)))) fail('The exponential exceeded numeric range.');
  return out;
}

export function validateModel(m: Model): void {
  const n = m.A.length;
  if (![1, 2].includes(n) || m.A.some(row => row.length !== n) || m.B.length !== n || m.C.length !== n) fail('Use A of size n×n, B of size n×1 and C of size 1×n, with n=1 or 2.');
  if (![...m.A.flat(), ...m.B, ...m.C, m.D].every(x => Number.isFinite(x) && Math.abs(x) <= 1e4)) fail('All model entries must be finite with magnitude at most 10⁴.');
}

export function modes(m: Model): Mode[] {
  validateModel(m);
  if (m.A.length === 1) return [{ real: m.A[0][0], imag: 0 }];
  const [[a, b], [c, d]] = m.A, trace = a + d, det = a * d - b * c, discriminant = (a - d) ** 2 + 4 * b * c;
  if (discriminant < 0) return [{ real: trace / 2, imag: Math.sqrt(-discriminant) / 2 }, { real: trace / 2, imag: -Math.sqrt(-discriminant) / 2 }];
  const q = (trace + (trace < 0 ? -1 : 1) * Math.sqrt(discriminant)) / 2;
  return q === 0 ? [{ real: 0, imag: 0 }, { real: 0, imag: 0 }] : [{ real: q, imag: 0 }, { real: det / q, imag: 0 }];
}

/** Retain the characteristic polynomial even when a scalar channel cancels it.
 * Only EXACT floating coefficient identities are reduced; near cancellation is
 * deliberately retained rather than being declared a hidden mode. */
export function transfer(m: Model): Transfer {
  validateModel(m);
  let denominator: number[], numerator: number[];
  if (m.A.length === 1) { denominator = [1, -m.A[0][0]]; numerator = [m.D, m.C[0] * m.B[0] - m.D * m.A[0][0]]; }
  else {
    const [[a, b], [c, d]] = m.A;
    denominator = [1, -a - d, a * d - b * c];
    numerator = [m.D, m.D * denominator[1] + dot(m.C, m.B),
      m.D * denominator[2] + m.C[0] * (-d * m.B[0] + b * m.B[1]) + m.C[1] * (c * m.B[0] - a * m.B[1])];
  }
  const trim = (p: number[]): number[] => { while (p.length > 1 && p[0] === 0) p.shift(); return p; };
  let rn = trim([...numerator]), rd = [...denominator], cancellations = 0;
  if (rn.every(x => x === 0)) { cancellations = rd.length - 1; rn = [0]; rd = [1]; }
  else {
    // A constant multiple of the denominator cancels all dynamic factors,
    // including a complex pair, with an exact coefficient identity.
    if (rn.length === rd.length && rn.every((v, i) => v === rn[0] * rd[i])) {
      cancellations = rd.length - 1; rn = [rn[0]]; rd = [1];
    } else for (const mode of modes(m)) {
      if (mode.imag !== 0 || rd.length < 2 || rn.length < 2) continue;
      const divide = (p: number[]): number[] | undefined => {
        const q = [p[0]];
        for (let i = 1; i < p.length - 1; i++) q.push(p[i] + mode.real * q[i - 1]);
        return p.at(-1)! + mode.real * q.at(-1)! === 0 ? q : undefined;
      };
      const n = divide(rn), d = divide(rd);
      if (n && d) { rn = trim(n); rd = d; cancellations++; }
    }
  }
  return { numerator, denominator, reducedNumerator: rn, reducedDenominator: rd, cancellations };
}

function check(x: number[], label: string): void {
  if (x.some(v => !Number.isFinite(v) || Math.abs(v) > 1e10)) fail(label + ' exceeds magnitude 10¹⁰. Shorten the horizon or reduce input/initial states.');
}

/** Continuous constant-input solution, evaluated independently at each t.
 * Augmentation provides ∫exp(Aτ)B dτ without inverse(A), including singular A. */
function point(m: Model, e: Experiment, t: number): Point {
  const n = m.A.length;
  const augmented = m.A.map((row, i) => [...row, m.B[i]]).concat([Array(n + 1).fill(0) as number[]]);
  const exp = matrixExp(scale(augmented, t)), phi = exp.slice(0, n).map(row => row.slice(0, n)), integral = exp.slice(0, n).map(row => row[n]);
  const free1 = mv(phi, e.initial1), free2 = mv(phi, e.initial2), forced = integral.map(v => v * e.input);
  const total1 = free1.map((v, i) => v + forced[i]), total2 = free2.map((v, i) => v + forced[i]);
  const difference = mv(phi, e.initial2.map((v, i) => v - e.initial1[i]));
  const yFree1 = dot(m.C, free1), yFree2 = dot(m.C, free2), yForced = dot(m.C, forced) + m.D * e.input;
  const y1 = yFree1 + yForced, y2 = yFree2 + yForced;
  check([...free1, ...free2, ...forced, ...total1, ...total2, ...difference, yFree1, yFree2, yForced, y1, y2], 'The computed state/output');
  return { t, phi, integral, free1, free2, forced, total1, total2, difference, yFree1, yFree2, yForced, y1, y2 };
}

export function run(m: Model, e: Experiment): Result {
  validateModel(m); const n = m.A.length;
  if (!Number.isFinite(e.horizon) || e.horizon < 0.01 || e.horizon > 10) fail('Choose a horizon from 0.01 to 10 seconds.');
  if (!Number.isInteger(e.count) || e.count < 21 || e.count > 401) fail('Choose an integer from 21 to 401 drawing points.');
  if (e.initial1.length !== n || e.initial2.length !== n || ![e.input, ...e.initial1, ...e.initial2].every(x => Number.isFinite(x) && Math.abs(x) <= 1e4)) fail('Provide two finite initial vectors of length n; input/initial magnitudes must be at most 10⁴.');
  const spectrum = modes(m), rate = Math.max(...spectrum.map(v => Math.hypot(v.real, v.imag)));
  const points = Array.from({ length: e.count }, (_, k) => point(m, e, e.horizon * k / (e.count - 1)));
  return { points, modes: spectrum, transfer: transfer(m), warning: rate * e.horizon / (e.count - 1) > 0.5 ? 'The drawing grid is coarse relative to pole time scales. Increase drawing points; this is not a continuous peak calculation.' : '' };
}

export function derivative(m: Model, x: number[], u: number): number[] { return mv(m.A, x).map((v, i) => v + m.B[i] * u); }
export const fmt = (x: number): string => x === 0 ? '0' : Number(x.toPrecision(7)).toString();
export function tex(x: number): string {
  const [a, b] = fmt(x).split('e'); return b === undefined ? a : a + '\\times10^{' + Number(b) + '}';
}
export const matrixTex = (a: Matrix): string => '\\begin{bmatrix}' + a.map(row => row.map(tex).join('&')).join('\\\\') + '\\end{bmatrix}';
export const polynomialTex = (p: number[]): string => p.map((v, i) => '(' + tex(v) + ')' + (i < p.length - 1 ? 's^{' + (p.length - 1 - i) + '}' : '')).join('+');
