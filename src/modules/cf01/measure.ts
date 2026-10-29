import { futureEnvelope, normalizedAt, roundoffAllowance, type Response } from './response';
export type Band = 1 | 2 | 5;
export type Rise = '10-90' | '0-100';
export interface Point { t: number; value: number; slope: number }
export interface Measurement {
  response: Response; horizon: number; band: Band; rise: Rise; tolerance: number;
  intervals: number; samples: Point[]; refinementChange: number; envelope: number;
  riseStart?: number; riseEnd?: number; riseTime?: number;
  peakTime?: number; windowPeakValue: number; overshootPercent: number;
  peakEstablished: boolean; noOvershoot: boolean;
  settlingTime?: number; lastOutsideTime?: number;
}
export interface Targets {
  overshoot: number; settling: number; band: Band; dampingMinimum: number;
  decayMinimum: number; naturalFrequencyAtMinimumDamping: number; coefficient: number;
}
const fail = (message: string): never => { throw new Error(message); };
const at = (r: Response, t: number): Point => ({ t, ...normalizedAt(r, t) });
function bandCheck(band: number): asserts band is Band {
  if (![1, 2, 5].includes(band)) fail('Select the 1%, 2% or 5% settling band.');
}
function bisect(f: (t: number) => number, left: number, right: number): number {
  let sign = f(left);
  if (sign === 0) return left;
  if (f(right) === 0) return right;
  for (let j = 0; j < 64 && right - left > 1e-11 * (1 + right); j++) {
    const mid = (left + right) / 2, value = f(mid);
    if (value === 0) return mid;
    if ((value < 0) === (sign < 0)) { left = mid; sign = value; }
    else right = mid;
  }
  return (left + right) / 2;
}
/** Sufficient no-overshoot conditions. Positivity of cascaded real stable
 * first-order factors proves the overdamped/no-zero case; a RHP zero subtracts
 * a positive impulse response. Other checks bound the actual modal expression.
 * A failed sufficient condition never claims that overshoot must occur. */
function belowFinal(r: Response): boolean {
  if (r.damping >= 1 && (r.model.zero === undefined || r.model.zero < 0)) return true;
  const modes = r.modes.filter(m => m.coefficient.re !== 0 || m.coefficient.im !== 0);
  if (modes.every(m => m.pole.im === 0 && m.coefficient.im === 0 && m.coefficient.re <= 0)) return true;
  if (modes.some(m => m.power !== 0)) return false;
  for (const negative of modes) {
    if (negative.pole.im !== 0 || negative.coefficient.im !== 0 || negative.coefficient.re >= 0) continue;
    const others = modes.filter(m => m !== negative);
    if (others.some(m => m.pole.re > negative.pole.re)) continue;
    const amplitude = others.reduce((sum, m) => sum + Math.hypot(m.coefficient.re, m.coefficient.im), 0);
    if (-negative.coefficient.re > amplitude + 512 * Number.EPSILON * (1 + r.coefficientScale)) return true;
  }
  return false;
}
function firstCrossing(r: Response, knots: Point[], level: number, precision: number): number | undefined {
  for (let i = 1; i < knots.length; i++) {
    const a = knots[i - 1], b = knots[i];
    if (a.value <= level && b.value > level + precision) return bisect(t => normalizedAt(r, t).value - level, a.t, b.t);
    if (a.value < level && b.value === level && b.slope > precision) return b.t;
  }
  return undefined;
}
type Candidate = Omit<Measurement, 'intervals' | 'tolerance' | 'refinementChange'>;
function grid(r: Response, horizon: number, band: Band, rise: Rise, intervals: number): Candidate {
  const samples = Array.from({ length: intervals + 1 }, (_, i) => at(r, i * horizon / intervals));
  const knots = [...samples], precision = Math.max(1e-10, roundoffAllowance(r, horizon));
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if ((a.slope < 0 && b.slope > 0) || (a.slope > 0 && b.slope < 0)) knots.push(at(r, bisect(t => normalizedAt(r, t).slope, a.t, b.t)));
  }
  knots.sort((a, b) => a.t - b.t);
  const noOvershoot = belowFinal(r), envelope = futureEnvelope(r, horizon);
  const riseStart = rise === '0-100' ? 0 : firstCrossing(r, knots, .1, precision);
  // Do not turn a floating-point plateau rounded to1 into a finite100% rise.
  const riseEnd = rise === '0-100' && noOvershoot ? undefined : firstCrossing(r, knots, rise === '0-100' ? 1 : .9, precision);
  const maximum = knots.reduce((a, b) => a.value >= b.value ? a : b);
  const overshootPercent = noOvershoot ? 0 : Math.max(0, (maximum.value - 1) * 100);
  const peakTime = maximum.value > 1 + precision && maximum.t > 0 && maximum.t < horizon ? maximum.t : undefined;
  const peakEstablished = noOvershoot || (peakTime !== undefined && maximum.value - 1 >= envelope + precision);
  let settlingTime: number | undefined, lastOutsideTime: number | undefined, lastOutside = -1;
  const bandValue = band / 100;
  knots.forEach((point, i) => { if (Math.abs(point.value - 1) > bandValue) { lastOutside = i; lastOutsideTime = point.t; } });
  if (envelope <= bandValue && Math.abs(samples.at(-1)!.value - 1) <= bandValue) {
    if (lastOutside < 0) settlingTime = 0;
    else if (lastOutside < knots.length - 1) settlingTime = bisect(t => Math.abs(normalizedAt(r, t).value - 1) - bandValue, knots[lastOutside].t, knots[lastOutside + 1].t);
  }
  return {
    response: r, horizon, band, rise, samples, envelope, riseStart, riseEnd,
    riseTime: riseStart !== undefined && riseEnd !== undefined ? riseEnd - riseStart : undefined,
    peakTime, windowPeakValue: maximum.value * r.finalValue, overshootPercent, peakEstablished,
    noOvershoot, settlingTime, lastOutsideTime,
  };
}
function difference(a: number | undefined, b: number | undefined): number {
  if (a === undefined || b === undefined) return a === b ? 0 : Infinity;
  return Math.abs(a - b) / (1 + Math.abs(b));
}
/** Refines sampled illustration and detected crossings/extrema. Envelopes guard
 * the unobserved future, not missed features in a coarse finite plot. Pole-scale
 * resolution, derivative roots and halving checks are all used; no interval-
 * certified global-extremum claim follows from sampling alone. */
