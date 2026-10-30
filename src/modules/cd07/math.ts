export interface Plant { gain: number; tau: number; delay: number }
export type Kind = 'P' | 'PI' | 'PID';
export interface Controller { kp: number; ti: number | null; td: number }
export interface Measurement { delay: number; tau: number; slope: number }
export interface Trace { time: number[]; y: number[]; u: number[]; step: number }
export interface Metrics { overshoot: number; entry: number | null; endError: number; iae: number; peakEffort: number }
export interface CheckedResponse { trace: Trace; metrics: Metrics; discrepancy: number; effortDiscrepancy: number }

function range(n: number, lo: number, hi: number, name: string): void {
  if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(`${name} must be from ${lo} to ${hi}.`);
}
export function validatePlant(p: Plant): Plant {
  range(p.gain, .05, 20, 'Plant gain K'); range(p.tau, .2, 20, 'Time constant τ (s)');
  range(p.delay, .02, 10, 'Delay L (s)');
  if (p.delay / p.tau < .05 - 1e-12 || p.delay / p.tau > 1 + 1e-12) throw new Error('Use 0.05 ≤ L/τ ≤ 1 for this reaction-curve exercise.');
  return p;
}
export function measure(p: Plant, lower: number, upper: number): Measurement {
  validatePlant(p); range(lower, .02, 10, 'Zero-intercept marker (s)');
  const tau = upper - lower;
  range(tau, .2, 20, 'Difference between tangent markers (s)');
  validatePlant({ gain: p.gain, tau, delay: lower });
  return { delay: lower, tau, slope: p.gain / tau };
}
export function tune(p: Plant, m: Measurement, kind: Kind): Controller {
  validatePlant(p);
  const checked = measure(p, m.delay, m.delay + m.tau);
  if (!['P', 'PI', 'PID'].includes(kind)) throw new Error('Select P, PI or PID.');
  const factor = kind === 'P' ? 1 : kind === 'PI' ? .9 : 1.2;
  return { kp: factor * checked.tau / (p.gain * checked.delay), ti: kind === 'P' ? null : kind === 'PI' ? checked.delay / .3 : 2 * checked.delay, td: kind === 'PID' ? .5 * checked.delay : 0 };
}
export function validateController(c: Controller): Controller {
  range(c.kp, .001, 500, 'Controller Kp');
  if (c.ti !== null) range(c.ti, .01, 100, 'Integral time Ti (s)');
  range(c.td, 0, 10, 'Derivative time Td (s)');
  if (c.ti === null && c.td !== 0) throw new Error('Choose P, PI or PID; a derivative-only addition is outside this exercise.');
  return c;
}
export function openResponse(p: Plant, t: number): number {
  return t <= p.delay ? 0 : p.gain * -Math.expm1(-(t - p.delay) / p.tau);
}

/** Method of steps, RK4 + linear interpolation of past control. The pure delay
 * is retained. The mesh divides L exactly and handles the initial control jump
 * using the left limit at the first delayed step's endpoint. No Padé model. */
