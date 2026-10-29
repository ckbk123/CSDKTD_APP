import { polynomialRoots, type Complex } from './roots';
export type { Complex } from './roots';
export interface Plant { gain: number; p: number }
export type Controller = { kind: 'constant'; K: number } | { kind: 'corners'; K: number; zero: number; pole: number };
export interface Loop { numerator: number[]; denominator: number[] }
export interface Model extends Loop {
  plant: Plant; T: number; controller: Controller; a: number; h: number; b1: number; b0: number;
  cn: number[]; cd: number[]; closed: number[]; poles: Complex[]; stability: 'inside' | 'boundary' | 'outside';
}
export interface Frequency {
  angle: number; omega: number; warped: number; hz: number;
  status: 'finite' | 'zero' | 'pole' | 'indeterminate'; magnitude: number | null; db: number | null; phase: number | null; value: Complex | null;
}
export interface Crossing { angle: number; kind: 'crossing' | 'touch' | 'endpoint'; frequency: Frequency }
export interface Crossings { points: Crossing[]; continuum: boolean }
export interface FrequencyAnalysis {
  gain: Crossings; phase: Crossings;
  phaseMargins: { angle: number; degrees: number }[]; gainMargins: { angle: number; factor: number; db: number }[];
  bandwidth: { angle: number | null; points: Crossing[]; reason: string };
}
export const DISK_BAND = 1e-8;
const ROUND = 64 * Number.EPSILON;
const DROP_SQUARED = 10 ** (-3 / 10);
function bounded(value: number, low: number, high: number, label: string) {
  if (!Number.isFinite(value) || value < low || value > high) throw new Error(`${label} must be between ${low} and ${high}.`);
  return value;
}
export function validatePlant(plant: Plant): Plant {
  return { gain: bounded(plant.gain, .1, 20, 'Plant gain g'), p: bounded(plant.p, .1, 20, 'Plant pole rate p (1/s)') };
}
export function samplePeriod(T: number) { return bounded(T, .005, 2, 'Sample period T (s)'); }
export function poleStatus(z: Complex): Model['stability'] {
  const radius = Math.hypot(z.re, z.im); return radius > 1 + DISK_BAND ? 'outside' : radius >= 1 - DISK_BAND ? 'boundary' : 'inside';
}
function product(a: number[], b: number[]) {
  const p = Array<number>(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => { p[i + j] += x * y; })); return p;
}
export function unitPoint(angle: number): Complex {
  return angle === 0 ? { re: 1, im: 0 } : angle === Math.PI ? { re: -1, im: 0 } : { re: Math.cos(angle), im: Math.sin(angle) };
}
function evaluate(p: number[], z: Complex): Complex {
  let re = 0, im = 0;
  for (const c of p) { const next = re * z.re - im * z.im + c; im = re * z.im + im * z.re; re = next; }
  return { re, im };
}
export function coordinates(angle: number, T: number) {
  bounded(angle, 0, Math.PI, 'Angle Ω (rad/sample)'); samplePeriod(T);
  return { angle, omega: angle / T, hz: angle / (2 * Math.PI * T), warped: angle === Math.PI ? Infinity : 2 * Math.tan(angle / 2) / T };
}
export function fromWarped(nu: number, T: number) {
  samplePeriod(T);
  if (nu < 0 || Number.isNaN(nu)) throw new Error('Warped frequency must be nonnegative.');
  return coordinates(nu === Infinity ? Math.PI : 2 * Math.atan(nu * T / 2), T);
}
export function frequency(loop: Loop, angle: number, T: number): Frequency {
  const axes = coordinates(angle, T), z = unitPoint(angle), n = evaluate(loop.numerator, z), d = evaluate(loop.denominator, z);
  const nn = Math.hypot(n.re, n.im), dn = Math.hypot(d.re, d.im);
  const nTiny = nn <= ROUND * loop.numerator.reduce((s, x) => s + Math.abs(x), 0), dTiny = dn <= ROUND * loop.denominator.reduce((s, x) => s + Math.abs(x), 0);
  if (dTiny) return { ...axes, status: nTiny ? 'indeterminate' : 'pole', magnitude: null, db: null, phase: null, value: null };
  if (nTiny) return { ...axes, status: 'zero', magnitude: 0, db: -Infinity, phase: null, value: { re: 0, im: 0 } };
  const value = { re: (n.re * d.re + n.im * d.im) / dn ** 2, im: (n.im * d.re - n.re * d.im) / dn ** 2 }, magnitude = Math.hypot(value.re, value.im);
  return { ...axes, status: 'finite', magnitude, db: 20 * Math.log10(magnitude), phase: Math.atan2(value.im, value.re) * 180 / Math.PI, value };
}
export function createModel(plantInput: Plant, T: number, controller: Controller): Model {
  const plant = validatePlant(plantInput); samplePeriod(T);
  const x = plant.p * T;
  if (x > 20) throw new Error('Use pT at most20 so the exact ZOH coefficients remain resolved.');
  bounded(controller.K, .0001, 1000, 'Controller DC gain K');
  const a = Math.exp(-x), h = -Math.expm1(-x);
  // x-h and h-x*exp(-x) lose digits for small x. Their convergent series
  // are integrated ZOH moments, not a truncated continuous plant replacement.
  let f1: number, f0: number;
  if (x < .05) {
    let term = x * x / 2; f1 = term; f0 = term;
    for (let n = 3; n <= 18; n++) { term *= -x / n; f1 += term; f0 += (n - 1) * term; }
  } else { f1 = x - h; f0 = h - x * a; }
  const b1 = plant.gain / plant.p ** 2 * f1, b0 = plant.gain / plant.p ** 2 * f0;
  let cn: number[], cd: number[];
  if (controller.kind === 'constant') { cn = [controller.K]; cd = [1]; }
  else if (controller.kind === 'corners') {
    bounded(controller.zero, .0001, 1000, 'Zero time constant τz (s)'); bounded(controller.pole, .0001, 1000, 'Pole time constant τp (s)');
    const c = 2 / T, scale = 1 + c * controller.pole;
    cn = [controller.K * (1 + c * controller.zero) / scale, controller.K * (1 - c * controller.zero) / scale];
    cd = [1, (1 - c * controller.pole) / scale];
  } else throw new Error('Choose a constant or a first-order lead/lag controller.');
  if (cn.some(c => !Number.isFinite(c) || Math.abs(c) > 1e5)) throw new Error('Mapped controller coefficients exceed magnitude1e5. Reduce gain or corner separation.');
  const numerator = product(cn, [b1, b0]), denominator = product(cd, [1, -(1 + a), a]);
  const closed = denominator.map((x, i) => x + (numerator[i - (denominator.length - numerator.length)] ?? 0));
  const poles = polynomialRoots(closed), statuses = poles.map(poleStatus);
  const stability = statuses.includes('outside') ? 'outside' : statuses.includes('boundary') ? 'boundary' : 'inside';
  return { plant, T, controller: { ...controller }, a, h, b1, b0, cn, cd, numerator, denominator, closed, poles, stability };
}
/** Exact algebraic change of variable; coefficients descend in w. The RHP
 * zero 2/T represents z=∞ and must not be dropped as a continuous approximation. */
