import { rejectSpacingArguments } from '../../shared/tex-arguments';

/** Local bounded factor arithmetic. All frequency results are numerical, not a CAS. */
export type FrequencyUnit = 'rad/s' | 'Hz';
export interface Factor {
  readonly kind: 'first' | 'second'; readonly position: 'zero' | 'pole';
  /** Raw ascending coefficients a0 + a1*s + a2*s^2; a2=0 for first order. */
  readonly a0: number; readonly a1: number; readonly a2: number;
}
export interface Model { readonly gain: number; readonly originPower: number; readonly delay: number; readonly factors: readonly Factor[] }
export interface NormalizedFactor { readonly corner: number; readonly order: number; readonly direction: number; readonly phaseSign: number; readonly damping?: number }
export interface Contribution { readonly db: number; readonly phase: number; readonly asymptoteDb: number; readonly asymptotePhase: number }
export interface Response extends Contribution { readonly magnitude: number; readonly asymptoteMagnitude: number; readonly contributions: readonly Contribution[] }
export interface Prediction { readonly gain: number; readonly corners: readonly number[] }
export const MIN_FREQUENCY = 1e-4, MAX_FREQUENCY = 1e4;
const degrees = 180 / Math.PI;
const clamp = (x: number, low: number, high: number): number => Math.max(low, Math.min(high, x));

