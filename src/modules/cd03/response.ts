import { abs, add, div, mul, neg, poly, type Complex } from './model';
const real = (re: number): Complex => ({ re, im: 0 });
export type Response = { poles: Complex[]; residues: Complex[]; value: (t: number) => number; slope: (t: number) => number; tail: (t: number) => number; roundoff: number };
export function response(numerator: number[], denominator: number[], poles: Complex[]): Response {
  if (poles.some(p => p.re >= 0)) throw new Error('Step metrics require a strictly stable complete closed loop.');
  for (let i = 0; i < poles.length; i++) for (let j = i + 1; j < poles.length; j++) {
    if (abs(add(poles[i], neg(poles[j]))) <= 1e-5 * Math.max(1, abs(poles[i]), abs(poles[j]))) throw new Error('Repeated or very close closed-loop poles are outside this transient evaluator. Move the design slightly; the full pole list and tracking condition remain available.');
  }
  const derivative = denominator.slice(0, -1).map((c, i) => c * (denominator.length - 1 - i));
  const residues = poles.map(p => div(poly(numerator, p), mul(p, poly(derivative, p))));
  const size = residues.reduce((v, c) => v + abs(c), 0);
  if (!Number.isFinite(size) || size > 1e5) throw new Error('The modal coefficients are too ill-conditioned for trustworthy response metrics. Move the design away from coincident poles.');
  const initial = residues.reduce((v, c) => add(v, c), real(1));
  const initialSlope = residues.reduce((v, c, i) => add(v, mul(c, poles[i])), real(0));
  if (abs(initial) > 1e-8 || abs(initialSlope) > 1e-7 * Math.max(1, ...poles.map(abs))) throw new Error('The response initial-condition check lost accuracy. Rescale the design.');
  for (const s of [{ re: .5, im: 2 }, { re: 1, im: 0 }, { re: 2, im: 1 }]) {
    const direct = div(poly(numerator, s), mul(s, poly(denominator, s)));
    const modal = residues.reduce((v, c, i) => add(v, div(c, add(s, neg(poles[i])))), div(real(1), s));
    if (abs(add(direct, neg(modal))) > 1e-8 * Math.max(1, abs(direct))) throw new Error('The full modal reconstruction did not agree with the transfer. Move away from this conditioning case.');
  }
  const roundoff = 64 * Number.EPSILON * (1 + size) + 1e-12;
  const at = (t: number, slope: boolean) => {
    if (!Number.isFinite(t) || t < 0 || t > 200) throw new Error('Inspect time within 0–200 seconds.');
    if (t === 0) return 0; // Exact zero-state value/slope, after modal consistency gates.
    let y = slope ? 0 : 1;
    poles.forEach((p, i) => { const c = slope ? mul(residues[i], p) : residues[i]; y += Math.exp(p.re * t) * (c.re * Math.cos(p.im * t) - c.im * Math.sin(p.im * t)); });
    if (!Number.isFinite(y)) throw new Error('Response evaluation lost accuracy.'); return y;
  };
  return { poles, residues, roundoff, value: t => at(t, false), slope: t => at(t, true), tail: t => residues.reduce((v, c, i) => v + abs(c) * Math.exp(poles[i].re * t), roundoff) };
}
export type Metrics = { times: number[]; values: number[]; extrema: number[]; peak: number; peakTime: number; overshoot: number; overshootUpper: number; peakEstablished: boolean; settling?: number; lastOutside: number; tail: number; intervals: number; interpolationError: number };
const bisect = (f: (t: number) => number, a: number, b: number) => {
  let fa = f(a); if (fa === 0) return a; if (f(b) === 0) return b;
  for (let i = 0; i < 70; i++) { const mid = (a + b) / 2, fm = f(mid); if (fm === 0 || b - a < 1e-10) return mid; if (Math.sign(fa) === Math.sign(fm)) { a = mid; fa = fm; } else b = mid; }
  return (a + b) / 2;
};
function sample(r: Response, horizon: number, band: number, n: number): Metrics {
  const times = Array.from({ length: n + 1 }, (_, i) => horizon * i / n), values = times.map(r.value), slopes = times.map(r.slope), extrema = [0];
  let interpolationError = 0;
  for (let i = 0; i < n; i++) {
    interpolationError = Math.max(interpolationError, Math.abs(r.value((times[i] + times[i + 1]) / 2) - (values[i] + values[i + 1]) / 2));
    if (slopes[i] * slopes[i + 1] < 0) extrema.push(bisect(r.slope, times[i], times[i + 1]));
    else if (i && slopes[i] === 0 && slopes[i - 1] * slopes[i + 1] < 0) extrema.push(times[i]);
  }
  extrema.push(horizon);
  const candidates = extrema.map(t => ({ t, value: r.value(t) }));
  const peak = candidates.reduce((a, b) => b.value > a.value ? b : a);
  let lastOutside = 0;
  const outside = (y: number) => Math.abs(y - 1) > band;
  for (let i = 1; i < candidates.length; i++) {
    const a = candidates[i - 1], b = candidates[i];
    if (outside(b.value)) lastOutside = b.t;
    else if (outside(a.value)) { const level = a.value < 1 ? 1 - band : 1 + band; lastOutside = bisect(t => r.value(t) - level, a.t, b.t); }
  }
  const tail = r.tail(horizon), tolerance = 1e-4;
  return { times, values, extrema: extrema.slice(1, -1), peak: peak.value, peakTime: peak.t, overshoot: Math.max(0, peak.value - 1), overshootUpper: Math.max(0, peak.value + tolerance - 1, tail), peakEstablished: peak.value > 1 + tail + tolerance, settling: tail < band && !outside(values.at(-1)!) ? lastOutside : undefined, lastOutside, tail, intervals: n, interpolationError };
}
/** Refined numerical measurements plus a simple-pole future envelope. The
 * halving and interpolation tests are consistency checks, not interval proofs. */
