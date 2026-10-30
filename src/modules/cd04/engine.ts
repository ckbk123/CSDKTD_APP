export interface Complex { re: number; im: number }
export interface Stability { status: 'stable' | 'unstable' | 'boundary'; relativeMargins: number[] }
export interface ResponseModel { model: { closed: number[]; numerator: number[] }; stability: Stability; poles: Complex[] }
export function bound(v: number, min: number, max: number, label: string): number {
  if (!Number.isFinite(v) || v < min || v > max) throw new Error(`${label} must be from ${min} to ${max}.`);
  return v;
}
export function multiply(a: readonly number[], b: readonly number[]): number[] {
  const c = Array<number>(a.length + b.length - 1).fill(0);
  a.forEach((v, i) => b.forEach((w, j) => { c[i + j] += v * w; })); return c;
}
export function routh(c: readonly number[]): Stability {
  if (![3, 4, 5].includes(c.length) || c[0] !== 1 || c.some(v => !Number.isFinite(v))) throw new Error('Routh check requires a finite monic degree 2–4 polynomial.');
  const margins: number[] = c.slice(1).map(v => v > 0 ? 1 : v < 0 ? -1 : 0);
  if (c.length >= 4) {
    const [, a, b, d, e = 0] = c, ab = a * b, delta2 = ab - d;
    margins.push(delta2 / Math.max(Number.MIN_VALUE, Math.abs(ab) + Math.abs(d)));
    if (c.length === 5) {
      const abc = a * b * d, other = d * d + a * a * e;
      margins.push((abc - other) / Math.max(Number.MIN_VALUE, Math.abs(abc) + Math.abs(other)));
    }
  }
  const minimum = Math.min(...margins);
  return { status: minimum < -1e-9 ? 'unstable' : minimum > 1e-9 ? 'stable' : 'boundary', relativeMargins: margins };
}
const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const sub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const mul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const abs = (a: Complex): number => Math.hypot(a.re, a.im);
const div = (a: Complex, b: Complex): Complex => { const d = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }; };
function evaluate(c: readonly number[], z: Complex): Complex { return c.reduce((v, a) => add(mul(v, z), { re: a, im: 0 }), { re: 0, im: 0 }); }
export function residual(c: readonly number[], z: Complex): number {
  const scale = c.reduce((s, v) => s * abs(z) + Math.abs(v), 0); return abs(evaluate(c, z)) / Math.max(Number.MIN_VALUE, scale);
}
/** Scaled degree <=4 Durand–Kerner; certify residual AND reconstructed coefficients
 * so duplicate approximations of a simple root cannot masquerade as all poles.
 * No residue decomposition: repeated/clustered poles do not break the step solver. */
export function poles(c: readonly number[]): Complex[] {
  const n = c.length - 1;
  if (n < 1 || n > 4 || c[0] !== 1 || c.some(v => !Number.isFinite(v) || Math.abs(v) > 1e12)) throw new Error('Pole solver supports finite monic degree 1–4 coefficients, magnitude ≤10¹².');
  if (c[n] === 0 && n > 1) return [...poles(c.slice(0, -1)), { re: 0, im: 0 }];
  if (n === 1) return [{ re: -c[1], im: 0 }];
  if (n === 2) {
    const d = c[1] ** 2 - 4 * c[2];
    if (d < 0) return [{ re: -c[1] / 2, im: Math.sqrt(-d) / 2 }, { re: -c[1] / 2, im: -Math.sqrt(-d) / 2 }];
    const q = -.5 * (c[1] + (c[1] >= 0 ? 1 : -1) * Math.sqrt(d));
    return [{ re: q, im: 0 }, { re: q === 0 ? 0 : c[2] / q, im: 0 }];
  }
  // Exact coefficient identities avoid iterative splitting of repeated poles.
  const repeated = -c[1] / n; let binomial = [1];
  for (let i = 0; i < n; i++) binomial = multiply(binomial, [1, -repeated]);
  if (c.every((v, i) => v === binomial[i])) return Array.from({ length: n }, () => ({ re: repeated, im: 0 }));
  if (n === 4) {
    const b = c[1] / 2, q = [1, b, (c[2] - b * b) / 2], square = multiply(q, q);
    if (c.every((v, i) => v === square[i])) return poles(q).flatMap(z => [{ ...z }, { ...z }]);
  }
  const scale = Math.max(1, ...c.slice(1).map((v, i) => Math.abs(v) ** (1 / (i + 1))));
  const scaled = c.map((v, i) => v / scale ** i), radius = 1 + Math.max(...scaled.slice(1).map(Math.abs));
  let result: Complex[] = [];
  for (const offset of [.17, .53]) {
    result = Array.from({ length: n }, (_, i) => ({ re: radius * Math.cos(2 * Math.PI * (i + offset) / n), im: radius * Math.sin(2 * Math.PI * (i + offset) / n) }));
    for (let iteration = 0; iteration < 500; iteration++) {
      let largest = 0;
      const next = result.map((z, i) => {
        let product: Complex = { re: 1, im: 0 }; result.forEach((w, j) => { if (i !== j) product = mul(product, sub(z, w)); });
        const delta = div(evaluate(scaled, z), product); largest = Math.max(largest, abs(delta)); return sub(z, delta);
      });
      if (next.some(z => !Number.isFinite(z.re) || !Number.isFinite(z.im))) break;
      result = next; if (largest < 1e-12) break;
    }
    let reconstructed: Complex[] = [{ re: 1, im: 0 }], coefficientScale = [1];
    for (const z of result) {
      const next = Array.from({ length: reconstructed.length + 1 }, () => ({ re: 0, im: 0 }));
      reconstructed.forEach((v, i) => { next[i] = add(next[i], v); next[i + 1] = sub(next[i + 1], mul(v, z)); }); reconstructed = next;
      coefficientScale = multiply(coefficientScale, [1, abs(z)]);
    }
    if (result.every(z => residual(scaled, z) < 1e-9) && reconstructed.every((v, i) => abs(sub(v, { re: scaled[i], im: 0 })) < 1e-7 * Math.max(Number.MIN_VALUE, Math.abs(scaled[i]), coefficientScale[i]))) {
      return result.map(z => ({ re: z.re * scale, im: z.im * scale })).sort((a, b) => a.re - b.re || a.im - b.im);
    }
  }
  throw new Error('All poles could not be resolved within the bounded iteration limit. Move the corners away from an ill-conditioned case.');
}
export interface Trace { points: { x: number; y: number }[]; plotHorizon: number; overshoot: number; entry: number | null; endingError: number; iae: number; halfStepDifference: number; steps: number }
/** Full controllable canonical state, time u=S*t. No pole cancellation or
 * simple-root/residue assumption. RK4 at h and h/2; compare every coarse node. */