function integrate(p: Plant, c: Controller, horizon: number, cells: number): Trace {
  const h = p.delay / cells, count = Math.ceil(horizon / h - 1e-9);
  if (count > 100000) throw new Error('This horizon/gain/filter needs over 100,000 time steps. Shorten the horizon or use a slower controller.');
  const time = [0], y = [0], u = [c.kp * (1 + (c.td ? 10 : 0))];
  let state = [0, 0, 0];
  const output = (s: number[]) => c.kp * (1 - s[0] + (c.ti === null ? 0 : s[1] / c.ti) + (c.td === 0 ? 0 : 10 * (1 - s[0] - s[2])));
  function past(t: number, left: boolean): number {
    const q = t / h - cells;
    if (q < -1e-8 || (left && Math.abs(q) < 1e-8)) return 0;
    const i = Math.max(0, Math.floor(q + 1e-10));
    const f = Math.max(0, Math.min(1, q - i));
    return u[i] + f * ((u[i + 1] ?? u[i]) - u[i]);
  }
  const rhs = (s: number[], t: number, left = false) => [(-s[0] + p.gain * past(t, left)) / p.tau, c.ti === null ? 0 : 1 - s[0], c.td === 0 ? 0 : (1 - s[0] - s[2]) / (c.td / 10)];
  const shifted = (a: number[], k: number[], scale: number) => a.map((v, i) => v + scale * k[i]);
  for (let n = 0; n < count; n++) {
    const t = n * h, dt = Math.min(h, horizon - t);
    const a = rhs(state, t), b = rhs(shifted(state, a, dt / 2), t + dt / 2);
    const d = rhs(shifted(state, b, dt / 2), t + dt / 2), e = rhs(shifted(state, d, dt), t + dt, true);
    state = state.map((v, i) => v + dt / 6 * (a[i] + 2 * b[i] + 2 * d[i] + e[i]));
    const control = output(state);
    if ([...state, control].some(v => !Number.isFinite(v) || Math.abs(v) > 1e4)) throw new Error('The response grows beyond the 10,000-unit numerical limit. No performance result is reported. Reduce gains or shorten the horizon.');
    time.push(Math.min(horizon, (n + 1) * h)); y.push(state[0]); u.push(control);
  }
  return { time, y, u, step: h };
}
export function metrics(trace: Trace, p: Plant): Metrics {
  let peak = 0, effort = 0, iae = 0, lastOutside = -1;
  trace.y.forEach((v, i) => {
    peak = Math.max(peak, v); effort = Math.max(effort, Math.abs(trace.u[i]));
    if (Math.abs(1 - v) > .02) lastOutside = i;
    if (i) iae += .5 * (Math.abs(1 - v) + Math.abs(1 - trace.y[i - 1])) * (trace.time[i] - trace.time[i - 1]);
  });
  const candidate = trace.time[lastOutside + 1];
  const end = trace.time.at(-1)!;
  return { overshoot: Math.max(0, peak - 1) * 100, entry: candidate !== undefined && end - candidate >= Math.max(p.tau, 2 * p.delay) ? candidate : null, endError: 1 - trace.y.at(-1)!, iae, peakEffort: effort };
}
function interpolate(trace: Trace, values: number[], t: number): number {
  const i = Math.min(values.length - 2, Math.floor(t / trace.step));
  const f = (t - trace.time[i]) / (trace.time[i + 1] - trace.time[i]);
  return values[i] * (1 - f) + values[i + 1] * f;
}
export function simulate(p: Plant, c: Controller, horizon: number): CheckedResponse {
  validatePlant(p); validateController(c); range(horizon, 1, 200, 'Observation horizon (s)');
  // Resolve the filtered step kick before interpolating it through the delay.
  const target = Math.min(p.tau / 100, p.delay / 40, c.ti === null ? Infinity : c.ti / 60, c.td === 0 ? Infinity : c.td / 480);
  const cells = Math.ceil(p.delay / target);
  const coarse = integrate(p, c, horizon, cells), fine = integrate(p, c, horizon, cells * 2);
  let discrepancy = 0, effortDiscrepancy = 0;
  coarse.time.forEach((t, i) => {
    const v = interpolate(fine, fine.y, t), control = interpolate(fine, fine.u, t);
    discrepancy = Math.max(discrepancy, Math.abs(v - coarse.y[i]) / Math.max(1, Math.abs(v)));
    effortDiscrepancy = Math.max(effortDiscrepancy, Math.abs(control - coarse.u[i]) / Math.max(1, Math.abs(control)));
  });
  if (discrepancy > .002 || effortDiscrepancy > .005) throw new Error(`Time-step refinement did not resolve this response (output difference ${(100 * discrepancy).toPrecision(3)}%, effort ${(100 * effortDiscrepancy).toPrecision(3)}%; limits 0.2% and 0.5%). Reduce gains, slow the filter or shorten the horizon.`);
  return { trace: fine, metrics: metrics(fine, p), discrepancy, effortDiscrepancy };
}
