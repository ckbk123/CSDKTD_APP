/** Bounded, continuous SISO lag/lead–lag exercise. Descending powers of s. */
export interface Plant { readonly g: number; readonly a: number; readonly k: number }
export interface Corners { readonly z: number; readonly p: number }
export interface Loop { readonly plant: Plant; readonly lag?: Corners; readonly lead?: Corners }
export interface Complex { re: number; im: number }
export interface Model { loop: Loop; open: number[]; numerator: number[]; closed: number[] }
export interface Frequency { magnitude: number; db: number; phase: number }
export interface PhaseCrossing { omega: number; gainMarginDb: number }
export interface Stability { status: 'stable' | 'unstable' | 'boundary'; relativeMargins: number[] }
export interface Analysis {
  model: Model; crossover: number; phaseMargin: number; phaseCrossings: PhaseCrossing[];
  stability: Stability; poles: Complex[]; clustered: boolean; kv: number; rampError: number | null;
}
export const bound = (v: number, min: number, max: number, label: string): number => {
  if (!Number.isFinite(v) || v < min || v > max) throw new Error(`${label} must be from ${min} to ${max}.`);
  return v;
};
export function validatePlant(p: Plant): void {
  bound(p.g, .05, 20, 'Plant numerator g'); bound(p.a, .2, 20, 'Plant pole parameter a'); bound(p.k, .05, 50, 'Proportional gain C0');
}
export function requiredRatio(p: Plant, target: number): number {
  validatePlant(p); bound(target, .0001, 1000, 'Maximum unit-ramp error'); return Math.max(1, p.a / (p.k * p.g * target));
}
function validateCorners(c: Corners, kind: 'lag' | 'lead'): void {
  if (kind === 'lag') {
    bound(c.z, .002, 10, 'Lag zero'); bound(c.p, .00004, 10, 'Lag pole'); bound(c.z / c.p, 1, 50, 'Lag ratio z/p');
  } else {
    bound(c.z, .002, 50, 'Lead zero'); bound(c.p, .002, 100, 'Lead pole'); bound(c.p / c.z, 1.0001, 100, 'Lead ratio p/z');
  }
}
export function multiply(a: readonly number[], b: readonly number[]): number[] {
  const c = Array<number>(a.length + b.length - 1).fill(0);
  a.forEach((v, i) => b.forEach((w, j) => { c[i + j] += v * w; })); return c;
}
export function model(loop: Loop): Model {
  const { plant, lag, lead } = loop; validatePlant(plant); if (lag) validateCorners(lag, 'lag'); if (lead) validateCorners(lead, 'lead');
  let open = [1, plant.a, 0], numerator = [plant.g * plant.k];
  if (lag) { open = multiply(open, [1, lag.p]); numerator = multiply(numerator, [1, lag.z]); }
  if (lead) { open = multiply(open, [1, lead.p]); numerator = multiply(numerator, [1, lead.z]).map(v => v * lead.p / lead.z); }
  const closed = [...open], offset = closed.length - numerator.length;
  numerator.forEach((v, i) => { closed[i + offset] += v; });
  return { loop: { plant: { ...plant }, ...(lag ? { lag: { ...lag } } : {}), ...(lead ? { lead: { ...lead } } : {}) }, open, numerator, closed };
}
export function frequency(loop: Loop, omega: number): Frequency {
  validatePlant(loop.plant); if (loop.lag) validateCorners(loop.lag, 'lag'); if (loop.lead) validateCorners(loop.lead, 'lead');
  bound(omega, 1e-8, 1e6, 'Frequency (rad/s)'); const { plant: { g, a, k }, lag, lead } = loop;
  let magnitude = g * k / (omega * Math.hypot(omega, a)), phase = -90 - Math.atan(omega / a) * 180 / Math.PI;
  for (const [c, factor] of [[lag, 1], [lead, lead ? lead.p / lead.z : 1]] as const) {
    if (!c) continue;
    magnitude *= factor * Math.hypot(omega, c.z) / Math.hypot(omega, c.p);
    phase += (Math.atan(omega / c.z) - Math.atan(omega / c.p)) * 180 / Math.PI;
  }
  return { magnitude, db: 20 * Math.log10(magnitude), phase };
}
/** d(log|L|)/d(log w) < -1 + 1 = 0: plant < -1, lag <= 0, one lead < 1.
 * Positive low/high limits bracket the ONLY gain crossing over this family. */