export function wPlanePlant(model: Model): Loop {
  const t = model.T / 2;
  return { numerator: [-t * t * (model.b1 - model.b0), -2 * t * model.b0, model.b1 + model.b0],
    denominator: [2 * t * t * (1 + model.a), 2 * t * model.h, 0] };
}
export function warpedPlantFrequency(model: Model, nu: number): Complex {
  bounded(nu, 0, 1e8, 'Finite warped frequency ν (rad/s)');
  const loop = wPlanePlant(model), z = { re: 0, im: nu }, n = evaluate(loop.numerator, z), d = evaluate(loop.denominator, z), square = d.re ** 2 + d.im ** 2;
  if (square === 0) throw new Error('The transformed plant has an integrator pole at ν=0.');
  return { re: (n.re * d.re + n.im * d.im) / square, im: (n.im * d.re - n.re * d.im) / square };
}
export interface DirectDesign { model: Model; omega: number; phaseMargin: number; requiredLead: number; ratio: number; warped: number; plantPhase: number; plantMagnitude: number }
/** Design against the exact sampled plant at a physical-frequency requirement.
 * Positive lead only, centered at crossover; full-loop checks remain separate. */
export function designDirect(plant: Plant, T: number, omega: number, phaseMargin: number): DirectDesign {
  samplePeriod(T); bounded(omega * T, .01, .9 * Math.PI, 'Crossover angle ωc T (rad/sample)'); bounded(phaseMargin, 5, 85, 'Requested phase margin (degrees)');
  const base = createModel(plant, T, { kind: 'constant', K: 1 }), at = frequency(base, omega * T, T);
  if (at.status !== 'finite') throw new Error('The exact sampled plant is singular at the requested crossover.');
  const plantPhase = at.phase! > 0 ? at.phase! - 360 : at.phase!, requiredLead = phaseMargin - (180 + plantPhase);
  if (requiredLead < .1 || requiredLead > 80) throw new Error(`This centered-lead route needs 0.1°–80° positive phase addition; this target needs ${requiredLead.toFixed(4)}°. Change the target or use the separate emulation route.`);
  const sine = Math.sin(requiredLead * Math.PI / 180), ratio = (1 + sine) / (1 - sine), root = Math.sqrt(ratio), warped = at.warped;
  const controller: Controller = { kind: 'corners', K: 1 / (at.magnitude! * root), zero: root / warped, pole: 1 / (root * warped) };
  return { model: createModel(plant, T, controller), omega, phaseMargin, requiredLead, ratio, warped, plantPhase, plantMagnitude: at.magnitude! };
}
/** |p(exp(jΩ))|², ascending coefficients in c=cosΩ, degree≤3. */
export function magnitudePolynomial(p: number[]): number[] {
  if (p.length > 4 || p.length < 1 || p.some(x => !Number.isFinite(x))) throw new Error('Frequency polynomials require finite degree at most3.');
  const a = [...p].reverse(), r = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) for (let j = 0; j + k < a.length; j++) r[k] += a[j] * a[j + k];
  return [r[0] - 2 * r[2], 2 * r[1] - 6 * r[3], 4 * r[2], 8 * r[3]];
}
function difference(a: number[], b: number[], multiplier = 1) { return a.map((x, i) => x - multiplier * b[i]); }
function polynomialValue(p: number[], c: number) { return p.reduceRight((s, x) => s * c + x, 0); }
/** Enumerate all real cosine roots analytically, with residual and conditioning checks. */
export function cosineRoots(input: number[]): { continuum: boolean; values: { cosine: number; repeated: boolean }[] } {
  const p = [...input];
  if (!p.length || p.length > 4 || p.some(x => !Number.isFinite(x))) throw new Error('Use a finite frequency polynomial of degree at most3.');
  while (p.length > 1 && p[p.length - 1] === 0) p.pop();
  if (p.length === 1) return { continuum: p[0] === 0, values: [] };
  const normalized = [...p].reverse().map(x => x / p[p.length - 1]);
  let roots: Complex[];
  try { roots = polynomialRoots(normalized); } catch { throw new Error('Frequency crossings are numerically unresolved at this coefficient precision. No complete crossing set is certified.'); }
  const values: { cosine: number; repeated: boolean }[] = [];
  for (const z of roots) {
    if (z.im !== 0 || z.re < -1 - ROUND || z.re > 1 + ROUND) continue;
    const cosine = Math.abs(z.re - 1) <= ROUND ? 1 : Math.abs(z.re + 1) <= ROUND ? -1 : z.re;
    if (Math.abs(polynomialValue(p, cosine)) > 1e-9 * p.reduce((s, x) => s + Math.abs(x), 0)) throw new Error('Frequency-root residual failed.');
    const repeated = roots.filter(r => r.im === 0 && Math.abs(r.re - z.re) <= ROUND * Math.max(1, Math.abs(z.re))).length > 1;
    if (!values.some(v => Math.abs(v.cosine - cosine) <= ROUND)) values.push({ cosine, repeated });
  }
  values.sort((a, b) => b.cosine - a.cosine); return { continuum: false, values };
}
function crossingSet(loop: Loop, p: number[], T: number, expectedMagnitude: number): Crossings {
  const solution = cosineRoots(p);
  const points = solution.values.map(v => {
    const angle = Math.acos(v.cosine), at = frequency(loop, angle, T);
    if (at.status !== 'finite' || Math.abs(at.magnitude! - expectedMagnitude) > 1e-6 * Math.max(1, expectedMagnitude)) throw new Error('A frequency crossing is too close to a singularity or endpoint to resolve accurately. No complete set is certified.');
    return { angle, kind: (angle === 0 || angle === Math.PI ? 'endpoint' : v.repeated ? 'touch' : 'crossing') as Crossing['kind'], frequency: at };
  });
  return { continuum: solution.continuum, points };
}
export function analyzeFrequency(model: Model): FrequencyAnalysis {
  const nm = magnitudePolynomial(model.numerator), dm = magnitudePolynomial(model.denominator), gain = crossingSet(model, difference(nm, dm), model.T, 1);
  // Im(N conj(D)) = sinΩ [s1 + 2s2 cosΩ + s3(4cos²Ω−1)].
  const n = [...model.numerator].reverse(), d = [...model.denominator].reverse(), s = [0, 0, 0, 0];
  n.forEach((x, i) => d.forEach((y, j) => { const k = i - j; if (k !== 0) s[Math.abs(k)] += Math.sign(k) * x * y; }));
  const phaseEquation = [s[1] - s[3], 2 * s[2], 4 * s[3]], phaseRoots = cosineRoots(phaseEquation);
  // This positive-gain integrating-plant family has no real-axis continuum;
  // cancellation can make its equation unresolved, which is reported explicitly.
  if (phaseRoots.continuum) throw new Error('The negative-real-axis equation is degenerate at this precision; margins are unresolved.');
  const angles = [0, ...phaseRoots.values.filter(v => Math.abs(v.cosine) < 1).map(v => Math.acos(v.cosine)), Math.PI].sort((a, b) => a - b);
  const phase: Crossings = { continuum: false, points: angles.map(angle => {
    const at = frequency(model, angle, model.T);
    if (angle > 0 && angle < Math.PI && (at.status !== 'finite' || Math.abs(at.value!.im) > 1e-6 * at.magnitude!)) throw new Error('A phase-crossing residual is unresolved; no complete margin set is certified.');
    return { angle, kind: (angle === 0 || angle === Math.PI ? 'endpoint' : 'crossing') as Crossing['kind'], frequency: at };
  }).filter(p => p.frequency.status === 'finite' && p.frequency.value!.re < 0) };
  const phaseMargins = gain.points.map(p => { let degrees = 180 + p.frequency.phase!; if (degrees > 180) degrees -= 360; return { angle: p.angle, degrees }; });
  const gainMargins = phase.points.map(p => ({ angle: p.angle, factor: 1 / p.frequency.magnitude!, db: -p.frequency.db! }));
  const bandwidth: FrequencyAnalysis['bandwidth'] = { angle: null, points: [], reason: 'Full closed-loop poles are not strictly inside the disk; stable bandwidth is unavailable.' };
  if (model.stability === 'inside') {
    const closed: Loop = { numerator: model.numerator, denominator: model.closed }, threshold = difference(nm, magnitudePolynomial(model.closed), DROP_SQUARED);
    const crossings = crossingSet(closed, threshold, model.T, Math.sqrt(DROP_SQUARED)); bandwidth.points = crossings.points;
    const down = crossings.points.find(v => {
      const c = Math.cos(v.angle), derivative = threshold[1] + 2 * threshold[2] * c + 3 * threshold[3] * c * c;
      return v.kind !== 'touch' && derivative > 0;
    });
    bandwidth.angle = down?.angle ?? null; bandwidth.reason = down ? 'First downward −3dB crossing relative to unit closed-loop DC gain.' : 'No downward −3dB crossing up to Nyquist; bandwidth beyond this unique-frequency range is unresolved.';
  }
  return { gain, phase, phaseMargins, gainMargins, bandwidth };
}
export interface Tracking { stepLimit: number | null; stepError: number | null; velocityConstant: number; rampError: number | null; reason: string }
export function tracking(model: Model): Tracking {
  const velocityConstant = model.controller.K * model.plant.gain / model.plant.p;
  return { stepLimit: model.stability === 'inside' ? 1 : null, stepError: model.stability === 'inside' ? 0 : null, velocityConstant,
    rampError: model.stability === 'inside' ? 1 / velocityConstant : null,
    reason: model.stability === 'inside' ? 'Type1 negative unity feedback: unit-step error0; physical unit-ramp r[k]=kT has error1/Kv,d.' : 'Tracking limits require every unreduced closed-loop pole strictly inside the disk.' };
}
export interface Response { values: number[]; controls: number[]; errors: number[]; rise: number | null; settlingCandidate: number | null; overshoot: number | null; energy: number; limit: number | null }
/** Simulate the original held physical plant and digital controller, zero state.
 * Bound its defect against the full output recurrence to detect modal cancellation. */
