import { magnitude, type Model } from './model';
import type { Polynomial } from './parser';
import { add, div, toNumber, ZERO } from './rational';

export interface Complex { readonly re: number; readonly im: number }
export interface MappingPoint {
  readonly theta: number; readonly z: Complex; readonly loop?: Complex; readonly returnDifference?: Complex;
  readonly denominatorRelative: number; readonly omitted: boolean;
}
export interface WindingResult {
  readonly kind: 'checked' | 'boundary' | 'unresolved'; readonly winding?: number; readonly turns?: number; readonly reason?: string;
  readonly points: readonly MappingPoint[]; readonly arcChecks: number; readonly acceptedArcs: number;
  readonly minimumD: number; readonly minimumQ: number; readonly maximumRatio: number; readonly omittedPoints: number;
}
export const TAU = 2 * Math.PI;
export const NUMERICAL_GUARD = 1e-12;
export const MAPPING_LIMIT = 1e6;
export interface WorkLimits { readonly arcChecks: number; readonly depth: number }
const DEFAULT_LIMITS: WorkLimits = Object.freeze({ arcChecks: 32768, depth: 20 });
const absolute = (z: Complex): number => Math.hypot(z.re, z.im);
const product = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
function quotient(a: Complex, b: Complex): Complex {
  const denominator = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / denominator, im: (a.im * b.re - a.re * b.im) / denominator };
}
export function unit(theta: number): Complex {
  if (theta === 0 || theta === TAU) return { re: 1, im: 0 };
  if (theta === Math.PI) return { re: -1, im: 0 };
  if (theta === Math.PI / 2) return { re: 0, im: 1 };
  if (theta === 3 * Math.PI / 2) return { re: 0, im: -1 };
  return { re: Math.cos(theta), im: Math.sin(theta) };
}
function value(coefficients: readonly number[], z: Complex): Complex {
  return coefficients.reduceRight((sum, c) => { const p = product(sum, z); return { re: p.re + c, im: p.im }; }, { re: 0, im: 0 });
}
function normalized(poly: Polynomial): { coefficients: number[]; sum: number; derivative: number } {
  const sum = poly.reduce((s, c) => add(s, magnitude(c)), ZERO);
  if (!sum.n) return { coefficients: [0], sum: 0, derivative: 0 };
  const coefficients = poly.map(c => toNumber(div(c, sum), true));
  return { coefficients, sum: toNumber(sum), derivative: coefficients.reduce((s, c, i) => s + i * Math.abs(c), 0) + NUMERICAL_GUARD };
}
function evaluator(model: Model) {
  // Positive exact coefficient-sum scaling does not change winding or relative gaps.
  const d = normalized(model.denominator), q = normalized(model.closed), n = normalized(model.numerator);
  function at(theta: number) { const z = unit(theta); return { theta, z, d: value(d.coefficients, z), q: value(q.coefficients, z), n: value(n.coefficients, z) }; }
  type Evaluation = ReturnType<typeof at>;
  function point(p: Evaluation): MappingPoint {
    const denominatorRelative = absolute(p.d);
    if (denominatorRelative <= 100 * NUMERICAL_GUARD) return { theta: p.theta, z: p.z, denominatorRelative, omitted: true };
    const l = quotient(p.n, p.d), f = quotient(p.q, p.d), loopScale = n.sum / d.sum, returnScale = q.sum / d.sum;
    const loop = { re: l.re * loopScale, im: l.im * loopScale }, returnDifference = { re: f.re * returnScale, im: f.im * returnScale };
    if (![loop.re, loop.im, returnDifference.re, returnDifference.im].every(Number.isFinite) || absolute(loop) > MAPPING_LIMIT) {
      return { theta: p.theta, z: p.z, denominatorRelative, returnDifference, omitted: true };
    }
    return { theta: p.theta, z: p.z, loop, returnDifference, denominatorRelative, omitted: false };
  }
  return { at, point, d, q };
}
function validTheta(theta: number): void { if (!Number.isFinite(theta) || theta < 0 || theta > TAU) throw new Error('Contour angle must be between 0 and 360 degrees (0 and 2π radians).'); }
export function mapAt(model: Model, theta: number): MappingPoint { validTheta(theta); const e = evaluator(model); return e.point(e.at(theta)); }
/** A sampled display, never an independently certified winding. Gaps stay gaps. */
export function sampledCurve(model: Model, intervals = 1024): readonly MappingPoint[] {
  if (!Number.isInteger(intervals) || intervals < 128 || intervals > 4096) throw new Error('Use 128–4096 display intervals.');
  const e = evaluator(model); return Array.from({ length: intervals + 1 }, (_, i) => e.point(e.at(TAU * i / intervals)));
}
/**
 * Guarded numerical winding from the COMPLETE oriented path, independently of root locations.
 * Normalize D and Q by their positive coefficient 1-norms. On a half arc h,
 * |p(theta)-p(mid)| <= h sum(i |p_i|). A guard covers rounded evaluations.
 * Require both relative disks <1/8. Then Q/D lies in a relative disk <2/7
 * about its midpoint value, excluding zero. Each true arc is homotopic to its
 * endpoint chord without crossing zero; summing principal chord angles is valid.
 * This is a guarded floating-point check, not an interval-arithmetic proof.
 */