export function gainCrossover(loop: Loop): number {
  model(loop); let low = Math.log(1e-8), high = Math.log(1e6);
  if (frequency(loop, 1e-8).magnitude <= 1 || frequency(loop, 1e6).magnitude >= 1) throw new Error('Gain crossover is outside the supported frequency interval.');
  for (let i = 0; i < 80; i++) { const mid = (low + high) / 2; if (frequency(loop, Math.exp(mid)).magnitude > 1) low = mid; else high = mid; }
  return Math.exp((low + high) / 2);
}
function positiveQuadraticRoots(a: number, b: number, c: number): number[] {
  if (a === 0) return b === 0 ? [] : [-c / b].filter(v => v > 0);
  const discriminant = b * b - 4 * a * c, scale = b * b + Math.abs(4 * a * c);
  if (discriminant !== 0 && Math.abs(discriminant) < 1e-12 * scale) throw new Error('Finite phase crossings are too close to a tangent case to resolve. Move the lead or lag corners.');
  if (discriminant < 0) return [];
  const q = -.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(discriminant));
  const roots = q === 0 ? [-b / (2 * a)] : [q / a, c / q];
  return roots.filter((v, i) => Number.isFinite(v) && v > 0 && roots.findIndex(w => Math.abs(w - v) <= 1e-10 * Math.max(v, w)) === i).sort((x, y) => x - y);
}
/** Im[N(jw)conj(D(jw))]/w is linear (cubic loop) or quadratic (quartic)
 * in x=w². Solve ALL positive candidates, then require a negative real part. */
export function phaseCrossings(m: Model): PhaseCrossing[] {
  const n = m.open.length - 1; if (n === 2) return [];
  let candidates: number[];
  if (n === 3) {
    const z = m.numerator[1] / m.numerator[0];
    candidates = positiveQuadraticRoots(0, z - m.open[1], -z * m.open[2]);
  } else {
    const q1 = m.numerator[1] / m.numerator[0], q0 = m.numerator[2] / m.numerator[0];
    const [, d1, d2, d3] = m.open;
    candidates = positiveQuadraticRoots(q1 - d1, q0 * d1 + d3 - q1 * d2, -q0 * d3);
  }
  return candidates.map(x => {
    const omega = Math.sqrt(x); bound(omega, 1e-8, 1e6, 'Finite phase crossover (rad/s)');
    const f = frequency(m.loop, omega);
    if (Math.abs(f.phase + 180) > 1e-6) throw new Error('The phase-crossing check did not resolve; move the corner frequencies.');
    return { omega, gainMarginDb: -f.db };
  });
}
export function routh(c: readonly number[]): Stability {
  if (![3, 4, 5].includes(c.length) || c[0] !== 1 || c.some(v => !Number.isFinite(v))) throw new Error('Routh check requires a finite monic degree 2–4 polynomial.');
  const margins: number[] = c.slice(1).map(v => v > 0 ? 1 : v < 0 ? -1 : 0);
  if (c.length >= 4) {
    const [, a, b, d, e = 0] = c, ab = a * b, delta2 = ab - d;
    margins.push(delta2 / Math.max(Number.MIN_VALUE, Math.abs(ab) + Math.abs(d)));
    if (c.length === 5) {
      const abc = a * b * d, other = d * d + a * a * e;
      margins.push((abc - other) / Math.max(Number.MIN_VALUE, Math.abs(abc) + Math.abs(other)));
    }
  }
  const minimum = Math.min(...margins);
  return { status: minimum < -1e-9 ? 'unstable' : minimum > 1e-9 ? 'stable' : 'boundary', relativeMargins: margins };
}
const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const sub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const mul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const abs = (a: Complex): number => Math.hypot(a.re, a.im);
const div = (a: Complex, b: Complex): Complex => { const d = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }; };
function evaluate(c: readonly number[], z: Complex): Complex { return c.reduce((v, a) => add(mul(v, z), { re: a, im: 0 }), { re: 0, im: 0 }); }
export function residual(c: readonly number[], z: Complex): number {
  const scale = c.reduce((s, v) => s * abs(z) + Math.abs(v), 0); return abs(evaluate(c, z)) / Math.max(Number.MIN_VALUE, scale);
}
/** Scaled degree <=4 Durand–Kerner; certify residual AND reconstructed coefficients
 * so duplicate approximations of a simple root cannot masquerade as all poles.
 * No residue decomposition: repeated/clustered poles do not break the step solver. */