function parseScalar(source: string): number {
  rejectSpacingArguments(source);
  const s = source.replace(/\s|\\[,;!]/g, '').replace(/−/g, '-').replace(/\\(?:dfrac|tfrac)/g, '\\frac').replace(/\\(?:left|right)/g, '');
  if (!s || s.length > 90) throw new Error('Enter one real number, decimal or simple fraction.');
  const decimal = (part: string): number => {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(part) || part.replace(/\D/g, '').length > 12 || (part.split('.')[1]?.length ?? 0) > 9) {
      throw new Error('Use integers, decimals (up to 9 decimal places), or simple fractions; expressions and symbols are unsupported.');
    }
    return Number(part);
  };
  const grouped = (text: string): boolean => {
    const open = text[0], close = open === '(' ? ')' : open === '{' ? '}' : '';
    if (!close || !text.endsWith(close)) return false;
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === open) depth++; else if (text[i] === close) depth--;
      if (depth === 0 && i !== text.length - 1) return false;
      if (depth < 0) return false;
    }
    return depth === 0;
  };
  const scalar = (text: string, depth: number): number => {
    if (depth > 8) throw new Error('Use at most eight outer groups or unary signs.');
    if (grouped(text)) return scalar(text.slice(1, -1), depth + 1);
    if (text.startsWith('-') || text.startsWith('+')) return (text[0] === '-' ? -1 : 1) * scalar(text.slice(1), depth + 1);
    const fraction = /^\\frac(\{[^{}]+\}|\d)(\{[^{}]+\}|\d)$/.exec(text);
    const slash = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\/([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/.exec(text);
    if (fraction || slash) {
      const argument = (part: string): string => part.startsWith('{') ? part.slice(1, -1) : part;
      const numerator = decimal(fraction ? argument(fraction[1]) : slash![1]);
      const denominator = decimal(fraction ? argument(fraction[2]) : slash![2]);
      if (!denominator) throw new Error('A fraction denominator cannot be zero.');
      return numerator / denominator;
    }
    return decimal(text);
  };
  const value = scalar(s, 0);
  if (!Number.isFinite(value)) throw new Error('Enter a finite number.');
  return value;
}
export function parseReal(source: string): number {
  const value = parseScalar(source);
  if (!Number.isFinite(value) || Math.abs(value) > 1e6 || (value !== 0 && Math.abs(value) < 1e-6)) {
    throw new Error('Use zero or a number with magnitude between 10⁻⁶ and 10⁶.');
  }
  return value;
}
export function parseDelay(source: string): number {
  const value = parseScalar(source);
  if (value < 0 || value > 10) throw new Error('Delay must be from 0 to 10 s.');
  return value;
}
export function frequency(value: number): void {
  if (!Number.isFinite(value) || value < MIN_FREQUENCY * (1 - 1e-12) || value > MAX_FREQUENCY * (1 + 1e-12)) throw new Error('Frequency must be from 0.0001 to 10,000 rad/s (or its equivalent in Hz).');
}
export const toAngular = (value: number, unit: FrequencyUnit): number => unit === 'Hz' ? value * 2 * Math.PI : value;
export const fromAngular = (value: number, unit: FrequencyUnit): number => unit === 'Hz' ? value / (2 * Math.PI) : value;
export const dbToLinear = (value: number): number => 10 ** (value / 20);
export function normalizeFactor(f: Factor): NormalizedFactor {
  if (!['first', 'second'].includes(f.kind) || !['zero', 'pole'].includes(f.position)) throw new Error('Choose a supported factor type and numerator/denominator position.');
  if (![f.a0, f.a1, f.a2].every(Number.isFinite) || [f.a0, f.a1, f.a2].some(x => Math.abs(x) > 1e6 || (x !== 0 && Math.abs(x) < 1e-6))) throw new Error('Factor coefficients must be finite and bounded between 10⁻⁶ and 10⁶ when nonzero.');
  if (f.a0 <= 0 || !f.a1 || (f.kind === 'first' && f.a2 !== 0) || (f.kind === 'second' && (f.a1 <= 0 || f.a2 <= 0))) throw new Error('Use a0>0, nonzero a1 for first order; second order requires all three positive coefficients.');
  const corner = f.kind === 'first' ? Math.abs(f.a0 / f.a1) : Math.sqrt(f.a0 / f.a2); frequency(corner);
  const damping = f.kind === 'second' ? f.a1 / (2 * Math.sqrt(f.a0 * f.a2)) : undefined;
  if (damping !== undefined && (damping < 0.05 - 1e-12 || damping > 1 + 1e-12)) throw new Error('Quadratic factors support 0.05 ≤ damping ratio ≤ 1. Enter overdamped real poles as separate first-order factors.');
  return { corner, order: f.kind === 'first' ? 1 : 2, direction: f.position === 'zero' ? 1 : -1, phaseSign: f.kind === 'first' && f.a1 < 0 ? -1 : 1, damping };
}
export function normalize(model: Model): { readonly gain: number; readonly factors: readonly NormalizedFactor[] } {
  if (!Number.isFinite(model.gain) || Math.abs(model.gain) < 1e-6 || Math.abs(model.gain) > 1e6) throw new Error('K must be nonzero with magnitude from 10⁻⁶ to 10⁶.');
  if (!Number.isInteger(model.originPower) || Math.abs(model.originPower) > 3) throw new Error('The origin power must be an integer from −3 to 3.');
  if (!Number.isFinite(model.delay) || model.delay < 0 || model.delay > 10) throw new Error('Delay must be from 0 to 10 s.');
  if (!Array.isArray(model.factors) || model.factors.length > 6) throw new Error('Use at most six first/second-order factors.');
  const factors = model.factors.map(normalizeFactor);
  const gain = model.factors.reduce((value, f, i) => value * f.a0 ** factors[i].direction, model.gain);
  return { gain, factors };
}
function asymptoticFactor(f: NormalizedFactor, omega: number, corner = f.corner): { db: number; phase: number } {
  const decades = Math.log10(omega / corner);
  return { db: f.direction * f.order * 20 * Math.max(0, decades), phase: f.direction * f.phaseSign * f.order * 90 * clamp((decades + 1) / 2, 0, 1) };
}
export function factorAt(factor: Factor, omega: number): Contribution {
  frequency(omega); const f = normalizeFactor(factor);
  const real = (factor.a0 - factor.a2 * omega ** 2) / factor.a0, imaginary = factor.a1 * omega / factor.a0;
  const asymptote = asymptoticFactor(f, omega);
  return { db: f.direction * 20 * Math.log10(Math.hypot(real, imaginary)), phase: f.direction * Math.atan2(imaginary, real) * degrees,
    asymptoteDb: asymptote.db, asymptotePhase: asymptote.phase };
}
export function responseAt(model: Model, omega: number): Response {
  frequency(omega); const normalized = normalize(model), contributions = model.factors.map(f => factorAt(f, omega));
  const baseDb = 20 * Math.log10(Math.abs(normalized.gain)) + 20 * model.originPower * Math.log10(omega);
  const basePhase = (model.gain < 0 ? 180 : 0) + 90 * model.originPower - model.delay * omega * degrees;
  const sum = (key: keyof Contribution): number => contributions.reduce((value, c) => value + c[key], 0);
  const db = baseDb + sum('db'), asymptoteDb = baseDb + sum('asymptoteDb');
  return { db, phase: basePhase + sum('phase'), asymptoteDb, asymptotePhase: basePhase + sum('asymptotePhase'),
    magnitude: dbToLinear(db), asymptoteMagnitude: dbToLinear(asymptoteDb), contributions };
}
export function validatePrediction(model: Model, prediction: Prediction): void {
  if (!Number.isFinite(prediction.gain) || prediction.gain < 1e-100 || prediction.gain > 1e100) throw new Error('Predict a positive normalization-gain magnitude from 10⁻¹⁰⁰ to 10¹⁰⁰.');
  if (prediction.corners.length !== model.factors.length) throw new Error('Place one corner marker per factor.');
  prediction.corners.forEach(frequency);
}
export function predictionAt(model: Model, omega: number, prediction: Prediction): { db: number; phase: number } {
  frequency(omega); const normalized = normalize(model); validatePrediction(model, prediction);
  let db = 20 * Math.log10(prediction.gain) + 20 * model.originPower * Math.log10(omega);
  let phase = (model.gain < 0 ? 180 : 0) + 90 * model.originPower - model.delay * omega * degrees;
  normalized.factors.forEach((f, i) => { const contribution = asymptoticFactor(f, omega, prediction.corners[i]); db += contribution.db; phase += contribution.phase; });
  return { db, phase };
}
export function diagnosePrediction(model: Model, prediction: Prediction): string {
  const normalized = normalize(model); validatePrediction(model, prediction);
  const cornersMatch = normalized.factors.every((f, i) => Math.abs(Math.log10(prediction.corners[i] / f.corner)) <= 0.02);
  const offset = 20 * Math.log10(prediction.gain / Math.abs(normalized.gain));
  if (cornersMatch && Math.abs(offset) > 0.1) return `Corner markers match (within 0.02 decade), but the curve is shifted by ${offset.toFixed(3)} dB. Check gain normalization: extract every factor's a0 before combining K.`;
  if (!cornersMatch) return 'Check the corner markers: first order uses |a0/a1|; second order uses √(a0/a2). Markers are compared within 0.02 decade.';
  return 'Normalization gain (within 0.1 dB) and corner markers (within 0.02 decade) match the asymptotic construction.';
}
export function slopeIntervals(model: Model): { from: number; to: number; slope: number }[] {
  const normalized = normalize(model), events: { corner: number; change: number }[] = [];
  // Relative grouping matches the declared 10⁻¹² boundary resolution over all
  // supported frequency scales. Compare to the group anchor, not transitively.
  for (const factor of [...normalized.factors].sort((a, b) => a.corner - b.corner)) {
    const last = events[events.length - 1], change = 20 * factor.direction * factor.order;
    if (last && Math.abs(factor.corner - last.corner) <= 1e-12 * Math.max(factor.corner, last.corner)) last.change += change;
    else events.push({ corner: factor.corner, change });
  }
  const intervals: { from: number; to: number; slope: number }[] = []; let from = 0, slope = 20 * model.originPower;
  for (const { corner, change } of events) {
    intervals.push({ from, to: corner, slope });
    slope += change; from = corner;
  }
  intervals.push({ from, to: Infinity, slope }); return intervals;
}
export function frequencyGrid(low: number, high: number, count = 601): number[] {
  frequency(low); frequency(high);
  if (low >= high) throw new Error('The upper frequency must exceed the lower frequency.');
  if (!Number.isInteger(count) || count < 101 || count > 1201) throw new Error('Use 101–1,201 frequency points.');
  return Array.from({ length: count }, (_, i) => i === 0 ? low : i === count - 1 ? high : 10 ** (Math.log10(low) + i / (count - 1) * Math.log10(high / low)));
}
export const baseline = (): Model => ({ gain: 1, originPower: 0, delay: 0, factors: [
  { kind: 'first', position: 'pole', a0: 1, a1: 1, a2: 0 }, { kind: 'first', position: 'pole', a0: 2, a1: 1, a2: 0 },
] });
