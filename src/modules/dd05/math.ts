/** Local DD05 design mathematics. Descending polynomial powers, no cancellation. */
export interface Complex { re: number; im: number }
export type Structure = 'pi' | 'pid';
export interface Plant { gain: number; tau: number }
export interface Gains { kp: number; ki: number; kd: number }
export interface Settings { plant: Plant; sensor: number; T: number; structure: Structure; reference: number; preweight: 'raw' | 'calibrated' }
export type Target = { mode: 'continuous'; zeta: number; wn: number } | { mode: 'discrete'; re: number; im: number };
export interface Desired { pair: Complex[]; extra: number | null; polynomial: number[]; radius: number; angle: number; continuous: { zeta: number; wn: number; decay: number; damped: number } | null }
export interface Model { settings: Settings; gains: Gains; a: number; b: number; F: number; q: number[]; polynomial: number[]; poles: Complex[] | null; stability: 'inside' | 'boundary' | 'outside' | 'unresolved'; rootError?: string }
export interface Design { desired: Desired; model: Model; residuals: number[]; issues: string[]; compatible: boolean }
export const DISK_BAND = 1e-8;
const ROUND = 64 * Number.EPSILON;
function range(value: number, lo: number, hi: number, label: string) {
  if (!Number.isFinite(value) || value < lo || value > hi) throw new Error(`${label} must be between ${lo} and ${hi}.`);
  return value;
}
export function validatePlant(plant: Plant): Plant {
  return { gain: range(plant.gain, .05, 100, 'Plant gain g'), tau: range(plant.tau, .01, 100, 'Plant time constant τ (s)') };
}
function validateSettings(p: Settings): Settings {
  const plant = validatePlant(p.plant); range(p.T, .001, 10, 'Sample period T (s)'); range(p.sensor, .001, 10, 'Sensor gain H'); range(p.reference, -10, 10, 'Step reference');
  if (p.T / plant.tau > 30) throw new Error('Use T/τ at most30 for this bounded exact-ZOH plant.');
  if (p.structure !== 'pi' && p.structure !== 'pid') throw new Error('Choose PI or PID.');
  if (p.preweight !== 'raw' && p.preweight !== 'calibrated') throw new Error('Choose the raw comparator reference or calibrated physical reference.');
  return { ...p, plant };
}
export function poleStatus(p: Complex): 'inside' | 'boundary' | 'outside' {
  const r = Math.hypot(p.re, p.im); return r > 1 + DISK_BAND ? 'outside' : r >= 1 - DISK_BAND ? 'boundary' : 'inside';
}
function quadratic(p: number[]): Complex[] {
  const [a, b, c] = p, discriminant = b * b - 4 * a * c, noise = ROUND * (b * b + Math.abs(4 * a * c));
  if (discriminant !== 0 && Math.abs(discriminant) <= noise) throw new Error('Nearly repeated roots are numerically unresolved at this coefficient precision.');
  if (discriminant < 0) { const im = Math.sqrt(-discriminant) / (2 * Math.abs(a)); return [{ re: -b / (2 * a), im }, { re: -b / (2 * a), im: -im }]; }
  if (discriminant === 0) return [{ re: -b / (2 * a), im: 0 }, { re: -b / (2 * a), im: 0 }];
  const q = -.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant)); return [{ re: q / a, im: 0 }, { re: c / q, im: 0 }];
}
function cMultiply(a: Complex, b: Complex): Complex { return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }; }
function evaluate(p: number[], z: Complex) {
  let value: Complex = { re: 0, im: 0 };
  for (const coefficient of p) { value = cMultiply(value, z); value.re += coefficient; }
  return Math.hypot(value.re, value.im);
}
/** Complete degree1–3 roots; stable quadratic deflation, cubic real solution,
 * scaled residuals and a full Vieta check. Conditioning failure is explicit. */