export function poles(c: readonly number[]): Complex[] {
  const n = c.length - 1;
  if (n < 1 || n > 4 || c[0] !== 1 || c.some(v => !Number.isFinite(v) || Math.abs(v) > 1e12)) throw new Error('Pole solver supports finite monic degree 1–4 coefficients, magnitude ≤10¹².');
  if (c[n] === 0 && n > 1) return [...poles(c.slice(0, -1)), { re: 0, im: 0 }];
  if (n === 1) return [{ re: -c[1], im: 0 }];
  if (n === 2) {
    const d = c[1] ** 2 - 4 * c[2];
    if (d < 0) return [{ re: -c[1] / 2, im: Math.sqrt(-d) / 2 }, { re: -c[1] / 2, im: -Math.sqrt(-d) / 2 }];
    const q = -.5 * (c[1] + (c[1] >= 0 ? 1 : -1) * Math.sqrt(d));
    return [{ re: q, im: 0 }, { re: q === 0 ? 0 : c[2] / q, im: 0 }];
  }
  // Exact coefficient identities avoid iterative splitting of repeated poles.
  const repeated = -c[1] / n; let binomial = [1];
  for (let i = 0; i < n; i++) binomial = multiply(binomial, [1, -repeated]);
  if (c.every((v, i) => v === binomial[i])) return Array.from({ length: n }, () => ({ re: repeated, im: 0 }));
  if (n === 4) {
    const b = c[1] / 2, q = [1, b, (c[2] - b * b) / 2], square = multiply(q, q);
    if (c.every((v, i) => v === square[i])) return poles(q).flatMap(z => [{ ...z }, { ...z }]);
  }
  const scale = Math.max(1, ...c.slice(1).map((v, i) => Math.abs(v) ** (1 / (i + 1))));
  const scaled = c.map((v, i) => v / scale ** i), radius = 1 + Math.max(...scaled.slice(1).map(Math.abs));
  let result: Complex[] = [];
  for (const offset of [.17, .53]) {
    result = Array.from({ length: n }, (_, i) => ({ re: radius * Math.cos(2 * Math.PI * (i + offset) / n), im: radius * Math.sin(2 * Math.PI * (i + offset) / n) }));
    for (let iteration = 0; iteration < 500; iteration++) {
      let largest = 0;
      const next = result.map((z, i) => {
        let product: Complex = { re: 1, im: 0 }; result.forEach((w, j) => { if (i !== j) product = mul(product, sub(z, w)); });
        const delta = div(evaluate(scaled, z), product); largest = Math.max(largest, abs(delta)); return sub(z, delta);
      });
      if (next.some(z => !Number.isFinite(z.re) || !Number.isFinite(z.im))) break;
      result = next; if (largest < 1e-12) break;
    }
    let reconstructed: Complex[] = [{ re: 1, im: 0 }], coefficientScale = [1];
    for (const z of result) {
      const next = Array.from({ length: reconstructed.length + 1 }, () => ({ re: 0, im: 0 }));
      reconstructed.forEach((v, i) => { next[i] = add(next[i], v); next[i + 1] = sub(next[i + 1], mul(v, z)); }); reconstructed = next;
      coefficientScale = multiply(coefficientScale, [1, abs(z)]);
    }
    if (result.every(z => residual(scaled, z) < 1e-9) && reconstructed.every((v, i) => abs(sub(v, { re: scaled[i], im: 0 })) < 1e-7 * Math.max(Number.MIN_VALUE, Math.abs(scaled[i]), coefficientScale[i]))) {
      return result.map(z => ({ re: z.re * scale, im: z.im * scale })).sort((a, b) => a.re - b.re || a.im - b.im);
    }
  }
  throw new Error('All poles could not be resolved within the bounded iteration limit. Move the corners away from an ill-conditioned case.');
}
export function analyze(loop: Loop): Analysis {
  const m = model(loop), crossover = gainCrossover(loop), stability = routh(m.closed), roots = poles(m.closed);
  if (stability.status === 'stable' && roots.some(z => z.re >= 0)) throw new Error('Routh and numerical poles do not agree on strict stability; move the corners.');
  const clustered = roots.some((z, i) => roots.some((w, j) => i !== j && abs(sub(z, w)) < 1e-4 * Math.max(1, abs(z), abs(w))));
  const kv = loop.plant.g * loop.plant.k / loop.plant.a * (loop.lag ? loop.lag.z / loop.lag.p : 1);
  return { model: m, crossover, phaseMargin: 180 + frequency(loop, crossover).phase, phaseCrossings: phaseCrossings(m), stability, poles: roots, clustered, kv, rampError: stability.status === 'stable' ? 1 / kv : null };
}
export interface LeadPlan extends Corners { omega: number; alpha: number; phaseAdded: number; targetWithReserve: number }
/** One bounded peak-centered design, preserving DC gain. Required magnitude at
 * the NEW crossover determines alpha; re-evaluate phase there, not at old wc. */
