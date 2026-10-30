export interface Complex { re: number; im: number }
export interface Inputs { g: number; a: number; sigma: number; omega: number; pole: number }
export interface Design extends Inputs {
  gain: number; zero: number; remaining: number; q: number; coefficients: number[];
  deficiency: number; poleAngle: number; zeroAngle: number; angleResidual: number; magnitudeGain: number; rampError: number;
}
export interface Trace { time: number[]; full: number[]; pair: number[]; overshoot: number; entry: number | null; entryBracket: [number, number] | null; endError: number; refinement: number }
const abs = (s: Complex) => Math.hypot(s.re, s.im);
const mul = (s: Complex, t: Complex): Complex => ({ re: s.re * t.re - s.im * t.im, im: s.re * t.im + s.im * t.re });
const add = (s: Complex, n: number): Complex => ({ re: s.re + n, im: s.im });
export function bound(n: number, min: number, max: number, label: string): number {
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} must be from ${min} to ${max}.`);
  return n;
}
export function targetFromSpecs(overshoot: number, settling: number): { sigma: number; omega: number } {
  bound(overshoot, .1, 40, 'Second-order overshoot (%)'); bound(settling, .4, 40, 'Approximate 2% settling time (s)');
  const sigma = 4 / settling, omega = -Math.PI * sigma / Math.log(overshoot / 100);
  bound(omega, .1, 20, 'Derived target imaginary part (rad/s)'); return { sigma, omega };
}
export function design(input: Inputs): Design {
  const { g, a, sigma, omega, pole } = input;
  bound(g, .05, 20, 'Plant numerator g'); bound(a, .1, 20, 'Plant pole parameter a (1/s)');
  bound(sigma, .1, 10, 'Target decay σ (1/s)'); bound(omega, .1, 20, 'Target imaginary part ω (rad/s)');
  bound(pole, .2, 50, 'Compensator pole distance p (1/s)');
  const remaining = a + pole - 2 * sigma;
  if (remaining < .02) throw new Error(`The remaining closed-loop pole is ${-remaining} (1/s). Choose p so a+p−2σ ≥ 0.02; the target pair alone does not ensure a stable, resolved design.`);
  const q = sigma * sigma + omega * omega, loopGain = q + 2 * sigma * remaining - a * pole;
  if (loopGain <= .0001) throw new Error('This target/pole choice needs nonpositive or poorly resolved gain. Change the chosen pole or target.');
  const gain = loopGain / g, zero = q * remaining / loopGain;
  bound(gain, .001, 5000, 'Designed controller gain K'); bound(zero, .01, 50, 'Designed zero distance z (1/s)');
  if (pole - zero < .0001) throw new Error('This choice is not a lead section: require 0 < z < p with a resolved separation. Change the target or compensator pole.');
  const theta0 = Math.atan2(omega, -sigma), thetaA = Math.atan2(omega, a - sigma);
  const poleAngle = Math.atan2(omega, pole - sigma), zeroAngle = Math.atan2(omega, zero - sigma);
  const angleResidual = Math.atan2(Math.sin(zeroAngle - theta0 - thetaA - poleAngle + Math.PI), Math.cos(zeroAngle - theta0 - thetaA - poleAngle + Math.PI));
  const magnitudeGain = Math.hypot(sigma, omega) * Math.hypot(a - sigma, omega) * Math.hypot(pole - sigma, omega) / (g * Math.hypot(zero - sigma, omega));
  if (Math.abs(angleResidual) > 1e-9 || Math.abs(magnitudeGain - gain) > 1e-9 * Math.max(1, gain)) throw new Error('The angle/magnitude cross-check is unresolved for this input. Rescale or move the target.');
  const coefficients = [1, a + pole, a * pole + loopGain, loopGain * zero];
  // Cubic Routh and all factors are retained, including a possible stable I/O cancellation.
  if (!(coefficients[1] * coefficients[2] > coefficients[3])) throw new Error('The complete cubic fails strict Routh stability.');
  return { ...input, gain, zero, remaining, q, coefficients, deficiency: theta0 + thetaA - Math.PI, poleAngle, zeroAngle, angleResidual, magnitudeGain, rampError: a * pole / (loopGain * zero) };
}
export function polynomialResidual(coefficients: readonly number[], root: Complex): number {
  let value: Complex = { re: coefficients[0], im: 0 }, scale = Math.abs(coefficients[0]);
  for (const c of coefficients.slice(1)) { value = add(mul(value, root), c); scale = scale * abs(root) + Math.abs(c); }
  return abs(value) / Math.max(1, scale);
}
/** Scaled real cubic formula, followed by residual checks. Root-locus samples
 * are numerical roots, not a proof of a continuous gain/stability interval. */
export function cubicRoots(A: number, B: number, C: number): Complex[] {
  if (![A, B, C].every(Number.isFinite)) throw new Error('Enter finite cubic coefficients.');
  const scale = Math.max(1, Math.abs(A), Math.sqrt(Math.abs(B)), Math.cbrt(Math.abs(C)));
  const a = A / scale, b = B / scale ** 2, c = C / scale ** 3;
  const p = b - a * a / 3, q = 2 * a ** 3 / 27 - a * b / 3 + c, discriminant = (q / 2) ** 2 + (p / 3) ** 3;
  let roots: Complex[];
  if (discriminant >= 0) {
    const u = Math.cbrt(-q / 2 + Math.sqrt(discriminant)), v = Math.cbrt(-q / 2 - Math.sqrt(discriminant));
    roots = [{ re: u + v - a / 3, im: 0 }, { re: -(u + v) / 2 - a / 3, im: Math.sqrt(3) * (u - v) / 2 }, { re: -(u + v) / 2 - a / 3, im: -Math.sqrt(3) * (u - v) / 2 }];
  } else {
    const radius = 2 * Math.sqrt(-p / 3), angle = Math.acos(Math.max(-1, Math.min(1, -q / (2 * Math.sqrt(-((p / 3) ** 3))))));
    roots = [0, 1, 2].map(k => ({ re: radius * Math.cos((angle + 2 * k * Math.PI) / 3) - a / 3, im: 0 }));
  }
  roots = roots.map(r => ({ re: r.re * scale, im: r.im * scale }));
  if (roots.some(r => !Number.isFinite(abs(r)) || polynomialResidual([1, A, B, C], r) > 1e-8)) throw new Error('Cubic roots are numerically unresolved. Reduce the locus range or rescale the parameters.');
  return roots;
}
const permutations = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
export function rootLocus(d: Design, maxGain: number): { gains: number[]; branches: Complex[][] } {
  bound(maxGain, .01, 10000, 'Root-locus maximum gain');
  const end = Math.max(maxGain, 1.2 * d.gain);
  const gains = [...Array.from({ length: 401 }, (_, i) => end * (i / 400) ** 2), d.gain].sort((a, b) => a - b);
  const branches: Complex[][] = [[{ re: 0, im: 0 }], [{ re: -d.a, im: 0 }], [{ re: -d.pole, im: 0 }]];
  for (const K of gains.slice(1)) {
    const roots = cubicRoots(d.a + d.pole, d.a * d.pole + K * d.g, K * d.g * d.zero);
    const previous = branches.map(b => b.at(-1)!);
    const best = permutations.reduce((winner, order) => {
      const cost = (indices: number[]) => indices.reduce((sum, j, i) => sum + Math.hypot(roots[j].re - previous[i].re, roots[j].im - previous[i].im) ** 2, 0);
      return cost(order) < cost(winner) ? order : winner;
    });
    branches.forEach((b, i) => b.push(roots[best[i]]));
  }
  return { gains, branches };
}
export function responseCoefficients(d: Design): { A: number; B: number; D: number } {
  const A = d.gain * d.g * (d.zero - d.remaining) / (-d.remaining * ((d.sigma - d.remaining) ** 2 + d.omega ** 2));
  const B = -1 - A, D = (d.remaining * A + d.sigma * B) / d.omega;
  return { A, B, D };
}
export function stepValue(d: Design, t: number): number {
  const { A, B, D } = responseCoefficients(d);
  return t === 0 ? 0 : 1 + A * Math.exp(-d.remaining * t) + Math.exp(-d.sigma * t) * (B * Math.cos(d.omega * t) + D * Math.sin(d.omega * t));
}
export function stepTrace(d: Design, horizon: number): Trace {
  bound(horizon, .5, 200, 'Response horizon (s)');
  const count = Math.max(200, Math.ceil(horizon * Math.max(40 * d.sigma, 20 * d.remaining, 40 * d.omega)));
  if (count * 2 > 60000) throw new Error('The time/frequency scales need over 60,000 response samples. Shorten the horizon.');
  const time = Array.from({ length: count * 2 + 1 }, (_, i) => horizon * i / (count * 2));
  const full = time.map(t => stepValue(d, t)), pair = time.map(t => 1 - Math.exp(-d.sigma * t) * (Math.cos(d.omega * t) + d.sigma / d.omega * Math.sin(d.omega * t)));
  let refinement = 0;
  for (let i = 1; i < full.length - 1; i += 2) refinement = Math.max(refinement, Math.abs(full[i] - (full[i - 1] + full[i + 1]) / 2));
  if (full.some(v => !Number.isFinite(v) || Math.abs(v) > 1000) || refinement > .001) throw new Error('The sampled response is unresolved at the supported resolution. Move the target or shorten the horizon.');
  let peak = 0, lastOutside = -1;
  full.forEach((v, i) => { peak = Math.max(peak, v); if (Math.abs(v - 1) > .02) lastOutside = i; });
  const candidate = time[lastOutside + 1];
  const entry = candidate !== undefined && horizon - candidate >= Math.max(1 / d.sigma, 1 / d.remaining) ? candidate : null;
  // Bracket the last observed band crossing, without claiming unseen excursions
  // between samples or after the finite horizon have been excluded.
  const entryBracket: [number, number] | null = entry === null ? null : [time[lastOutside], entry];
  return { time, full, pair, overshoot: Math.max(0, peak - 1) * 100, entry, entryBracket, endError: 1 - full.at(-1)!, refinement };
}
export function checkEntryDeadline(trace: Trace, deadline: number): 'Observed pass' | 'Fails deadline' | 'Unresolved' {
  bound(deadline, .1, 200, 'Entry deadline (s)');
  if (trace.entry === null || trace.entryBracket === null || trace.time.at(-1)! < deadline) return 'Unresolved';
  if (trace.entry <= deadline) return 'Observed pass';
  // Only an out-of-band sample at/after the deadline establishes a failure.
  return deadline <= trace.entryBracket[0] ? 'Fails deadline' : 'Unresolved';
}