export function polynomialRoots(p: number[]): Complex[] {
  if (p.length < 2 || p.length > 4 || p[0] !== 1 || p.some(x => !Number.isFinite(x) || Math.abs(x) > 1e6)) throw new Error('Use a monic degree1–3 polynomial with finite coefficients of magnitude at most1e6.');
  let values: Complex[];
  if (p.length === 2) values = [{ re: -p[1], im: 0 }];
  else if (p[p.length - 1] === 0) values = [...polynomialRoots(p.slice(0, -1)), { re: 0, im: 0 }];
  else if (p.length === 3) values = quadratic(p);
  else {
    const [, a, b, c] = p, depressedP = b - a * a / 3, depressedQ = 2 * a ** 3 / 27 - a * b / 3 + c;
    const q2 = (depressedQ / 2) ** 2, p3 = (depressedP / 3) ** 3, delta = q2 + p3;
    if (delta !== 0 && Math.abs(delta) <= ROUND * (Math.abs(q2) + Math.abs(p3))) throw new Error('Nearly repeated cubic roots are numerically unresolved at this coefficient precision.');
    if (delta < 0) {
      const size = 2 * Math.sqrt(-depressedP / 3), cosine = -depressedQ / (2 * Math.sqrt(-((depressedP / 3) ** 3)));
      if (Math.abs(cosine) > 1 + ROUND) throw new Error('Cubic angle conditioning is unresolved.');
      const angle = Math.acos(Math.max(-1, Math.min(1, cosine)));
      values = [0, 1, 2].map(k => ({ re: size * Math.cos((angle + 2 * k * Math.PI) / 3) - a / 3, im: 0 }));
    } else if (delta === 0) {
      const u = Math.cbrt(-depressedQ / 2); values = [{ re: 2 * u - a / 3, im: 0 }, { re: -u - a / 3, im: 0 }, { re: -u - a / 3, im: 0 }];
    } else {
      const u = Math.cbrt(-depressedQ / 2 - (depressedQ < 0 ? -1 : 1) * Math.sqrt(delta)), v = u === 0 ? 0 : -depressedP / (3 * u);
      let real = u + v - a / 3;
      for (let step = 0; step < 8; step++) {
        const f = ((real + a) * real + b) * real + c, derivative = (3 * real + 2 * a) * real + b;
        if (derivative === 0) break;
        const next = real - f / derivative;
        if (!Number.isFinite(next) || Math.abs(((next + a) * next + b) * next + c) > Math.abs(f)) break;
        real = next;
      }
      if (real === 0) throw new Error('Cubic deflation is numerically unresolved.');
      values = [{ re: real, im: 0 }, ...quadratic([1, a + real, -c / real])];
    }
  }
  for (const z of values) {
    const r = Math.hypot(z.re, z.im), scale = p.reduce((s, coefficient, i) => s + Math.abs(coefficient) * r ** (p.length - i - 1), 0);
    if (!Number.isFinite(r) || evaluate(p, z) > 1e-8 * Math.max(1, scale)) throw new Error('The complete root residual check failed; roots are unavailable.');
  }
  let reconstructed: Complex[] = [{ re: 1, im: 0 }];
  for (const z of values) {
    const next = Array.from({ length: reconstructed.length + 1 }, () => ({ re: 0, im: 0 }));
    reconstructed.forEach((coefficient, i) => { next[i].re += coefficient.re; next[i].im += coefficient.im; const term = cMultiply(coefficient, z); next[i + 1].re -= term.re; next[i + 1].im -= term.im; });
    reconstructed = next;
  }
  if (reconstructed.some((z, i) => Math.hypot(z.re - p[i], z.im) > 1e-8 * Math.max(1, ...p.map(Math.abs)))) throw new Error('The full Vieta reconstruction is unresolved; no complete pole set is certified.');
  return values;
}
export function desiredRoots(target: Target, T: number, structure: Structure, extra: number): Desired {
  range(T, .001, 10, 'Sample period T (s)');
  let re: number, im: number, continuous: Desired['continuous'] = null;
  if (target.mode === 'continuous') {
    const zeta = range(target.zeta, .05, .9999, 'Damping ratio ζ'), wn = range(target.wn, .01, 20, 'Natural frequency ωn (rad/s)'), decay = zeta * wn, damped = wn * Math.sqrt(1 - zeta * zeta);
    if (decay * T > 20) throw new Error('Use ζ ωn T at most20 to retain a resolvable target radius.');
    if (damped * T >= Math.PI) throw new Error('The desired damped frequency is at/above Nyquist for this T. Reduce T or the target frequency; aliased roots do not uniquely represent that continuous oscillation.');
    const radius = Math.exp(-decay * T), angle = damped * T; re = radius * Math.cos(angle); im = radius * Math.sin(angle); continuous = { zeta, wn, decay, damped };
  } else if (target.mode === 'discrete') { re = range(target.re, -.9999, .9999, 'Target real part'); im = range(target.im, 1e-5, .9999, 'Positive target imaginary part'); }
  else throw new Error('Choose mapped continuous targets or a direct discrete pair.');
  const radius = Math.hypot(re, im), angle = Math.atan2(im, re);
  if (radius < 1e-5 || radius >= 1 - DISK_BAND || im < 1e-5) throw new Error('Use a distinct complex pair with radius at least1e-5, strictly inside the disk and imaginary part at least1e-5. Repeated/under-resolved target pairs are outside this bounded design.');
  const pair = [{ re, im }, { re, im: -im }], quadratic = [1, -2 * re, radius * radius];
  if (structure === 'pi') return { pair, extra: null, polynomial: quadratic, radius, angle, continuous };
  if (structure !== 'pid') throw new Error('Choose PI or PID.');
  range(extra, -.95, .95, 'Additional PID pole');
  return { pair, extra, polynomial: [1, quadratic[1] - extra, quadratic[2] - extra * quadratic[1], -extra * quadratic[2]], radius, angle, continuous };
}
export function createModel(settings: Settings, gains: Gains): Model {
  const p = validateSettings(settings);
  for (const [name, gain] of Object.entries(gains)) range(gain, -1000, 1000, `Controller ${name}`);
  if (p.structure === 'pi' && gains.kd !== 0) throw new Error('PI has no derivative state: enter Kd=0 or select PID.');
  const a = Math.exp(-p.T / p.plant.tau), b = p.plant.gain * -Math.expm1(-p.T / p.plant.tau), F = p.preweight === 'raw' ? 1 : p.sensor;
  const derivative = gains.kd / p.T, q = p.structure === 'pi' ? [gains.kp + gains.ki * p.T, -gains.kp] : [gains.kp + gains.ki * p.T + derivative, -gains.kp - 2 * derivative, derivative];
  if (q.some(x => !Number.isFinite(x) || Math.abs(x) > 1e5)) throw new Error('Increment coefficients must have magnitude at most1e5. Rescale the gains or T.');
  const hb = p.sensor * b, polynomial = p.structure === 'pi' ? [1, -(1 + a) + hb * q[0], a + hb * q[1]] : [1, -(1 + a) + hb * q[0], a + hb * q[1], hb * q[2]];
  let poles: Complex[] | null = null, rootError: string | undefined;
  try { poles = polynomialRoots(polynomial); } catch (error) { rootError = (error as Error).message; }
  const statuses = poles?.map(poleStatus), stability = !statuses ? 'unresolved' : statuses.includes('outside') ? 'outside' : statuses.includes('boundary') ? 'boundary' : 'inside';
  return { settings: p, gains: { ...gains }, a, b, F, q, polynomial, poles, stability, rootError };
}
export function assess(model: Model, desired: Desired, tracking: 'comparator' | 'physical', nonnegative: boolean): Pick<Design, 'residuals' | 'issues' | 'compatible'> {
  if (tracking !== 'comparator' && tracking !== 'physical') throw new Error('Choose comparator or physical tracking error.');
  const p = model.settings, issues: string[] = [], sameOrder = model.polynomial.length === desired.polynomial.length;
  const residuals = sameOrder ? model.polynomial.map((x, i) => x - desired.polynomial[i]) : [];
  const scale = Math.max(1, ...desired.polynomial.map(Math.abs));
  if (!sameOrder) issues.push('The full characteristic orders differ. A target pair alone does not specify every PID mode.');
  else if (residuals.some(x => Math.abs(x) > 1e-8 * scale)) issues.push('The full coefficient residual exceeds1e-8 relative scale.');
  if (model.stability !== 'inside') issues.push('Every full closed-loop pole must be resolved strictly inside the disk for a stable tracking design.');
  if (nonnegative && Object.values(model.gains).some(x => x < -1e-10)) issues.push('This controller uses a negative PID gain, incompatible with the selected nonnegative-gain constraint.');
  if (tracking === 'physical' && p.reference !== 0 && Math.abs(model.F / p.sensor - 1) > 1e-9) issues.push('Zero physical tracking error is incompatible with raw F=1 and H≠1 under integral comparator control. Select calibrated F=H or change the constraint.');
  return { residuals, issues, compatible: issues.length === 0 };
}
export function design(settings: Settings, target: Target, extra: number, tracking: 'comparator' | 'physical', nonnegative: boolean): Design {
  const p = validateSettings(settings), desired = desiredRoots(target, p.T, p.structure, extra), a = Math.exp(-p.T / p.plant.tau), b = p.plant.gain * -Math.expm1(-p.T / p.plant.tau), hb = p.sensor * b;
  const q = p.structure === 'pi' ? [(desired.polynomial[1] + 1 + a) / hb, (desired.polynomial[2] - a) / hb] : [(desired.polynomial[1] + 1 + a) / hb, (desired.polynomial[2] - a) / hb, desired.polynomial[3] / hb];
  const kd = p.structure === 'pid' ? q[2] * p.T : 0, kp = -q[1] - (p.structure === 'pid' ? 2 * q[2] : 0), ki = q.reduce((s, x) => s + x, 0) / p.T;
  const model = createModel(p, { kp, ki, kd });
  return { desired, model, ...assess(model, desired, tracking, nonnegative) };
}
export interface Sample { k: number; time: number; output: number; comparator: number; physical: number; control: number | null; incrementResidual: number | null }
export interface Performance { samples: Sample[]; limit: number | null; comparatorLimit: number | null; physicalLimit: number | null; overshoot: number | null; rise: number | null; settlingCandidate: number | null; controlEnergy: number; horizon: number }
export function simulate(model: Model, intervals: number): Performance {
  range(intervals, 10, 2000, 'Simulation interval count'); if (!Number.isInteger(intervals)) throw new Error('Use an integer simulation interval count.');
  if (!model.poles) throw new Error(model.rootError ?? 'Complete roots are required before simulating.');
  const { T, sensor: H, reference: R } = model.settings, order = model.polynomial.length - 1, input = model.F * R;
  const radius = Math.max(...model.poles.map(p => Math.hypot(p.re, p.im))) + Math.sqrt(ROUND) * Math.max(1, ...model.polynomial.map(Math.abs));
  const weights = Array.from({ length: intervals }, (_, lag) => (order === 3 ? (lag + 1) * (lag + 2) / 2 : lag + 1) * radius ** lag), defects: number[] = [], errors = [0];
  const samples: Sample[] = []; let output = 0, previousControl = 0, previousError = 0, secondError = 0, controlEnergy = 0;
  for (let k = 0; k < intervals; k++) {
    const error = input - H * output, terms = [previousControl, model.q[0] * error, model.q[1] * previousError, (model.q[2] ?? 0) * secondError], control = terms.reduce((s, x) => s + x, 0);
    const next = model.a * output + model.b * control;
    if (![output, error, control, next].every(x => Number.isFinite(x) && Math.abs(x) <= 1e12)) throw new Error('Response/output/control exceeds magnitude1e12; no partial performance is reported. Shorten the horizon or change the candidate.');
    let recurrence = 0, absoluteTerms = 0;
    for (let i = 1; i <= order; i++) {
      const prior = i === 1 ? output : samples[k + 1 - i]?.output ?? 0, feedback = -model.polynomial[i] * prior, forcing = k + 1 >= i ? model.b * input * model.q[i - 1] : 0;
      recurrence += feedback + forcing; absoluteTerms += Math.abs(feedback) + Math.abs(forcing);
    }
    defects.push(Math.abs(next - recurrence) + ROUND * (absoluteTerms + Math.abs(model.a * output) + Math.abs(model.b * control)));
    let estimate = 0;
    for (let j = 0; j <= k; j++) if (defects[j] !== 0) estimate += defects[j] * weights[k - j];
    const controlEstimate = (estimate + Math.abs(model.a) * errors[k] + ROUND * (Math.abs(next) + Math.abs(model.a * output))) / model.b;
    if (!Number.isFinite(estimate) || estimate > 1e-7 * Math.max(1, Math.abs(next)) || controlEstimate > 1e-7 * Math.max(1, Math.abs(control))) throw new Error('Roundoff amplification makes this response/effort numerically unresolved. Reduce the horizon or separate cancelling modes; no partial performance is reported.');
    errors.push(estimate);
    samples.push({ k, time: k * T, output, comparator: error, physical: R - output, control, incrementResidual: control - previousControl - model.q[0] * error - model.q[1] * previousError - (model.q[2] ?? 0) * secondError });
    controlEnergy += T * control * control;
    if (!Number.isFinite(controlEnergy) || controlEnergy > 1e28) throw new Error('Held-control energy exceeds1e28; no partial performance is reported.');
    previousControl = control; secondError = previousError; previousError = error; output = next;
  }
  samples.push({ k: intervals, time: intervals * T, output, comparator: input - H * output, physical: R - output, control: null, incrementResidual: null });
  const integralActive = Math.abs(model.q.reduce((s, x) => s + x, 0)) > ROUND * model.q.reduce((s, x) => s + Math.abs(x), 0);
  const limit = model.stability === 'inside' && integralActive ? model.F * R / H : null;
  let overshoot: number | null = null, rise: number | null = null, settlingCandidate: number | null = null;
  if (limit !== null && limit !== 0) {
    const normalized = samples.map(s => s.output / limit), ten = normalized.findIndex(y => y >= .1), ninety = normalized.findIndex(y => y >= .9);
    overshoot = 100 * Math.max(0, Math.max(...normalized) - 1); if (ten >= 0 && ninety >= 0) rise = (ninety - ten) * T;
    let last = -1; normalized.forEach((y, k) => { if (Math.abs(y - 1) > .02) last = k; }); if (last < intervals) settlingCandidate = (last + 1) * T;
  }
  return { samples, limit, comparatorLimit: limit === null ? null : 0, physicalLimit: limit === null ? null : R - limit, overshoot, rise, settlingCandidate, controlEnergy, horizon: intervals * T };
}