export function designLead(lagLoop: Loop, minPhase: number, minCross: number, maxCross: number): LeadPlan | null {
  if (!lagLoop.lag || lagLoop.lead) throw new Error('Reveal a lag-only loop before adding lead.');
  bound(minPhase, 15, 85, 'Minimum phase margin'); bound(minCross, .001, 100, 'Minimum crossover'); bound(maxCross, .001, 100, 'Maximum crossover');
  if (minCross > maxCross) throw new Error('The minimum crossover must not exceed the maximum.');
  const before = analyze(lagLoop), target = minPhase + 2;
  if (before.stability.status === 'stable' && before.phaseMargin >= minPhase && before.crossover >= minCross && before.crossover <= maxCross) return null;
  const low = Math.max(before.crossover * (1 + 1e-6), minCross);
  if (low > maxCross) throw new Error('A DC-normalized lead cannot lower the lag crossover into this interval. Lower C0 or revise the lag corners.');
  const candidate = (omega: number): LeadPlan | null => {
    const f = frequency(lagLoop, omega), alpha = 1 / f.magnitude ** 2;
    const z = omega / Math.sqrt(alpha), p = omega * Math.sqrt(alpha);
    if (alpha < 1.0001 || alpha > 100 || z < .002 || z > 50 || p < .002 || p > 100) return null;
    return { z, p, alpha, omega, phaseAdded: Math.asin((alpha - 1) / (alpha + 1)) * 180 / Math.PI, targetWithReserve: target };
  };
  let previous = low;
  for (let i = 0; i <= 240; i++) {
    const omega = low * (maxCross / low) ** (i / 240), c = candidate(omega);
    if (c && 180 + frequency(lagLoop, omega).phase + c.phaseAdded >= target) {
      let a = previous, b = omega;
      for (let j = 0; j < 60; j++) { const mid = Math.sqrt(a * b), next = candidate(mid); if (next && 180 + frequency(lagLoop, mid).phase + next.phaseAdded >= target) b = mid; else a = mid; }
      const result = candidate(b)!; const checked = analyze({ ...lagLoop, lead: result });
      if (checked.stability.status !== 'stable' || checked.phaseMargin < target - 1e-7 || Math.abs(checked.crossover / b - 1) > 1e-7) throw new Error('The full lead–lag verification did not meet the proposed design.');
      return result;
    }
    previous = omega;
  }
  throw new Error('No peak-centered lead within the declared corner/ratio and crossover bounds meets the phase target plus 2° reserve. Adjust C0, lag corners or requirements, or try manual lead corners.');
}
export interface Trace { points: { x: number; y: number }[]; overshoot: number; entry: number | null; endingError: number; iae: number; halfStepDifference: number; steps: number }
/** Full controllable canonical state, time u=S*t. No pole cancellation or
 * simple-root/residue assumption. RK4 at h and h/2; compare every coarse node. */
