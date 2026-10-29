/** DF03's bounded real, strictly proper first/second-order loop. Coefficients
 * are descending powers of z; no cancellation or external numerical toolbox. */
export interface Complex { re: number; im: number }
export interface Loop { denominator: number[]; numerator: number[] }
export interface Model extends Loop { closed: number[]; poles: Complex[]; openPoles: Complex[]; stability: 'inside' | 'boundary' | 'outside' }
export interface Frequency {
  angle: number; omega: number; hz: number; warped: number;
  status: 'finite' | 'zero' | 'pole' | 'indeterminate'; value: Complex | null;
  magnitude: number | null; db: number | null; phase: number | null;
}
export interface Crossing { angle: number; cosine: number; kind: 'crossing' | 'touch' | 'endpoint'; value: Frequency }
export interface Crossings { continuum: boolean; points: Crossing[]; intervals?: { from: number; to: number; fromIncluded: boolean; toIncluded: boolean }[] }
export interface FrequencyAnalysis {
  gain: Crossings; phase: Crossings; singular: Frequency[];
  phaseMargins: { angle: number; degrees: number }[];
  gainMargins: { angle: number; factor: number; db: number }[];
  bandwidth: { status: 'finite' | 'beyond' | 'undefined'; angle: number | null; points: Crossing[]; reason: string };
}
export const CIRCLE_TOLERANCE = 1e-9;
export const DROP_SQUARED = 10 ** (-3 / 10);
const ROUND = 64 * Number.EPSILON;
export function poleStatus(pole: Complex): Model['stability'] {
  const radius = Math.hypot(pole.re, pole.im);
  return radius > 1 + CIRCLE_TOLERANCE ? 'outside' : radius >= 1 - CIRCLE_TOLERANCE ? 'boundary' : 'inside';
}

