import { validateLead, validatePlant, type Lead, type Plant } from './input';
import { ONE, add, div, fromNumber, mul, sub, toNumber, type Q } from './rational';
export interface FrequencyPoint {
  omega: number; plantDb: number; plantPhase: number; controllerDb: number; boost: number;
  loopDb: number; phase: number;
}
export interface Margin {
  omega: number; phaseMargin: number; phaseAtCrossing: number; magnitudeResidual: number;
  gainMargin: 'infinite';
}
export interface PolynomialModel {
  rawDenominator: number[]; denominator: number[]; numerator: number[];
  routh: number; Kv: number; rampError: number;
}
const radToDeg = 180 / Math.PI;
const fail = (message: string): never => { throw new Error(message); };
function range(value: number, min: number, max: number, label: string): void {
  if (!Number.isFinite(value) || value < min || value > max) fail(label + ' must be finite, from ' + min + ' to ' + max + '.');
}
const number = (q: Q): number => toNumber(q, 1e-300, 1e10);
export function validateFrequency(omega: number): void { range(omega, 1e-8, 1e8, 'Frequency omega (rad/s)'); }
export function validateTarget(omega: number, phaseMargin: number): void {
  range(omega, .01, 100, 'Target crossover (rad/s)'); range(phaseMargin, 1, 85, 'Target phase margin (degrees)');
}
export function constantLead(K: number): Lead { const c = { K, T: 1, alpha: 1 }; validateLead(c); return c; }

/** Analytic rational frequency response. Log magnitudes avoid overflow;
 * the positive-omega phase branch is continuous, from -90 toward -180. */
function point(p: Plant, c: Lead, omega: number): FrequencyPoint {
  const plantLog = Math.log(p.k) - Math.log(omega) - Math.log(Math.hypot(p.a, omega));
  const plantPhase = -90 - Math.atan(omega / p.a) * radToDeg;
  const controllerLog = Math.log(c.K) + (c.alpha === 1 ? 0 : Math.log(Math.hypot(1, omega * c.T)) - Math.log(Math.hypot(1, omega * c.alpha * c.T)));
  const boost = c.alpha === 1 ? 0 : (Math.atan(omega * c.T) - Math.atan(omega * c.alpha * c.T)) * radToDeg;
  const db = 20 / Math.LN10;
  return { omega, plantDb: plantLog * db, plantPhase, controllerDb: controllerLog * db, boost, loopDb: (plantLog + controllerLog) * db, phase: plantPhase + boost };
}
export function frequency(p: Plant, c: Lead, omega: number): FrequencyPoint {
  validatePlant(p); validateLead(c); validateFrequency(omega); return point(p, c, omega);
}
export function corners(c: Lead): { zero: number; pole: number; peak: number; maxBoost: number } {
  validateLead(c);
  return { zero: 1 / c.T, pole: 1 / (c.alpha * c.T), peak: 1 / (c.T * Math.sqrt(c.alpha)), maxBoost: Math.asin((1 - c.alpha) / (1 + c.alpha)) * radToDeg };
}
export function requiredPhase(p: Plant, target: number, margin: number): { plantPhase: number; naturalMargin: number; required: number; available: number } {
  validatePlant(p); validateTarget(target, margin);
  const naturalMargin = 90 - Math.atan(target / p.a) * radToDeg;
  return { plantPhase: naturalMargin - 180, naturalMargin, required: margin - naturalMargin, available: Math.asin((1 - .02) / (1 + .02)) * radToDeg };
}
export function centerPeak(c: Lead, target: number): Lead {
  validateLead(c); range(target, .01, 100, 'Target crossover (rad/s)');
  const out = { ...c, T: 1 / (target * Math.sqrt(c.alpha)) }; validateLead(out); return out;
}
export function matchGain(p: Plant, c: Lead, target: number): Lead {
  validatePlant(p); validateLead(c); range(target, .01, 100, 'Target crossover (rad/s)');
  const unit = point(p, { ...c, K: 1 }, target);
  const out = { ...c, K: Math.exp(-unit.loopDb * Math.LN10 / 20) }; validateLead(out); return out;
}
export function designLead(p: Plant, target: number, margin: number): { lead: Lead; required: number } {
  const requested = requiredPhase(p, target, margin);
  if (requested.required <= 0) fail('No positive lead boost is needed at this target frequency. Choose a higher target margin/frequency, or compare the constant-gain case.');
  if (requested.required > requested.available) fail('Required phase exceeds the available single-section boost for alpha≥.02. Change the target or use another exercise structure.');
  const sine = Math.sin(requested.required / radToDeg), alpha = (1 - sine) / (1 + sine);
  const lead = matchGain(p, centerPeak({ K: 1, T: 1, alpha }, target), target);
  return { lead, required: requested.required };
}