export function stepTrace(a: Analysis, horizon: number): Trace {
  bound(horizon, .5, 200, 'Response horizon'); const { closed, numerator } = a.model, n = closed.length - 1;
  const scale = Math.max(1, ...closed.slice(1).map((v, i) => Math.abs(v) ** (1 / (i + 1))));
  const den = closed.map((v, i) => v / scale ** i), num = Array<number>(n + 1).fill(0), offset = n + 1 - numerator.length;
  numerator.forEach((v, i) => { num[i + offset] = v / scale ** (i + offset); });
  const steps = Math.max(1200, Math.ceil(horizon * scale / .04));
  if (steps * 2 > 60000) throw new Error('The full response exceeds 60,000 steps per run. Shorten the horizon or reduce the fast corner/gain.');
  const run = (count: number): number[] => {
    const h = horizon * scale / count, values = [0]; let state = Array<number>(n).fill(0);
    const derivative = (x: number[]): number[] => [...x.slice(1), 1 - x.reduce((s, v, i) => s + den[n - i] * v, 0)];
    const shifted = (x: number[], k: number[], factor: number) => x.map((v, i) => v + factor * k[i]);
    for (let i = 0; i < count; i++) {
      const k1 = derivative(state), k2 = derivative(shifted(state, k1, h / 2)), k3 = derivative(shifted(state, k2, h / 2)), k4 = derivative(shifted(state, k3, h));
      state = state.map((v, j) => v + h * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]) / 6);
      const y = state.reduce((s, v, j) => s + num[n - j] * v, 0);
      if (!Number.isFinite(y) || Math.abs(y) > 1000 || state.some(v => !Number.isFinite(v) || Math.abs(v) > 1e12)) throw new Error('The full response grew beyond the bounded numerical range; no settling or requirement pass is claimed.');
      values.push(y);
    }
    return values;
  };
  const coarse = run(steps), fine = run(2 * steps), dt = horizon / (2 * steps);
  let difference = 0, maximum = 0, amplitude = 1, lastOutside = -1, iae = 0;
  fine.forEach((y, i) => {
    maximum = Math.max(maximum, y); amplitude = Math.max(amplitude, Math.abs(y)); if (Math.abs(1 - y) > .02) lastOutside = i;
    if (i) iae += dt * (Math.abs(1 - y) + Math.abs(1 - fine[i - 1])) / 2;
    if (i % 2 === 0) difference = Math.max(difference, Math.abs(y - coarse[i / 2]));
  });
  if (difference > .001 * amplitude) throw new Error('The half-step response check did not converge within 0.1% scaled output tolerance.');
  const candidate = (lastOutside + 1) * dt, tail = a.stability.status === 'stable' ? 1 / Math.min(...a.poles.map(z => -z.re)) : Infinity;
  const stride = Math.ceil(fine.length / 900), points = fine.flatMap((y, i) => i % stride === 0 || i === fine.length - 1 ? [{ x: i * dt, y }] : []);
  return { points, overshoot: Math.max(0, maximum - 1) * 100, entry: candidate <= horizon && horizon - candidate >= tail ? candidate : null,
    endingError: 1 - fine[fine.length - 1], iae, halfStepDifference: difference, steps: 2 * steps };
}
