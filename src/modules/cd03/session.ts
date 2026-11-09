import { model, validate, type Design } from './model';
import { assess, measure, response, type Metrics, type Response } from './response';

export interface Requirements { kv: number; overshoot: number; settling: number; horizon: number; band: number }
interface Signal { readonly key: string; readonly response?: Response; readonly issue: string }
interface Channel { readonly signal: Signal; readonly horizon: number; readonly band: number; readonly metrics?: Metrics; readonly issue: string }
export interface Checked {
  readonly design: Design;
  readonly model: ReturnType<typeof model>;
  readonly requirements: Requirements;
  readonly baseline: Channel;
  readonly full: Channel;
  readonly assessment: ReturnType<typeof reassess>;
}
const problem = (error: unknown) => error instanceof Error ? error.message : 'The complete response is unavailable.';
const key = (d: Design) => JSON.stringify([d.a, d.b, d.k, d.lag, d.p, d.z]);
export const baselineDesign = (): Design => ({ a: 2, b: 1, k: 4, lag: false, p: .01, z: .1 });
export const initialRequirements = (): Requirements => ({ kv: 20, overshoot: 20, settling: 4.5, horizon: 20, band: .02 });
export function validateRequirements(r: Requirements): void {
  for (const [value, low, high, name] of [[r.kv, .05, 10000, 'Required Kv'], [r.overshoot, 0, 99, 'Overshoot limit'], [r.settling, .1, 200, 'Settling limit'], [r.horizon, .1, 200, 'Measurement horizon']] as const) {
    if (!Number.isFinite(value) || value < low || value > high) throw new Error(name + ' must be from ' + low + ' to ' + high + '.');
  }
  if (![.01, .02, .05].includes(r.band)) throw new Error('Use a 1%, 2% or 5% settling band.');
}
/** Preserve the original UI's finite corner bounds, including inactive drafts. */
export function validateDesign(d: Design): void {
  validate(d);
  if (![d.p, d.z].every(value => value >= .001 && value <= 5)) throw new Error('Draft pole and zero rates must be from .001 to 5 per second.');
}
function signal(signalKey: string, make: () => Response, previous?: Signal): Signal {
  if (previous?.key === signalKey) return previous;
  try { return { key: signalKey, response: make(), issue: '' }; }
  catch (error) { return { key: signalKey, issue: problem(error) }; }
}
function channel(source: Signal, r: Requirements, previous?: Channel): Channel {
  if (previous?.signal === source && previous.horizon === r.horizon && previous.band === r.band) return previous;
  if (!source.response) return { signal: source, horizon: r.horizon, band: r.band, issue: source.issue };
  try { return { signal: source, horizon: r.horizon, band: r.band, metrics: measure(source.response, r.horizon, r.band), issue: '' }; }
  catch (error) { return { signal: source, horizon: r.horizon, band: r.band, issue: problem(error) }; }
}
/** Target assessment preserves the accepted unknown margins and future-tail policy. */
export function reassess(m: ReturnType<typeof model>, base: Metrics | undefined, full: Metrics | undefined, r: Requirements) {
  const baseline = assess(base, r.overshoot, r.settling), chosen = assess(full, r.overshoot, r.settling);
  const difference = m.kv - r.kv, tolerance = 1e-10 * Math.max(1, m.kv, r.kv);
  const accuracy = m.stability === 'unstable' ? 'failed' : m.stability === 'boundary' ? 'unknown' : m.kv === r.kv ? 'met' : Math.abs(difference) <= tolerance ? 'unknown' : difference > 0 ? 'met' : 'failed';
  const transient = m.stability === 'unstable' ? 'failed' : chosen.all;
  const prediction = accuracy === 'unknown' || transient === 'unknown' ? 'unknown' : accuracy === 'met' && transient === 'met' ? 'both' : accuracy === 'met' ? 'accuracy' : transient === 'met' ? 'transient' : 'neither';
  return { baseline, chosen, accuracy, transient, prediction };
}
/** One caller-owned previous result is sufficient; no cache or model is shared across visits. */
export function check(d: Design, requirements: Requirements, previous?: Checked): Checked {
  validateDesign(d); validateRequirements(requirements);
  const m = previous && key(previous.design) === key(d) ? previous.model : model(d);
  const baseKey = JSON.stringify([d.a, d.b, d.k]);
  const baseSignal = signal(baseKey, () => response([d.k * d.b], m.baselineDenominator, m.baselineRoots), previous?.baseline.signal);
  const base = channel(baseSignal, requirements, previous?.baseline);
  let full: Channel;
  if (!d.lag) full = base;
  else if (m.stability !== 'stable') full = { signal: { key: key(d), issue: 'The full loop is ' + (m.stability === 'unstable' ? 'unstable' : 'on/near the Routh boundary') + '. Step targets and the final ramp limit are not established.' }, horizon: requirements.horizon, band: requirements.band, issue: 'The full loop is ' + (m.stability === 'unstable' ? 'unstable' : 'on/near the Routh boundary') + '. Step targets and the final ramp limit are not established.' };
  else full = channel(signal(key(d), () => response(m.numerator, m.denominator, m.fullRoots), previous?.full.signal), requirements, previous?.full);
  return { design: { ...d }, model: m, requirements: { ...requirements }, baseline: base, full, assessment: reassess(m, base.metrics, full.metrics, requirements) };
}
/** The selected corner is an explicit parameter action, never a hidden controller redesign. */
export function moveCorner(d: Design, selection: 'p' | 'z' | 'ratio', value: number): Design {
  const next = { ...d };
  if (selection === 'ratio') {
    const ratio = d.z / d.p;
    if (!(ratio > 1 && ratio <= 1000)) throw new Error('A ratio-preserving lag move needs 1 < z/p ≤ 1000.');
    next.p = value; next.z = value * ratio;
  } else next[selection] = value;
  validateDesign(next); return next;
}