export function measure(r: Response, horizon: number, band: Band = 2, rise: Rise = '10-90', tolerance = 1e-4): Measurement {
  if (!Number.isFinite(horizon) || horizon < .05 || horizon > 100) fail('Choose a horizon from 0.05 to 100 seconds.');
  bandCheck(band);
  if (!['10-90', '0-100'].includes(rise)) fail('Select a supported rise-time definition.');
  if (!Number.isFinite(tolerance) || tolerance < 1e-5 || tolerance > 1e-3) fail('Choose refinement tolerance from 0.00001 to 0.001.');
  if (roundoffAllowance(r, horizon) > tolerance / 8) fail('The modal roundoff allowance is too large for this refinement. Separate close poles or shorten the horizon.');
  const speed = Math.max(1, ...r.poles.map(p => Math.hypot(p.re, p.im)));
  let intervals = 2 ** Math.ceil(Math.log2(Math.max(128, horizon * speed / .25)));
  if (intervals >= 16384) fail('The dynamics/horizon exceed the bounded plot refinement. Shorten the horizon or reduce pole frequency.');
  let coarse = grid(r, horizon, band, rise, intervals);
  while (intervals < 16384) {
    const fine = grid(r, horizon, band, rise, intervals * 2);
    let change = Math.max(difference(coarse.riseTime, fine.riseTime), difference(coarse.peakTime, fine.peakTime), difference(coarse.overshootPercent, fine.overshootPercent), difference(coarse.settlingTime, fine.settlingTime));
    for (let i = 0; i < intervals; i++) {
      const midpoint = fine.samples[2 * i + 1].value;
      change = Math.max(change, Math.abs(midpoint - (coarse.samples[i].value + coarse.samples[i + 1].value) / 2) / (1 + Math.abs(midpoint)));
    }
    intervals *= 2;
    if (change <= tolerance) return { ...fine, intervals, tolerance, refinementChange: change };
    coarse = fine;
  }
  return fail('Refinement did not converge within 16384 intervals; shorten the horizon or relax tolerance.');
}
export function deriveTargets(overshoot: number, settling: number, band: Band): Targets {
  bandCheck(band);
  if (!Number.isFinite(overshoot) || overshoot < 0 || overshoot > 99) fail('Set maximum overshoot from 0% to 99%.');
  if (!Number.isFinite(settling) || settling < .05 || settling > 100) fail('Set target settling time from 0.05 to 100 seconds.');
  const log = overshoot === 0 ? -Infinity : Math.log(overshoot / 100);
  const dampingMinimum = overshoot === 0 ? 1 : -log / Math.hypot(Math.PI, log);
  const coefficient = band === 2 ? 4 : band === 5 ? 3 : 4.6;
  const decayMinimum = coefficient / settling;
  return { overshoot, settling, band, dampingMinimum, decayMinimum, coefficient, naturalFrequencyAtMinimumDamping: decayMinimum / dampingMinimum };
}
export function pairPrediction(r: Response, targets: Targets): { overshoot: number; peakTime?: number; settlingGuideline?: number; inRegion: boolean } {
  const damping = r.damping, frequency = r.naturalFrequency;
  const overshoot = damping >= 1 ? 0 : 100 * Math.exp(-Math.PI * damping / Math.sqrt(1 - damping * damping));
  const peakTime = damping >= 1 ? undefined : Math.PI / (frequency * Math.sqrt(1 - damping * damping));
  const inRegion = r.poles.slice(0, 2).every(p => -p.re >= targets.decayMinimum - 1e-10 && -p.re / Math.hypot(p.re, p.im) >= targets.dampingMinimum - 1e-10);
  return { overshoot, peakTime, settlingGuideline: damping <= 1 ? targets.coefficient / (damping * frequency) : undefined, inRegion };
}
export function assess(m: Measurement, targets: Targets): { overshoot: boolean | undefined; settling: boolean | undefined } {
  if (m.band !== targets.band) fail('Use the same band for measurement and target requirements.');
  const margin = m.tolerance * 100;
  const overshoot = m.noOvershoot ? true : m.overshootPercent > targets.overshoot + margin ? false : m.overshootPercent < targets.overshoot - margin && m.envelope * 100 < targets.overshoot - margin ? true : undefined;
  const settling = m.settlingTime !== undefined ? m.settlingTime < targets.settling - m.tolerance ? true : m.settlingTime > targets.settling + m.tolerance ? false : undefined : m.lastOutsideTime !== undefined && m.lastOutsideTime > targets.settling + m.tolerance ? false : undefined;
  return { overshoot, settling };
}
