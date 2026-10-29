import type { Forward } from './parser';
import { add, cancel, decimal, div, factorsAtOne, mul, neg, number, plus, q, scale, sub, times, zero, type Poly, type Q } from './rational';

export type Reference = 'step' | 'ramp' | 'parabola';
export type Basis = 'physical' | 'sequence';
export type Channel = 'comparator' | 'tracking';
export interface Pole { readonly re: number; readonly im: number }
export interface Limit {
  readonly kind: 'finite' | 'infinite';
  readonly value: Q;
  readonly poleOrder: number;
  readonly numeratorOrder: number;
  readonly denominatorOrder: number;
}
export interface ErrorResult {
  readonly numerator: Poly;
  readonly limit: Limit;
  readonly outcome: 'finite' | 'divergent' | 'not-certified';
  /** e[k] ~ leading * k^growthDegree when the closed loop is stable. */
  readonly growthDegree: number;
  readonly leading: Q;
}
export interface Sample { readonly k: number; readonly t: number; readonly r: number; readonly y: number; readonly comparator: number; readonly tracking: number }
export interface Analysis {
  readonly forward: Forward;
  readonly period: Q;
  readonly sensor: Q;
  readonly reference: Reference;
  readonly basis: Basis;
  readonly requestedSamples: number;
  readonly closed: Poly;
  readonly conditions: { readonly label: string; readonly value: Q }[];
  readonly stable: boolean;
  readonly poles: Pole[];
  readonly type: number;
  readonly constants: { readonly position: Limit; readonly velocitySequence: Limit; readonly velocityPhysical: Limit; readonly accelerationSequence: Limit; readonly accelerationPhysical: Limit };
  readonly errors: Record<Channel, ErrorResult>;
  readonly samples: Sample[];
  readonly traceWarning: string;
}

