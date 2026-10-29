import { add, decimal, isZero, minus, multiply, neg, numeric, one, over, rat, times, trim, validatePolynomial, zero, type Poly } from './exact';
import { applyM, exponential, multiplyM, normM, tailCertificate, type Matrix } from './linear';
import { divC, norm, positiveRoots, roots, valueC, type Complex, type Root } from './spectral';
export interface Loop { readonly n: Poly; readonly d: Poly; readonly characteristic: Poly; readonly poles: readonly Root[]; readonly zeros: readonly Root[]; readonly openPoles: readonly Root[]; readonly stable: boolean }
const normalized = (p: Poly, lead: Poly[number]) => p.map(c => over(c, lead));
/** Negative unity feedback; keep original denominator factors in D+N. */
export function createLoop(n: Poly, d: Poly, gain = 1, addedPole?: number): Loop {
  n = validatePolynomial(n, true); d = validatePolynomial(d);
  if (d.length < 2 || d.length > 5 || n.length >= d.length) throw new Error('Use a strictly proper real rational loop, denominator degree1–4 and numerator degree below it.');
  if (!Number.isFinite(gain) || gain <= 0 || gain > 1000) throw new Error('Choose a gain multiplier greater than0 and at most1000.');
  const k = decimal(String(gain), true); n = n.map(c => times(c, k));
  if (addedPole !== undefined) {
    if (!Number.isFinite(addedPole) || addedPole < .01 || addedPole > 100 || d.length > 4) throw new Error('An added pole needs rate0.01–100s⁻¹ and an original denominator of degree at most3.');
    const a = decimal(String(addedPole), true); n = n.map(c => times(c, a)); d = multiply(d, [a, one]);
  }
  const lead = d.at(-1)!; n = normalized(n, lead); d = normalized(d, lead);
  const characteristic = add(d, n); if ([...n, ...d, ...characteristic].some(c => Math.abs(numeric(c)) > 1e6)) throw new Error('Normalized model coefficients must not exceed1,000,000.');
  return { n, d, characteristic, poles: roots(characteristic), zeros: isZero(n) ? [] : roots(n), openPoles: roots(d), stable: hurwitz(characteristic) };
}
/** Exact strict Hurwitz inequalities through degree4. No numerical sign tolerance. */
export function hurwitz(p: Poly): boolean {
  p = normalized(p, p.at(-1)!); const n = p.length - 1;
  if (n < 1 || n > 4) throw new Error('Strict stability test supports degree1–4.');
  if (p.some(c => c.n <= 0n)) return false;
  if (n <= 2) return true;
  const determinant2 = minus(times(p[n - 1], p[n - 2]), p[n - 3]); if (determinant2.n <= 0n) return false;
  return n === 3 || minus(times(p[1], determinant2), times(times(p[3], p[3]), p[0])).n > 0n;
}
export function frequency(n: Poly, d: Poly, omega: number): Complex | undefined {
  const z = { re: 0, im: omega }, denominator = valueC(d, z), scale = d.reduceRight((v, c) => v * Math.abs(omega) + Math.abs(numeric(c)), 0);
  if (norm(denominator) <= 1e-10 * scale) return; const result = divC(valueC(n, z), denominator); return Number.isFinite(norm(result)) ? result : undefined;
}
export function magnitudeSquared(p: Poly): Poly {
  const even = p.filter((_, i) => i % 2 === 0).map((c, i) => i % 2 ? neg(c) : c), odd = p.filter((_, i) => i % 2 === 1).map((c, i) => i % 2 ? neg(c) : c);
  return add(multiply(even, even), [zero, ...multiply(odd.length ? odd : [zero], odd.length ? odd : [zero])]);
}
function phase(loop: Loop, omega: number): number | undefined {
  if (!frequency(loop.n, loop.d, omega) || isZero(loop.n)) return;
  const ni = loop.n.findIndex(c => c.n !== 0n), di = loop.d.findIndex(c => c.n !== 0n);
  let angle = (numeric(over(loop.n[ni], loop.d[di])) < 0 ? -Math.PI : 0) + (ni - di) * Math.PI / 2;
  function change(root: Root) {
    if (root.re === 0 && root.im === 0) return 0;
    const start = root.im === 0 && root.re > 0 ? Math.PI : Math.atan2(-root.im, -root.re);
    return (Math.atan2(omega - root.im, -root.re) - start) * root.multiplicity;
  }
  angle += loop.zeros.reduce((v, r) => v + change(r), 0) - loop.openPoles.reduce((v, r) => v + change(r), 0); return angle * 180 / Math.PI;
}
export interface Crossing { readonly omega: number; readonly phase: number | undefined; readonly margin: number | undefined }
export interface FrequencyResult { readonly crossovers: readonly Crossing[]; readonly bandwidths: readonly number[]; readonly bandwidth?: number; readonly dc?: number }
export function frequencyAnalysis(loop: Loop): FrequencyResult {
  const crossingEquation = add(magnitudeSquared(loop.n), magnitudeSquared(loop.d).map(neg));
  const crossovers = positiveRoots(crossingEquation).map(x => {
    const omega = Math.sqrt(x), response = frequency(loop.n, loop.d, omega);
    if (!response || Math.abs(norm(response) - 1) > 1e-6) throw new Error('A gain crossing is singular or failed its magnitude residual.');
    const angle = phase(loop, omega); return { omega, phase: angle, margin: angle === undefined ? undefined : 180 + angle };
  });
  const a0 = loop.characteristic[0], dc = a0.n ? numeric(over(loop.n[0], a0)) : undefined;
  let bandwidths: number[] = [];
  if (dc !== undefined && dc !== 0) {
    const dc2 = times(over(loop.n[0], a0), over(loop.n[0], a0));
    const equation = add(magnitudeSquared(loop.n).map(c => times(rat(2), c)), magnitudeSquared(loop.characteristic).map(c => neg(times(dc2, c))));
    bandwidths = positiveRoots(equation).map(Math.sqrt);
    for (const omega of bandwidths) { const r = frequency(loop.n, loop.characteristic, omega); if (!r || Math.abs(norm(r) / Math.abs(dc) - Math.SQRT1_2) > 1e-6) throw new Error('A bandwidth crossing failed its magnitude residual.'); }
  }
  return { crossovers, bandwidths, bandwidth: bandwidths[0], dc };
}
export interface Estimate { readonly zeta: number; readonly wn: number; readonly overshoot: number; readonly settling: number; readonly bandwidthWn?: number }
export function equivalentSecondOrder(margin: number, referenceFrequency: number, route: 'crossover' | 'bandwidth'): Estimate {
  if (!Number.isFinite(margin) || margin <= 0 || margin >= 90 || !Number.isFinite(referenceFrequency) || referenceFrequency <= 0) throw new Error('A second-order estimate needs0<PM<90° and a positive reference frequency.');
  const p = margin * Math.PI / 180, zeta = Math.sin(p) / (2 * Math.sqrt(Math.cos(p)));
  if (zeta < .05 || zeta >= 1) throw new Error('This underdamped estimate supports equivalent damping0.05≤ζ<1.');
  const bandwidthWn = Math.sqrt(1 - 2 * zeta ** 2 + Math.sqrt(2 - 4 * zeta ** 2 + 4 * zeta ** 4));
  const wn = route === 'crossover' ? referenceFrequency / Math.sqrt(Math.cos(p)) : referenceFrequency / bandwidthWn;
  return { zeta, wn, overshoot: 100 * Math.exp(-Math.PI * zeta / Math.sqrt(1 - zeta ** 2)), settling: 4 / (zeta * wn), bandwidthWn };
}
export function estimateEligibility(loop: Loop, f: FrequencyResult): string | undefined {
  if (!loop.stable) return 'The full characteristic is not strictly stable; no settled-response estimate is offered.';
  if (f.dc === undefined || f.dc <= 0) return 'A positive nonzero closed-loop DC gain is required for this comparison.';
  if (f.crossovers.length !== 1) return 'The equivalent second-order heuristic requires one isolated positive gain crossover; all resolved crossings remain listed.';
  let d = loop.d, integrators = 0; while (d.length > 1 && d[0].n === 0n) { d = d.slice(1); integrators++; }
  if (integrators > 1 || (d.length > 1 && !hurwitz(d))) return 'Open-loop unstable/axis modes or multiple integrators violate this heuristic’s assumptions.';
  if (loop.n.length > 1 && !hurwitz(loop.n)) return 'A nonminimum-phase or axis zero violates the equivalent minimum-phase model assumption.';
  return;
}
export interface Sample { readonly t: number; readonly y: number }
export interface StepResult { readonly points: readonly Sample[]; readonly dt: number; readonly final?: number; readonly observedOvershoot?: number; readonly overshoot?: number; readonly peakTime?: number; readonly settling?: number; readonly tailBound?: number; readonly tailCertified: boolean; readonly reason?: string }
export function stepResponse(loop: Loop, horizon: number): StepResult {
  if (!Number.isFinite(horizon) || horizon < .05 || horizon > 1000) throw new Error('Choose a response horizon from0.05 to1000 seconds.');
  const d = loop.characteristic.map(numeric), n = d.length - 1, c = Array.from({ length: n }, (_, i) => numeric(loop.n[i] ?? zero));
  const a: Matrix = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === n - 1 ? -d[j] : Number(j === i + 1)));
  const augmented = a.map((row, i) => [...row, Number(i === n - 1)]); augmented.push(Array.from({ length: n + 1 }, () => 0));
  const rate = Math.max(...loop.poles.map(norm)), steps = Math.max(4000, Math.ceil(horizon * rate / .02));
  if (steps > 20000) throw new Error('The horizon and fastest mode need more than20,000 response steps. Shorten the horizon or rescale time.');
  const dt = horizon / steps, transition = exponential(augmented, dt), half = exponential(augmented, dt / 2), twice = multiplyM(half, half);
  if (normM(transition.map((row, i) => row.map((v, j) => v - twice[i][j]))) > 1e-10 * Math.max(1, normM(transition))) throw new Error('State propagation failed its half-step check. Rescale the model.');
  let state = [...Array.from({ length: n }, () => 0), 1]; const points: Sample[] = [{ t: 0, y: 0 }];
  for (let i = 1; i <= steps; i++) { state = applyM(transition, state); const y = c.reduce((v, x, j) => v + x * state[j], 0); if (!Number.isFinite(y) || Math.abs(y) > 1e8) throw new Error('The finite response exceeded10⁸ output units. Shorten the horizon; it is not a settled result.'); points.push({ t: i * dt, y }); }
  const independentEnd = applyM(exponential(augmented, horizon), [...Array.from({ length: n }, () => 0), 1]);
  if (state.some((v, i) => Math.abs(v - independentEnd[i]) > 1e-6 * Math.max(1, Math.abs(v), Math.abs(independentEnd[i])))) throw new Error('Full-horizon state propagation failed its consistency check. Rescale the model.');
  if (!loop.stable) return { points, dt, tailCertified: false, reason: 'The full characteristic is not strictly stable. Finite trace only; final value, overshoot and settling are not established.' };
  const final = numeric(over(loop.n[0], loop.characteristic[0]));
  if (final === 0) return { points, dt, final, tailCertified: false, reason: 'Final output is zero; relative overshoot and a relative2% settling band are undefined.' };
  const normalized = points.map(p => p.y / final), peakIndex = normalized.reduce((best, y, i) => y > normalized[best] ? i : best, 0), observedOvershoot = Math.max(0, 100 * (normalized[peakIndex] - 1));
  const certificate = tailCertificate(a, c), equilibrium = Array.from({ length: n }, (_, i) => i === 0 ? 1 / d[0] : 0), tailBound = certificate?.(state.slice(0, n).map((x, i) => x - equilibrium[i]));
  const tailCertified = tailBound !== undefined && tailBound <= .02 * Math.abs(final);
  let settling: number | undefined;
  if (tailCertified) {
    let last = -1; normalized.forEach((y, i) => { if (Math.abs(y - 1) > .02) last = i; });
    if (last >= 0 && last < points.length - 1) { const v0 = Math.abs(normalized[last] - 1), v1 = Math.abs(normalized[last + 1] - 1); settling = points[last].t + dt * (v0 - .02) / (v0 - v1); }
    else if (last < 0) settling = 0;
  }
  // A future peak must not be scored as zero merely because it was not observed.
  const overshoot = tailBound !== undefined && tailBound / Math.abs(final) < observedOvershoot / 100 ? observedOvershoot : undefined;
  return { points, dt, final, observedOvershoot, overshoot, peakTime: points[peakIndex].t, settling, tailBound, tailCertified, reason: tailCertified ? undefined : 'Settling is not established: extend the horizon until the all-future tail bound lies within the2% band (or rescale an unresolved certificate).' };
}
export function standardStep(estimate: Estimate, t: number): number { const wd = estimate.wn * Math.sqrt(1 - estimate.zeta ** 2); return 1 - Math.exp(-estimate.zeta * estimate.wn * t) * (Math.cos(wd * t) + estimate.zeta / Math.sqrt(1 - estimate.zeta ** 2) * Math.sin(wd * t)); }
export function moveRealZero(n: Poly, rate: number): Poly {
  if (n.length !== 2 || !n[0].n || !Number.isFinite(rate) || rate < .01 || rate > 100) throw new Error('Moving a zero needs a linear numerator with nonzero constant, and a positive rate0.01–100s⁻¹.');
  return trim([n[0], over(n[0], decimal(String(rate), true))]);
}