export function winding(model: Model, limits: WorkLimits = DEFAULT_LIMITS): WindingResult {
  if (!Number.isInteger(limits.arcChecks) || limits.arcChecks < 128 || limits.arcChecks > 32768 || !Number.isInteger(limits.depth) || limits.depth < 0 || limits.depth > 20) throw new Error('Winding work supports 128–32768 arc checks and depth 0–20.');
  const e = evaluator(model); let checks = 0, accepted = 0, minimumD = Infinity, minimumQ = Infinity, maximumRatio = 0;
  const points: MappingPoint[] = [e.point(e.at(0))]; let phase = 0, compensation = 0, failure: string | undefined;
  const result = (kind: WindingResult['kind'], reason?: string, integer?: number, turns?: number): WindingResult => {
    const displayed = kind === 'checked' ? points : sampledCurve(model);
    return { kind, reason, winding: integer, turns, points: displayed, arcChecks: checks, acceptedArcs: accepted,
      minimumD: Number.isFinite(minimumD) ? minimumD : 0, minimumQ: Number.isFinite(minimumQ) ? minimumQ : 0, maximumRatio,
      omittedPoints: displayed.filter(p => p.omitted).length };
  };
  // Exact boundary screening only. The numerical count below never reads inside/outside counts.
  if (model.openRoots.boundary) return result('boundary', 'A retained open-loop pole lies on the unit circle. The ordinary complete-contour winding theorem is not applied; no indentation is fabricated.');
  if (model.closedRoots.boundary) return result('boundary', 'A retained closed-loop root lies on the unit circle. The return difference is zero on the contour (or a common boundary factor cancels); strict stability and an ordinary winding-away-from-zero certificate are not available.');
  function arc(a: number, b: number, depth: number): boolean {
    if (++checks > limits.arcChecks) { checks--; failure = 'The adaptive arc-check budget was reached. A sampled curve remains an illustration; no winding count is asserted. Move the model farther from the unit-circle/critical-point boundary.'; return false; }
    const mid = (a + b) / 2, h = (b - a) / 2, m = e.at(mid);
    const dRadius = (e.d.derivative * h + 8 * NUMERICAL_GUARD) * (1 + NUMERICAL_GUARD);
    const qRadius = (e.q.derivative * h + 8 * NUMERICAL_GUARD) * (1 + NUMERICAL_GUARD);
    const dMagnitude = absolute(m.d), qMagnitude = absolute(m.q), dRatio = dRadius / dMagnitude, qRatio = qRadius / qMagnitude;
    if (dRatio < .125 && qRatio < .125) {
      minimumD = Math.min(minimumD, dMagnitude - dRadius); minimumQ = Math.min(minimumQ, qMagnitude - qRadius);
      maximumRatio = Math.max(maximumRatio, dRatio, qRatio);
      const left = e.at(a), right = e.at(b), fa = quotient(left.q, left.d), fb = quotient(right.q, right.d);
      const delta = Math.atan2(fa.re * fb.im - fa.im * fb.re, fa.re * fb.re + fa.im * fb.im);
      if (!Number.isFinite(delta)) { failure = 'A phase increment exceeded the finite numerical range.'; return false; }
      const adjusted = delta - compensation, next = phase + adjusted; compensation = (next - phase) - adjusted; phase = next;
      accepted++; points.push(e.point(right)); return true;
    }
    if (depth >= limits.depth) { failure = 'An arc could not be separated safely from a pole or the critical point within depth 20 and the 10⁻¹² normalized numerical guard. No winding count is asserted. Use coefficients farther from the boundary.'; return false; }
    return arc(a, mid, depth + 1) && arc(mid, b, depth + 1);
  }
  for (let i = 0; i < 128; i++) if (!arc(TAU * i / 128, TAU * (i + 1) / 128, 0)) return result('unresolved', failure);
  const turns = phase / TAU, integer = Math.round(turns);
  if (!Number.isFinite(turns) || Math.abs(turns - integer) > 1e-7) return result('unresolved', 'The accumulated phase did not close to an integer within 10⁻⁷ turns. No winding count is asserted.');
  return result('checked', undefined, integer === 0 ? 0 : integer, turns);
}