export function schur(p: Poly): { label: string; value: Q }[] {
  const lead = p.at(-1)!;
  const c = p.map(a => div(a, lead));
  if (c.length === 1) return [];
  if (c.length === 2) return [{ label: '1+a₀', value: add(q(1), c[0]) }, { label: '1−a₀', value: sub(q(1), c[0]) }];
  if (c.length !== 3) throw new Error('The closed-loop stability test supports degree at most two.');
  return [{ label: '1+a₁+a₀', value: add(add(q(1), c[1]), c[0]) }, { label: '1−a₁+a₀', value: add(sub(q(1), c[1]), c[0]) }, { label: '1−a₀', value: sub(q(1), c[0]) }];
}
export function roots(p: Poly): Pole[] {
  if (p.length === 1) return [];
  const normalized = p.map(a => div(a, p.at(-1)!));
  if (p.length === 2) return [{ re: -number(normalized[0]), im: 0 }];
  const a = normalized[1], b = normalized[0], discriminant = sub(mul(a, a), mul(q(4), b));
  if (discriminant.n < 0n) {
    const re = -number(a) / 2, im = Math.sqrt(number(neg(discriminant))) / 2;
    return [{ re, im }, { re, im: -im }];
  }
  if (discriminant.n === 0n) return [{ re: -number(a) / 2, im: 0 }, { re: -number(a) / 2, im: 0 }];
  const an = number(a), root = Math.sqrt(number(discriminant)), first = -(an + (an >= 0 ? root : -root)) / 2;
  return [{ re: first, im: 0 }, { re: b.n === 0n ? 0 : number(b) / first, im: 0 }];
}
export function rationalLimit(numerator: Poly, denominator: Poly, multiplier: Q = q(1)): Limit {
  if (zero(numerator) || multiplier.n === 0n) return { kind: 'finite', value: q(0), poleOrder: 0, numeratorOrder: Infinity, denominatorOrder: factorsAtOne(denominator).order };
  const n = factorsAtOne(numerator), d = factorsAtOne(denominator), poleOrder = Math.max(0, d.order - n.order);
  const coefficient = mul(multiplier, div(n.coefficient, d.coefficient));
  return { kind: poleOrder ? 'infinite' : 'finite', value: n.order > d.order ? q(0) : coefficient, poleOrder, numeratorOrder: n.order, denominatorOrder: d.order };
}
export function referenceFactors(reference: Reference, basis: Basis, period: Q): { order: number; factor: Poly; multiplier: Q } {
  const order = reference === 'step' ? 0 : reference === 'ramp' ? 1 : 2;
  const multiplier = basis === 'sequence' || reference === 'step' ? q(1) : reference === 'ramp' ? period : mul(period, period);
  return { order, multiplier, factor: reference === 'parabola' ? [q(1, 2), q(1, 2)] : [q(1)] };
}
function errorResult(numerator: Poly, closed: Poly, reference: Reference, basis: Basis, period: Q, stable: boolean): ErrorResult {
  const ref = referenceFactors(reference, basis, period);
  let denominator = closed;
  for (let i = 0; i < ref.order; i++) denominator = times(denominator, [q(-1), q(1)]);
  const limit = rationalLimit(times(numerator, ref.factor), denominator, ref.multiplier);
  const growthDegree = stable ? limit.poleOrder : 0;
  const factorial = growthDegree === 2 ? q(2) : q(1);
  return { numerator, limit, outcome: !stable ? 'not-certified' : limit.kind === 'finite' ? 'finite' : 'divergent', growthDegree, leading: div(limit.value, factorial) };
}
interface Filter { readonly denominator: number[]; readonly numerator: number[]; readonly delay: number; readonly history: number[] }
function filter(n: Poly, d: Poly): Filter {
  const reduced = cancel(n, d), lead = reduced.denominator.at(-1)!;
  const denominator = reduced.denominator.map(a => number(div(a, lead))).reverse();
  const numerator = reduced.numerator.map(a => number(div(a, lead))).reverse();
  return { denominator, numerator, delay: denominator.length - numerator.length, history: [] };
}
function evaluateFilter(f: Filter, input: number[], k: number): number {
  let value = 0;
  f.numerator.forEach((b, i) => { value += b * (input[k - i - f.delay] ?? 0); });
  f.denominator.slice(1).forEach((a, i) => { value -= a * (f.history[k - i - 1] ?? 0); });
  f.history.push(value); return value;
}
function stems(forward: Forward, closed: Poly, comparator: Poly, tracking: Poly, sensor: Q, period: Q, reference: Reference, basis: Basis, count: number): { samples: Sample[]; warning: string } {
  const fractions = [forward.numerator, comparator, tracking].map(n => cancel(n, closed));
  const numericDenominators = fractions.map(f => f.denominator);
  const nearBoundary = numericDenominators.some(d => schur(d).some(c => Math.abs(number(c.value)) < 1e-12));
  if (nearBoundary) return { samples: [], warning: 'A retained numerical channel is within 10⁻¹² of a unit-circle stability condition. Exact factor/limit reasoning is available; the floating-point stems are not reliable enough to draw.' };
  const growth = Math.max(0, ...numericDenominators.flatMap(roots).map(p => Math.log(Math.hypot(p.re, p.im))));
  const filters = [filter(forward.numerator, closed), filter(comparator, closed), filter(tracking, closed)];
  const samples: Sample[] = [], input: number[] = [], T = number(period), h = number(sensor);
  for (let k = 0; k <= count; k++) {
    if (growth * k > 20) return { samples, warning: `Stopped before k=${k}: unstable-mode growth exceeds the numerical trace bound (k log |pole| ≤20). This finite trace cannot establish a steady error.` };
    const t = k * T, x = basis === 'physical' ? t : k;
    const r = reference === 'step' ? 1 : reference === 'ramp' ? x : x * x / 2;
    input.push(r);
    const [y, ec, et] = filters.map(f => evaluateFilter(f, input, k));
    if (![r, y, ec, et].every(v => Number.isFinite(v) && Math.abs(v) <= 1e8)) return { samples, warning: `Stopped before k=${k}: a signal exceeded 10⁸ units or numerical range. Final-value claims still require the analytic conditions below.` };
    // The channels are simulated independently after exact scalar cancellation;
    // their comparator identities are checked independently in tests.
    if (!Number.isFinite(h)) throw new Error('The sensor is outside numerical range.');
    samples.push({ k, t, r, y, comparator: ec, tracking: et });
  }
  return { samples, warning: '' };
}
export function analyze(forward: Forward, period: Q, sensor: Q, reference: Reference, basis: Basis, samples: number): Analysis {
  if (!['step', 'ramp', 'parabola'].includes(reference) || !['physical', 'sequence'].includes(basis)) throw new Error('Choose a supported reference and time normalization.');
  const T = number(period), h = number(sensor);
  if (T < 0.001 || T > 10 || h < 0.01 || h > 10) throw new Error('Use T=0.001–10 s and sensor h=0.01–10.');
  if (!Number.isInteger(samples) || samples < 10 || samples > 1000) throw new Error('Choose an integer final sample index from 10 to 1000.');
  const raw = plus(forward.denominator, scale(forward.numerator, sensor));
  if (zero(raw) || raw.length < forward.denominator.length) throw new Error('The direct feedback equation is singular: 1 + h·d₀ = 0, where d₀ is the forward feedthrough gain.');
  const closed = raw.map(a => div(a, raw.at(-1)!));
  if (closed.some(a => Math.abs(number(a)) > 1e6)) throw new Error('The normalized closed-loop coefficients exceed 10⁶. The direct feedback equation is too ill-conditioned here.');
  const conditions = schur(closed), stable = conditions.every(c => c.value.n > 0n);
  const atOne = [q(-1), q(1)], loopN = scale(forward.numerator, sensor);
  const velocityN = times(loopN, atOne), accelerationN = times(velocityN, atOne);
  const nf = factorsAtOne(forward.numerator), df = factorsAtOne(forward.denominator);
  const type = zero(forward.numerator) ? 0 : Math.max(0, df.order - nf.order);
  // Normalize both error numerators by the same closed-loop leading term.
  const comparator = scale(forward.denominator, div(q(1), raw.at(-1)!));
  const tracking = scale(plus(forward.denominator, scale(forward.numerator, sub(sensor, q(1)))), div(q(1), raw.at(-1)!));
  const output = { ...forward, numerator: scale(forward.numerator, div(q(1), raw.at(-1)!)) };
  const trace = stems(output, closed, comparator, tracking, sensor, period, reference, basis, samples);
  return {
    forward, period, sensor, reference, basis, requestedSamples: samples, closed, conditions, stable, poles: roots(closed), type,
    constants: { position: rationalLimit(loopN, forward.denominator), velocitySequence: rationalLimit(velocityN, forward.denominator), velocityPhysical: rationalLimit(velocityN, forward.denominator, div(q(1), period)), accelerationSequence: rationalLimit(accelerationN, forward.denominator), accelerationPhysical: rationalLimit(accelerationN, forward.denominator, div(q(1), mul(period, period))) },
    errors: { comparator: errorResult(comparator, closed, reference, basis, period, stable), tracking: errorResult(tracking, closed, reference, basis, period, stable) },
    samples: trace.samples, traceWarning: trace.warning,
  };
}
export const baseline = () => ({ period: decimal('0.1'), sensor: q(1) });
