import { absC, angle, c, divC, evaluate, residual, scaleC, type Complex } from './complex';
import { characteristic, type Model } from './model';
import { degree, derivative, gcd, minus, monic, product, quotient, realZeros, zero, type Polynomial } from './polynomial';
import { add, compare, decimal, div, mul, neg, rational, sub, toNumber, ZERO, type Rational } from './rational';
import { expandRoots, type Root } from './roots';

export interface Segment { readonly lower: number; readonly upper: number; readonly rightCount: number; readonly onLocus: boolean }
export interface Asymptotes { readonly count: number; readonly centroid: Rational; readonly angles: readonly number[] }
export interface Tangent { readonly root: Root; readonly angles: readonly number[]; readonly kind: 'departure' | 'arrival' }
export interface BreakPoint { readonly point: number; readonly gain: number; readonly admissible: boolean; readonly residual: number; readonly reason: string }
export interface Crossing { readonly omega: number; readonly gain: number; readonly residual: number; readonly kind: 'origin' | 'pair' }
export interface RuleSet {
  readonly segments: readonly Segment[]; readonly asymptotes: Asymptotes; readonly tangents: readonly Tangent[];
  readonly stationaryPolynomial: Polynomial; readonly breaks: readonly BreakPoint[]; readonly stationaryFamily: boolean;
  readonly crossings: readonly Crossing[]; readonly crossingEquation?: Polynomial; readonly axisFamily?: string;
}
const degrees = (theta: number): number => ((theta * 180 / Math.PI) % 360 + 360) % 360;
const r = (n: number): Rational => rational(BigInt(n));
function segments(model: Model): Segment[] {
  const realRoots = [...expandRoots(model.poles), ...expandRoots(model.zeros)].filter(p => !p.im).map(p => p.re).sort((a, b) => a - b);
  const ends = [-Infinity, ...realRoots.filter((value, i) => !i || value !== realRoots[i - 1]), Infinity];
  return ends.slice(0, -1).map((lower, i) => {
    const upper = ends[i + 1], point = !Number.isFinite(lower) ? upper - Math.max(1, Math.abs(upper)) : !Number.isFinite(upper) ? lower + Math.max(1, Math.abs(lower)) : (lower + upper) / 2;
    const rightCount = realRoots.filter(value => value > point).length;
    return { lower, upper, rightCount, onLocus: rightCount % 2 === 1 };
  });
}
function asymptotes(model: Model): Asymptotes {
  const n = degree(model.reducedD), m = degree(model.reducedN), count = n - m;
  const poleSum = neg(div(model.reducedD[n - 1], model.reducedD[n])), zeroSum = m ? neg(div(model.reducedN[m - 1], model.reducedN[m])) : ZERO;
  return { count, centroid: div(sub(poleSum, zeroSum), r(count)), angles: Array.from({ length: count }, (_, i) => (2 * i + 1) * 180 / count) };
}
function tangent(model: Model, root: Root, kind: 'departure' | 'arrival'): Tangent {
  let factor = kind === 'departure' ? model.reducedD : model.reducedN, factorial = 1;
  for (let i = 1; i <= root.multiplicity; i++) { factor = derivative(factor); factorial *= i; }
  const derivativeValue = scaleC(evaluate(factor, root), 1 / factorial);
  const other = evaluate(kind === 'departure' ? model.reducedN : model.reducedD, root);
  if (!absC(derivativeValue) || !absC(other)) throw new Error('A local root direction is too poorly conditioned. Rescale the model.');
  const direction = angle(scaleC(divC(other, derivativeValue), -1));
  return { root, kind, angles: Array.from({ length: root.multiplicity }, (_, i) => degrees((direction + 2 * Math.PI * i) / root.multiplicity)) };
}
function breakPoints(model: Model): { polynomial: Polynomial; points: BreakPoint[]; family: boolean } {
  const raw = minus(product(derivative(model.reducedD), model.reducedN), product(model.reducedD, derivative(model.reducedN)));
  if (zero(raw)) return { polynomial: raw, points: [], family: true };
  // Repeated finite zeros also solve the derivative numerator; they correspond to infinite gain.
  const polynomial = quotient(raw, gcd(raw, model.reducedN));
  const points = realZeros(polynomial).map(root => {
    const point = c(root.value), n = evaluate(model.reducedN, point).re, d = evaluate(model.reducedD, point).re;
    const gain = -d / n;
    if (!Number.isFinite(gain)) return { point: root.value, gain, admissible: false, residual: Infinity, reason: 'No finite gain at this zero.' };
    if (gain < 0) return { point: root.value, gain, admissible: false, residual: Infinity, reason: 'Negative gain; outside K ≥ 0.' };
    if (gain > 1000) return { point: root.value, gain, admissible: false, residual: Infinity, reason: 'Gain exceeds the supported maximum 1000.' };
    const q = characteristic(model, decimal(String(gain), true)), error = residual(q, point), slopeError = residual(derivative(q), point);
    const admissible = error <= 2e-8 && slopeError <= 2e-8;
    return { point: root.value, gain, residual: Math.max(error, slopeError), admissible, reason: admissible ? 'Positive-gain stationary point; Q and its derivative vanish numerically.' : 'The full Q or its derivative failed the residual check.' };
  });
  return { polynomial: monic(polynomial), points, family: false };
}
function crossings(model: Model): { points: Crossing[]; equation?: Polynomial; family?: string } {
  const d = model.reducedD, n = model.reducedN;
  const d0 = d[0], d1 = d[1] ?? ZERO, d2 = d[2] ?? ZERO, d3 = d[3] ?? ZERO;
  const n0 = n[0], n1 = n[1] ?? ZERO, n2 = n[2] ?? ZERO;
  const points: Crossing[] = [];
  const record = (u: number, k: number, kind: Crossing['kind']): void => {
    if (!Number.isFinite(k) || !Number.isFinite(u) || k < 0 || k > 1000 || u < 0) return;
    const omega = Math.sqrt(u), q = characteristic(model, decimal(String(k), true)), error = residual(q, c(0, omega));
    if (error > 2e-8) throw new Error('An imaginary-axis candidate failed the full characteristic polynomial check.');
    if (!points.some(p => Math.abs(p.gain - k) < 1e-9 * Math.max(1, k) && Math.abs(p.omega - omega) < 1e-9)) points.push({ omega, gain: k, kind, residual: error });
  };
  // Screen closed interval endpoints in exact arithmetic before numerical isolation.
  // An isolated u midpoint can round a genuine K=0 just negative or K=1000 just above the cap.
  for (const gain of d3.n || d1.n || n1.n ? [r(0), r(1000)] : []) {
    const q0 = add(d0, mul(gain, n0)), q1 = add(d1, mul(gain, n1)), q2 = add(d2, mul(gain, n2));
    const u = d3.n ? div(q1, d3) : !q1.n && q2.n ? div(q0, q2) : undefined;
    if (u && u.n > 0n && !sub(q0, mul(q2, u)).n) record(toNumber(u), toNumber(gain, true), 'pair');
  }
  if (n0.n) { const k = div(neg(d0), n0); if (k.n >= 0n && compare(k, r(1000)) <= 0) record(0, toNumber(k, true), 'origin'); }
  if (n1.n) {
    // (d0-d2 u)n1 + (d3 u-d1)(n0-n2 u)=0, u=ω²; K=(d3 u-d1)/n1.
    const equation = [sub(mul(d0, n1), mul(d1, n0)), add(neg(mul(d2, n1)), add(mul(d3, n0), mul(d1, n2))), neg(mul(d3, n2))];
    if (zero(equation)) return { points, equation, family: 'The imaginary equations vanish as a family. This model has no isolated positive-frequency crossing list.' };
    for (const root of realZeros(equation)) if (root.value > 0) record(root.value, (toNumber(d3) * root.value - toNumber(d1)) / toNumber(n1), 'pair');
    return { points: points.sort((a, b) => a.gain - b.gain), equation };
  }
  if (d3.n) {
    const u = div(d1, d3), coefficient = sub(n0, mul(n2, u)), constant = sub(d0, mul(d2, u));
    if (u.n > 0n && coefficient.n) record(toNumber(u), toNumber(div(neg(constant), coefficient), true), 'pair');
    else if (u.n > 0n && !constant.n && !coefficient.n) return { points, family: 'A conjugate imaginary pair persists with gain; inspect retained common factors.' };
  } else if (!d1.n && d2.n) {
    return { points, family: 'An even quadratic has an imaginary-axis branch family: ω²=(d₀+K n₀)/d₂ whenever this ratio is positive. There is no isolated pair-crossing gain.' };
  }
  return { points: points.sort((a, b) => a.gain - b.gain) };
}
export function rules(model: Model): RuleSet {
  const stationary = breakPoints(model), crossing = crossings(model);
  return { segments: segments(model), asymptotes: asymptotes(model), tangents: [...model.poles.map(p => tangent(model, p, 'departure')), ...model.zeros.map(p => tangent(model, p, 'arrival'))], stationaryPolynomial: stationary.polynomial, breaks: stationary.points, stationaryFamily: stationary.family, crossings: crossing.points, crossingEquation: crossing.equation, axisFamily: crossing.family };
}
export function vectors(model: Model, point: Complex): readonly { kind: 'pole' | 'zero'; from: Root; dx: number; dy: number; angle: number }[] {
  return [...model.poles.map(from => ({ kind: 'pole' as const, from })), ...model.zeros.map(from => ({ kind: 'zero' as const, from }))].map(item => ({ ...item, dx: point.re - item.from.re, dy: point.im - item.from.im, angle: Math.atan2(point.im - item.from.im, point.re - item.from.re) * 180 / Math.PI }));
}