/** d(log|L|)/d(log omega) =
 * -1-omega²/(a²+omega²)+omega²T²/(1+omega²T²)
 * -alpha²omega²T²/(1+alpha²omega²T²) < 0.
 * Thus one positive gain crossover exists. Phase is >-180 at every finite
 * positive omega, so this family has no finite phase crossover (GM infinite). */
export function margins(p: Plant, c: Lead): Margin {
  validatePlant(p); validateLead(c);
  let lo = Math.log(1e-8), hi = Math.log(1e8);
  if (!(point(p, c, Math.exp(lo)).loopDb > 0 && point(p, c, Math.exp(hi)).loopDb < 0)) fail('The crossover is outside the bounded 10⁻⁸–10⁸ rad/s search.');
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2;
    if (mid === lo || mid === hi) break;
    if (point(p, c, Math.exp(mid)).loopDb > 0) lo = mid; else hi = mid;
  }
  const omega = Math.exp((lo + hi) / 2), at = point(p, c, omega), magnitudeResidual = Math.abs(Math.expm1(at.loopDb * Math.LN10 / 20));
  if (!Number.isFinite(magnitudeResidual) || magnitudeResidual > 1e-10) fail('The gain-crossover residual is too large. Rescale the model.');
  return { omega, phaseMargin: 180 + at.phase, phaseAtCrossing: at.phase, magnitudeResidual, gainMargin: 'infinite' };
}
export function bode(p: Plant, c: Lead, minimum: number, maximum: number, count = 601): FrequencyPoint[] {
  validatePlant(p); validateLead(c); validateFrequency(minimum); validateFrequency(maximum);
  if (minimum >= maximum || !Number.isInteger(count) || count < 101 || count > 1201) fail('Use an increasing frequency interval and 101–1201 Bode points.');
  return Array.from({ length: count }, (_, i) => point(p, c, Math.exp(Math.log(minimum) + i / (count - 1) * Math.log(maximum / minimum))));
}

/** Exact binary-value coefficient sums, followed by one rounded conversion.
 * Descending coefficient order; the no-lead case uses the actual quadratic. */
export function closedLoop(p: Plant, c: Lead): PolynomialModel {
  validatePlant(p); validateLead(c);
  const k = fromNumber(p.k), a = fromNumber(p.a), K = fromNumber(c.K), T = fromNumber(c.T), alpha = fromNumber(c.alpha);
  const Kk = mul(K, k), Kv = number(div(Kk, a)), rampError = number(div(a, Kk));
  if (c.alpha === 1) return { rawDenominator: [1, p.a, number(Kk)], denominator: [1, p.a, number(Kk)], numerator: [0, 0, number(Kk)], routh: p.a, Kv, rampError };
  const alphaT = mul(alpha, T), d2 = add(ONE, mul(a, alphaT)), d1 = add(a, mul(Kk, T));
  const raw = [alphaT, d2, d1, Kk];
  // Positive expanded Routh expression avoids cancellation of two products.
  const routh = add(add(a, mul(mul(a, a), alphaT)), add(mul(mul(Kk, T), sub(ONE, alpha)), mul(mul(mul(a, alpha), Kk), mul(T, T))));
  return { rawDenominator: raw.map(number), denominator: raw.map(v => number(div(v, alphaT))),
    numerator: [0, 0, number(div(mul(Kk, T), alphaT)), number(div(Kk, alphaT))], routh: number(routh), Kv, rampError };
}