function bounded(value: number, low: number, high: number, label: string) {
  if (!Number.isFinite(value) || value < low || value > high) throw new Error(`${label} must be between ${low} and ${high}.`);
  return value;
}
function coefficients(values: number[], label: string) {
  if (!values.length || values.some(x => !Number.isFinite(x) || Math.abs(x) > 100 || (x !== 0 && Math.abs(x) < 1e-9))) {
    throw new Error(`${label}: use finite normalized coefficients with magnitude at most 100; each nonzero coefficient must be at least 1e-9.`);
  }
}
export function samplePeriod(value: number) { return bounded(value, .001, 10, 'Sample period T (s)'); }
export function roots(polynomial: number[]): Complex[] {
  if ((polynomial.length !== 2 && polynomial.length !== 3) || polynomial[0] === 0 || polynomial.some(x => !Number.isFinite(x))) throw new Error('A finite degree1 or2 polynomial is required.');
  if (polynomial.length === 2) return [{ re: -polynomial[1] / polynomial[0], im: 0 }];
  const [a, b, c] = polynomial, discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    const im = Math.sqrt(-discriminant) / (2 * Math.abs(a));
    return [{ re: -b / (2 * a), im }, { re: -b / (2 * a), im: -im }];
  }
  if (discriminant === 0) return [{ re: -b / (2 * a), im: 0 }, { re: -b / (2 * a), im: 0 }];
  const q = -.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant));
  return [{ re: q / a, im: 0 }, { re: c / q, im: 0 }];
}
export function createModel(loop: Loop): Model {
  const d = [...loop.denominator], n = [...loop.numerator];
  if ((d.length !== 2 && d.length !== 3) || n.length < 1 || n.length >= d.length || d[0] !== 1) throw new Error('Use a monic degree1 or2 denominator and a strictly smaller numerator degree.');
  coefficients(d, 'Denominator'); coefficients(n, 'Numerator');
  while (n.length > 1 && n[0] === 0) n.shift();
  const closed = d.map((x, i) => x + (n[i - (d.length - n.length)] ?? 0));
  const poles = roots(closed), openPoles = roots(d), statuses = poles.map(poleStatus);
  const stability = statuses.includes('outside') ? 'outside' : statuses.includes('boundary') ? 'boundary' : 'inside';
  return { denominator: d, numerator: n, closed, poles, openPoles, stability };
}
function evaluate(p: number[], z: Complex): Complex {
  let re = 0, im = 0;
  for (const coefficient of p) { const next = re * z.re - im * z.im + coefficient; im = re * z.im + im * z.re; re = next; }
  return { re, im };
}
export function unitPoint(angle: number): Complex {
  return angle === 0 ? { re: 1, im: 0 } : angle === Math.PI ? { re: -1, im: 0 } : { re: Math.cos(angle), im: Math.sin(angle) };
}
export function coordinates(angle: number, T: number) {
  bounded(angle, 0, Math.PI, 'Unit-circle angle (rad/sample)'); samplePeriod(T);
  return { angle, omega: angle / T, hz: angle / (2 * Math.PI * T), warped: angle === Math.PI ? Infinity : 2 * Math.tan(angle / 2) / T };
}
export function frequency(loop: Loop, angle: number, T: number): Frequency {
  const axes = coordinates(angle, T), z = unitPoint(angle), numerator = evaluate(loop.numerator, z), denominator = evaluate(loop.denominator, z);
  const dn = Math.hypot(denominator.re, denominator.im), nn = Math.hypot(numerator.re, numerator.im);
  const dTiny = dn <= ROUND * loop.denominator.reduce((s, x) => s + Math.abs(x), 0);
  const nTiny = nn <= ROUND * loop.numerator.reduce((s, x) => s + Math.abs(x), 0);
  if (dTiny) return { ...axes, status: nTiny ? 'indeterminate' : 'pole', value: null, magnitude: null, db: null, phase: null };
  if (nTiny) return { ...axes, status: 'zero', value: { re: 0, im: 0 }, magnitude: 0, db: -Infinity, phase: null };
  const denom = dn * dn;
  const value = { re: (numerator.re * denominator.re + numerator.im * denominator.im) / denom, im: (numerator.im * denominator.re - numerator.re * denominator.im) / denom };
  const magnitude = Math.hypot(value.re, value.im);
  return { ...axes, status: 'finite', value, magnitude, db: 20 * Math.log10(magnitude), phase: Math.atan2(value.im, value.re) * 180 / Math.PI };
}
/** |p(exp(j Omega))|² as ascending coefficients in c=cos(Omega). */
export function magnitudePolynomial(p: number[]): number[] {
  const [p0 = 0, p1 = 0, p2 = 0] = [...p].reverse();
  return [(p0 - p2) ** 2 + p1 ** 2, 2 * p1 * (p0 + p2), 4 * p0 * p2];
}
function difference(a: number[], b: number[], multiplier = 1) { return a.map((x, i) => x - multiplier * b[i]); }
interface CosineRoot { cosine: number; repeated: boolean }
/** Complete real roots in [-1,1], stable quadratic formula. Never a sweep. */
export function cosineRoots(p: number[]): { continuum: boolean; points: CosineRoot[] } {
  const [c, b, a] = p;
  if (![a, b, c].every(Number.isFinite)) throw new Error('The frequency equation is not finite.');
  if (a === 0 && b === 0) return { continuum: c === 0, points: [] };
  let candidates: number[], repeated = false;
  if (a === 0) candidates = [-c / b];
  else {
    const discriminant = b * b - 4 * a * c, noise = ROUND * (b * b + Math.abs(4 * a * c));
    if (discriminant !== 0 && Math.abs(discriminant) <= noise) throw new Error('Frequency crossings are too close to distinguish at this coefficient precision. Rescale or separate the data; no complete crossing set is certified.');
    if (discriminant < 0) return { continuum: false, points: [] };
    if (discriminant === 0) { candidates = [-b / (2 * a)]; repeated = true; }
    else { const q = -.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant)); candidates = [q / a, c / q]; }
  }
  const points: CosineRoot[] = [];
  for (const value of candidates) {
    if (value < -1 - ROUND || value > 1 + ROUND) continue;
    // Endpoint arithmetic carries a 64-epsilon cosine band; report that as an
    // endpoint rather than inventing a tiny off-endpoint angle from roundoff.
    const cosine = Math.abs(value - 1) <= ROUND ? 1 : Math.abs(value + 1) <= ROUND ? -1 : value;
    if (points.some(x => x.cosine === cosine)) continue;
    const residual = Math.abs((a * cosine + b) * cosine + c), scale = Math.abs(a) + Math.abs(b) + Math.abs(c);
    if (residual > 1e-10 * scale) throw new Error('The frequency root residual is too large; this crossing set is unavailable.');
    points.push({ cosine, repeated });
  }
  points.sort((x, y) => y.cosine - x.cosine);
  return { continuum: false, points };
}
function crossingSet(loop: Loop, polynomial: number[], T: number): Crossings {
  const solution = cosineRoots(polynomial);
  return { continuum: solution.continuum, points: solution.points.map(p => {
    const angle = Math.acos(p.cosine);
    return { angle, cosine: p.cosine, kind: angle === 0 || angle === Math.PI ? 'endpoint' as const : p.repeated ? 'touch' as const : 'crossing' as const, value: frequency(loop, angle, T) };
  }).filter(p => p.value.status === 'finite') };
}
export function analyzeFrequency(model: Model, T: number): FrequencyAnalysis {
  samplePeriod(T);
  const nm = magnitudePolynomial(model.numerator), dm = magnitudePolynomial(model.denominator);
  const gain = crossingSet(model, difference(nm, dm), T);
  const [b0 = 0, b1 = 0] = [...model.numerator].reverse(), [d0 = 0, d1 = 0, d2 = 0] = [...model.denominator].reverse();
  const A = b1 * (d0 - d2) - b0 * d1, B = -2 * b0 * d2;
  // Im(N*conj(D))=sin(Omega)*(A+B*cos(Omega)). Endpoints count.
  const phaseAngles = [0, Math.PI];
  if (B !== 0) { const c = -A / B; if (c > -1 && c < 1) phaseAngles.push(Math.acos(c)); }
  const phasePoints = phaseAngles.sort((a, b) => a - b).map(angle => ({ angle, cosine: Math.cos(angle), kind: (angle === 0 || angle === Math.PI ? 'endpoint' : 'crossing') as Crossing['kind'], value: frequency(model, angle, T) }))
    .filter(p => p.value.status === 'finite' && p.value.value!.re < 0);
  const phase: Crossings = { continuum: A === 0 && B === 0 && model.numerator.some(x => x !== 0), points: phasePoints };
  if (phase.continuum) {
    // The nonzero strictly proper possibility is b1*z/(z²+d1*z+1),
    // whose unit-circle value is b1/(2*cos(Omega)+d1).
    const cuts = [0, Math.PI];
    const poleCosine = -d1 / 2;
    if (poleCosine > -1 && poleCosine < 1) cuts.push(Math.acos(poleCosine));
    cuts.sort((a, b) => a - b);
    phase.intervals = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const from = cuts[i], to = cuts[i + 1], midpoint = frequency(model, (from + to) / 2, T);
      if (midpoint.status === 'finite' && midpoint.value!.re < 0) phase.intervals.push({ from, to,
        fromIncluded: frequency(model, from, T).status === 'finite', toIncluded: frequency(model, to, T).status === 'finite' });
    }
    phase.continuum = phase.intervals.length > 0;
  }
  const phaseMargins = gain.points.map(p => {
    let degrees = 180 + p.value.phase!;
    if (degrees > 180) degrees -= 360;
    return { angle: p.angle, degrees };
  });
  const gainMargins = phase.points.map(p => ({ angle: p.angle, factor: 1 / p.value.magnitude!, db: -p.value.db! }));
  const singular = model.openPoles.filter(p => Math.abs(Math.hypot(p.re, p.im) - 1) <= CIRCLE_TOLERANCE && p.im >= 0).map(p => frequency(model, Math.atan2(p.im, p.re), T));
  const bandwidth: FrequencyAnalysis['bandwidth'] = { status: 'undefined', angle: null, points: [], reason: '' };
  const closedLoop: Loop = { denominator: model.closed, numerator: model.numerator }, dc = frequency(closedLoop, 0, T);
  if (model.stability !== 'inside') bandwidth.reason = 'Full closed-loop poles are not strictly inside the disk; no stable bandwidth is certified.';
  else if (dc.status !== 'finite') bandwidth.reason = 'A finite nonzero closed-loop DC gain is required.';
  else {
    const threshold = difference(nm, magnitudePolynomial(model.closed), DROP_SQUARED * dc.magnitude! ** 2);
    const crossings = crossingSet(closedLoop, threshold, T);
    bandwidth.points = crossings.points;
    const down = crossings.points.find(p => p.kind !== 'touch' && threshold[1] + 2 * threshold[2] * p.cosine > 0);
    if (down) { bandwidth.status = 'finite'; bandwidth.angle = down.angle; bandwidth.reason = 'First downward -3dB crossing relative to |closed-loop DC gain|.'; }
    else { bandwidth.status = 'beyond'; bandwidth.reason = 'No downward -3dB crossing up to Nyquist; a bandwidth beyond the unique sampled-frequency range is unresolved.'; }
  }
  return { gain, phase, phaseMargins, gainMargins, bandwidth, singular };
}
export interface Response {
  values: number[]; T: number; limit: number | null; overshoot: number | null;
  rise: number | null; settlingCandidate: number | null; lastSample: number;
}
export function sampledResponse(model: Model, T: number, samples: number): Response {
  samplePeriod(T); bounded(samples, 10, 2000, 'Number of response intervals');
  if (!Number.isInteger(samples)) throw new Error('Use an integer number of response intervals.');
  const values = [0], order = model.closed.length - 1, padded = Array(model.closed.length - model.numerator.length).fill(0).concat(model.numerator) as number[];
  // Bound amplification of local arithmetic using |h[l]| <= rho^l for order1,
  // and |h[l]| <= (l+1)rho^l for order2 (sum of the two modal monomials).
  // Inflate the computed radius for root roundoff. This conservative numerical
  // guard rejects cancellation-driven trajectories before they look plausible.
  const radius = Math.max(...model.poles.map(p => Math.hypot(p.re, p.im))) + Math.sqrt(ROUND) * Math.max(1, ...model.closed.map(Math.abs));
  const weights = Array.from({ length: samples + 1 }, (_, lag) => (order === 2 ? lag + 1 : 1) * radius ** lag), localErrors = [0];
  for (let k = 1; k <= samples; k++) {
    let value = 0, absoluteTerms = 0;
    for (let i = 1; i <= order; i++) {
      const feedback = -model.closed[i] * (values[k - i] ?? 0), input = k >= i ? padded[i] : 0;
      value += feedback + input; absoluteTerms += Math.abs(feedback) + Math.abs(input);
    }
    if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error('The sampled response exceeds magnitude1e12. Reduce the horizon or change the loop; no partial response metrics are reported.');
    localErrors.push(ROUND * absoluteTerms);
    let errorBound = 0;
    for (let j = 1; j <= k; j++) if (localErrors[j] !== 0) errorBound += localErrors[j] * weights[k - j];
    if (!Number.isFinite(errorBound) || errorBound > 1e-7 * Math.max(1, Math.abs(value))) throw new Error('Roundoff amplification makes this response numerically unresolved. Reduce the horizon or separate nearly cancelling modes; no partial response metrics are reported.');
    values.push(value);
  }
  const dc = frequency({ numerator: model.numerator, denominator: model.closed }, 0, T);
  const limit = model.stability === 'inside' && (dc.status === 'finite' || dc.status === 'zero') ? dc.value!.re : null;
  let overshoot: number | null = null, rise: number | null = null, settlingCandidate: number | null = null;
  if (limit !== null && limit !== 0) {
    const relative = values.map(y => y / limit), ten = relative.findIndex(y => y >= .1), ninety = relative.findIndex(y => y >= .9);
    overshoot = 100 * Math.max(0, Math.max(...relative) - 1);
    if (ten >= 0 && ninety >= 0) rise = (ninety - ten) * T;
    let lastViolation = -1;
    relative.forEach((y, i) => { if (Math.abs(y - 1) > .02) lastViolation = i; });
    if (lastViolation < samples) settlingCandidate = (lastViolation + 1) * T;
  }
  return { values, T, limit, overshoot, rise, settlingCandidate, lastSample: samples * T };
}
export interface Emulation { g: number; tau: number; kp: number; ki: number; T: number; method: 'backward' | 'trapezoidal' }
export function emulatePI(p: Emulation) {
  bounded(p.g, .05, 20, 'Physical gain g'); bounded(p.tau, .01, 10, 'Physical time constant tau (s)');
  bounded(p.kp, 0, 20, 'Proportional gain'); bounded(p.ki, .001, 20, 'Integral gain (1/s)'); samplePeriod(p.T);
  if (p.method !== 'backward' && p.method !== 'trapezoidal') throw new Error('Choose backward Euler or trapezoidal integration.');
  if (p.T / p.tau > 20) throw new Error('Use T/tau at most20 for this bounded ZOH emulator.');
  const a = Math.exp(-p.T / p.tau), b = p.g * -Math.expm1(-p.T / p.tau), i = p.ki * p.T * (p.method === 'backward' ? 1 : .5);
  const denominator = [1, -(1 + a), a], numerator = [b * (p.kp + i), b * (-p.kp + (p.method === 'backward' ? 0 : i))];
  return { a, b, model: createModel({ denominator, numerator }) };
}