export function stepTrace(a: ResponseModel, horizon: number, plotWindow = horizon): Trace {
  bound(horizon, .5, 200, 'Response horizon'); bound(plotWindow, .5, 200, 'Response plot window'); const { closed, numerator } = a.model, n = closed.length - 1;
  const scale = Math.max(1, ...closed.slice(1).map((v, i) => Math.abs(v) ** (1 / (i + 1))));
  const den = closed.map((v, i) => v / scale ** i), num = Array<number>(n + 1).fill(0), offset = n + 1 - numerator.length;
  numerator.forEach((v, i) => { num[i + offset] = v / scale ** (i + offset); });
  const steps = Math.max(1200, Math.ceil(horizon * scale / .04));
  if (steps * 2 > 60000) throw new Error('The full response exceeds 60,000 steps per run. Shorten the horizon or reduce the fast corner/gain.');
  const run = (count: number): number[] => {
    const h = horizon * scale / count, values = [0]; let state = Array<number>(n).fill(0);
    const derivative = (x: number[]): number[] => [...x.slice(1), 1 - x.reduce((s, v, i) => s + den[n - i] * v, 0)];
    const shifted = (x: number[], k: number[], factor: number) => x.map((v, i) => v + factor * k[i]);
    for (let i = 0; i < count; i++) {
      const k1 = derivative(state), k2 = derivative(shifted(state, k1, h / 2)), k3 = derivative(shifted(state, k2, h / 2)), k4 = derivative(shifted(state, k3, h));
      state = state.map((v, j) => v + h * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]) / 6);
      const y = state.reduce((s, v, j) => s + num[n - j] * v, 0);
      if (!Number.isFinite(y) || Math.abs(y) > 1000 || state.some(v => !Number.isFinite(v) || Math.abs(v) > 1e12)) throw new Error('The full response grew beyond the bounded numerical range; no settling or requirement pass is claimed.');
      values.push(y);
    }
    return values;
  };
  const coarse = run(steps), fine = run(2 * steps), dt = horizon / (2 * steps);
  let difference = 0, maximum = 0, amplitude = 1, lastOutside = -1, iae = 0;
  fine.forEach((y, i) => {
    maximum = Math.max(maximum, y); amplitude = Math.max(amplitude, Math.abs(y)); if (Math.abs(1 - y) > .02) lastOutside = i;
    if (i) iae += dt * (Math.abs(1 - y) + Math.abs(1 - fine[i - 1])) / 2;
    if (i % 2 === 0) difference = Math.max(difference, Math.abs(y - coarse[i / 2]));
  });
  if (difference > .001 * amplitude) throw new Error('The half-step response check did not converge within 0.1% scaled output tolerance.');
  const candidate = (lastOutside + 1) * dt, tail = a.stability.status === 'stable' ? 1 / Math.min(...a.poles.map(z => -z.re)) : Infinity;
  const plotHorizon = Math.min(horizon, plotWindow), last = Math.min(fine.length - 1, Math.floor(plotHorizon / dt)), stride = Math.ceil((last + 1) / 899);
  const points = fine.slice(0, last + 1).flatMap((y, i) => i % stride === 0 || i === last ? [{ x: i * dt, y }] : []);
  if (points.at(-1)!.x < plotHorizon && last + 1 < fine.length) points.push({ x: plotHorizon, y: fine[last] + (fine[last + 1] - fine[last]) * (plotHorizon / dt - last) });
  return { points, plotHorizon, overshoot: Math.max(0, maximum - 1) * 100, entry: candidate <= horizon && horizon - candidate >= tail ? candidate : null,
    endingError: 1 - fine[fine.length - 1], iae, halfStepDifference: difference, steps: 2 * steps };
}