export function sampledResponse(model: Model, samples: number): Response {
  bounded(samples, 10, 2000, 'Response intervals'); if (!Number.isInteger(samples)) throw new Error('Response intervals must be an integer.');
  const values = [0], controls: number[] = [], errors: number[] = [], order = model.closed.length - 1;
  const padded = Array(model.closed.length - model.numerator.length).fill(0).concat(model.numerator), defects = [0];
  const radius = Math.max(...model.poles.map(p => Math.hypot(p.re, p.im))) + Math.sqrt(ROUND) * Math.max(1, ...model.closed.map(Math.abs));
  const weights = Array.from({ length: samples + 1 }, (_, lag) => (order === 3 ? (lag + 1) * (lag + 2) / 2 : lag + 1) * radius ** lag);
  let velocity = 0, previousError = 0, previousControl = 0, energy = 0;
  for (let k = 0; k < samples; k++) {
    const error = 1 - values[k], u = model.cn[0] * error + (model.cn[1] ?? 0) * previousError - (model.cd[1] ?? 0) * previousControl;
    const next = values[k] + model.h / model.plant.p * velocity + model.b1 * u;
    const nextVelocity = model.a * velocity + model.plant.gain * model.h / model.plant.p * u;
    if (![next, nextVelocity, u].every(x => Number.isFinite(x) && Math.abs(x) <= 1e12)) throw new Error('Output, physical velocity or control exceeds magnitude1e12. Reduce horizon/gain; no partial metrics are reported.');
    values.push(next); controls.push(u); errors.push(error); energy += model.T * u * u;
    if (!Number.isFinite(energy) || energy > 1e28) throw new Error('Control effort exceeds1e28; no partial metrics are reported.');
    let reconstructed = 0, terms = 0;
    for (let j = 1; j <= order; j++) { const feedback = -model.closed[j] * (values[k + 1 - j] ?? 0), forcing = k + 1 >= j ? padded[j] : 0; reconstructed += feedback + forcing; terms += Math.abs(feedback) + Math.abs(forcing); }
    defects.push(Math.abs(next - reconstructed) + ROUND * (terms + Math.abs(next)));
    let bound = 0; for (let j = 1; j <= k + 1; j++) if (defects[j] !== 0) bound += defects[j] * weights[k + 1 - j];
    if (!Number.isFinite(bound) || bound > 1e-7 * Math.max(1, Math.abs(next))) throw new Error('Roundoff amplification makes the response numerically unresolved. Reduce the horizon or separate nearly cancelling modes; no partial metrics are reported.');
    velocity = nextVelocity; previousError = error; previousControl = u;
  }
  errors.push(1 - values[samples]);
  const limit = model.stability === 'inside' ? 1 : null;
  let rise: number | null = null, settlingCandidate: number | null = null, overshoot: number | null = null;
  if (limit !== null) {
    overshoot = 100 * Math.max(0, Math.max(...values) - 1);
    const ten = values.findIndex(y => y >= .1), ninety = values.findIndex(y => y >= .9);
    if (ten >= 0 && ninety >= 0) rise = (ninety - ten) * model.T;
    let lastViolation = -1; values.forEach((y, i) => { if (Math.abs(y - 1) > .02) lastViolation = i; });
    if (lastViolation < samples) settlingCandidate = (lastViolation + 1) * model.T;
  }
  return { values, controls, errors, rise, settlingCandidate, overshoot, energy, limit };
}
