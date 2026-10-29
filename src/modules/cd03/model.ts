import { coefficients } from './algebra';
import { parseGain } from './input';
export type Plant = { a: number; b: number };
export type Design = Plant & { k: number; lag: boolean; p: number; z: number };
export type Complex = { re: number; im: number };
export const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const neg = (a: Complex): Complex => ({ re: -a.re, im: -a.im });
export const mul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const abs = (a: Complex) => Math.hypot(a.re, a.im);
export function div(a: Complex, b: Complex): Complex {
  const d = b.re ** 2 + b.im ** 2;
  if (!(d > 0) || !Number.isFinite(d)) throw new Error('A pole or undefined ratio was reached.');
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}
const real = (x: number): Complex => ({ re: x, im: 0 });
/** Descending coefficients for all numerical polynomials in this module. */
export function poly(coefficients: number[], s: Complex): Complex { return coefficients.reduce((v, c) => add(mul(v, s), real(c)), real(0)); }
export function parsePlant(value: string): Plant {
  const gain = parseGain(value);
  if (gain.cancelled) throw new Error('A pole-zero factor was canceled in the plant entry. Enter the original degree-two family without hidden canceled factors; this exercise cannot certify extra internal modes.');
  const c = coefficients(gain);
  if (c.numerator.length !== 1 || c.denominator.length !== 3 || c.denominator[0] !== '0') throw new Error('Use G(s)=b/[s(s+a)] with positive a and b; enter only the gain expression.');
  const lead = Number(c.denominator[2]), a = Number(c.denominator[1]) / lead, b = Number(c.numerator[0]) / lead;
  if (![a, b].every(Number.isFinite) || a < .2 || a > 20 || b < .05 || b > 20) throw new Error('Use plant a from 0.2 to 20 s⁻¹ and b from 0.05 to 20 in consistent units.');
  return { a, b };
}
export function validate(d: Design) {
  if (![d.a, d.b, d.k, d.p, d.z].every(Number.isFinite)) throw new Error('Every design parameter must be finite.');
  if (d.a < .2 || d.a > 20 || d.b < .05 || d.b > 20 || d.k < .05 || d.k > 100) throw new Error('Use a=0.2–20, b=0.05–20 and proportional gain K=0.05–100.');
  const wn = Math.sqrt(d.b * d.k), damping = d.a / (2 * wn);
  if (wn < .2 || wn > 20 || damping < .1 || damping > .95) throw new Error('This lag exercise uses an oscillatory baseline: 0.2≤ωn≤20 rad/s and 0.1≤ζ≤0.95. Adjust a, b or K.');
  if (d.lag && (d.p < .001 || d.z > 5 || !(d.p < d.z) || d.z / d.p > 1000)) throw new Error('For lag use 0.001≤p<z≤5 s⁻¹ and z/p≤1000. The pole lies nearer the origin.');
}
function quadratic(a: number, b: number): Complex[] {
  const discriminant = a * a - 4 * b;
  if (discriminant < 0) { const im = Math.sqrt(-discriminant) / 2; return [{ re: -a / 2, im }, { re: -a / 2, im: -im }]; }
  const q = -.5 * (a + (a >= 0 ? 1 : -1) * Math.sqrt(discriminant));
  return q === 0 ? [real(0), real(-a)] : [real(q), real(b / q)];
}
export function roots(c: number[]): Complex[] {
  if (c[0] !== 1 || ![3, 4].includes(c.length) || !c.every(Number.isFinite)) throw new Error('Only finite monic quadratic/cubic characteristic polynomials are supported.');
  let out: Complex[];
  if (c.length === 3) out = quadratic(c[1], c[2]);
  else {
    const at = (s: number) => ((s + c[1]) * s + c[2]) * s + c[3];
    const radius = 1 + Math.max(...c.slice(1).map(Math.abs));
    let lo = -radius, hi = radius;
    for (let n = 0; n < 160; n++) { const mid = (lo + hi) / 2, y = at(mid); if (y === 0) { lo = hi = mid; break; } if (y > 0) hi = mid; else lo = mid; }
    const r = (lo + hi) / 2;
    if (r === 0) throw new Error('A zero cubic root is unsupported in this positive-gain family.');
    out = [real(r), ...quadratic(c[1] + r, -c[3] / r)];
  }
  let reconstructed: Complex[] = [real(1)];
  for (const root of out) {
    const next = Array.from({ length: reconstructed.length + 1 }, () => real(0));
    reconstructed.forEach((v, i) => { next[i] = add(next[i], v); next[i + 1] = add(next[i + 1], mul(v, neg(root))); }); reconstructed = next;
  }
  const coefficientError = Math.max(...c.map((v, i) => abs(add(reconstructed[i], real(-v))) / Math.max(1, Math.abs(v))));
  const residual = Math.max(...out.map(r => abs(poly(c, r)) / c.reduce((sum, v, i) => sum + Math.abs(v) * Math.max(1, abs(r)) ** (c.length - 1 - i), 0)));
  if (coefficientError > 1e-9 || residual > 1e-10 || !out.every(r => Number.isFinite(abs(r)))) throw new Error('The complete root calculation lost accuracy. Rescale or move the design away from this conditioning case.');
  return out.sort((a, b) => a.re - b.re || a.im - b.im);
}
export function model(d: Design) {
  validate(d); const gain = d.k * d.b;
  const baselineDenominator = [1, d.a, gain];
  const denominator = d.lag ? [1, d.a + d.p, d.a * d.p + gain, gain * d.z] : baselineDenominator;
  const numerator = d.lag ? [gain, gain * d.z] : [gain];
  const fullRoots = roots(denominator), baselineRoots = roots(baselineDenominator);
  const routh = d.lag ? denominator[1] * denominator[2] - denominator[3] : d.a * gain;
  const margin = d.lag ? routh / Math.max(denominator[1] * denominator[2], denominator[3]) : 1;
  const stability = margin > 1e-9 ? 'stable' : margin < -1e-9 ? 'unstable' : 'boundary';
  const beta = d.lag ? d.z / d.p : 1, baselineKv = gain / d.a, kv = baselineKv * beta;
  const s0 = baselineRoots.find(r => r.im > 0)!;
  const section = d.lag ? div(add(s0, real(d.z)), add(s0, real(d.p))) : real(1);
  const angle = Math.atan2(section.im, section.re) * 180 / Math.PI;
  return { denominator, numerator, fullRoots, baselineRoots, baselineDenominator, routh, margin, stability, beta, baselineKv, kv, rampError: stability === 'stable' ? 1 / kv : undefined, s0, angle, magnitude: abs(section), magnitudeGain: d.k / abs(section) };
}