export function measure(r: Response, horizon: number, band: number): Metrics {
  if (!Number.isFinite(horizon) || horizon < .1 || horizon > 200 || ![.01, .02, .05].includes(band)) throw new Error('Use horizon 0.1–200 s and a 1%, 2% or 5% settling band.');
  const maximum = 16384; let n = Math.max(128, Math.ceil(horizon * Math.max(...r.poles.map(abs)) * 8));
  if (n >= maximum) throw new Error('This horizon and pole scale exceed the response-grid limit. Shorten the horizon or reduce frequency.');
  let previous = sample(r, horizon, band, n);
  while (n < maximum) {
    n = Math.min(maximum, n * 2); const next = sample(r, horizon, band, n);
    const settled = previous.settling === undefined && next.settling === undefined || previous.settling !== undefined && next.settling !== undefined && Math.abs(previous.settling - next.settling) < 1e-4;
    if (Math.abs(next.peak - previous.peak) < 1e-4 && settled && next.interpolationError < 1e-4) return next;
    previous = next;
  }
  throw new Error('The response did not meet its refinement tolerance within 16,384 intervals. Change the horizon or move away from a fast/slow conditioning case.');
}
export type Decision = 'met' | 'failed' | 'unknown';
export function assess(metrics: Metrics | undefined, targetOvershoot: number, targetSettling: number) {
  if (!metrics) return { overshoot: 'unknown' as Decision, settling: 'unknown' as Decision, all: 'unknown' as Decision };
  const tolerance = 1e-4;
  const overshoot: Decision = metrics.overshoot > targetOvershoot / 100 + tolerance ? 'failed' : metrics.overshootUpper < targetOvershoot / 100 - tolerance ? 'met' : 'unknown';
  const settling: Decision = metrics.lastOutside > targetSettling + tolerance ? 'failed' : metrics.settling !== undefined && metrics.settling < targetSettling - tolerance ? 'met' : 'unknown';
  const all: Decision = overshoot === 'failed' || settling === 'failed' ? 'failed' : overshoot === 'met' && settling === 'met' ? 'met' : 'unknown';
  return { overshoot, settling, all };
}
