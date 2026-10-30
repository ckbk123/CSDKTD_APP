import { bound, multiply, poles, residual, routh, stepTrace, type Complex, type ResponseModel, type Trace } from './engine';
export { bound, residual, stepTrace };
export interface Plant { g: number; a: number; c0: number }
export interface Target { sigma: number; omega: number }
export interface Lead extends Target { g: number; a: number; pole: number; zero: number; gain: number; remaining: number; deficiency: number; poleAngle: number; zeroAngle: number; angleResidual: number; magnitudeGain: number }
export interface Lag { z: number; p: number }
export interface Checked extends ResponseModel { plant: Plant; lead?: Lead; lag?: Lag; gain: number; open: number[]; kv: number; rampError: number | null; clustered: boolean }
export function validatePlant(p: Plant): void { bound(p.g, .05, 20, 'Plant numerator g'); bound(p.a, .2, 20, 'Plant pole parameter a'); bound(p.c0, .05, 50, 'Baseline gain C0'); }
export function targetFromSpecs(overshoot: number, settling: number): Target {
  bound(overshoot, .1, 40, 'Approximate pair overshoot (%)'); bound(settling, .4, 40, 'Approximate pair settling time (s)');
  const sigma = 4 / settling, omega = -Math.PI * sigma / Math.log(overshoot / 100); bound(omega, .1, 20, 'Derived imaginary part'); return { sigma, omega };
}
/** Match (s+r)[s²+2σs+(σ²+ω²)] to s(s+a)(s+p)+gK(s+z).
 * Independently cross-check the angle and magnitude at -σ+jω. */
export function designLead(p: Plant, target: Target, pole: number): Lead {
  validatePlant(p); const { g, a } = p, { sigma, omega } = target;
  bound(sigma, .1, 10, 'Target decay σ'); bound(omega, .1, 20, 'Target imaginary part ω'); bound(pole, .2, 50, 'Lead pole');
  const remaining = a + pole - 2 * sigma, q = sigma * sigma + omega * omega;
  if (remaining < .02) throw new Error('Choose the lead pole/target so a+pD−2σ ≥ 0.02. The remaining pole must also be strictly stable.');
  const kg = q + 2 * sigma * remaining - a * pole;
  if (kg <= .0001) throw new Error('This target/pole needs nonpositive or unresolved gain. Change the lead pole or transient target.');
  const gain = bound(kg / g, .001, 5000, 'Lead gain K'), zero = bound(q * remaining / kg, .01, 50, 'Lead zero');
  if (pole - zero < .0001) throw new Error('This choice is not a resolved lead: require 0 < zD < pD. Change the lead pole or target.');
  const theta0 = Math.atan2(omega, -sigma), thetaA = Math.atan2(omega, a - sigma), poleAngle = Math.atan2(omega, pole - sigma), zeroAngle = Math.atan2(omega, zero - sigma);
  const angleResidual = Math.atan2(Math.sin(zeroAngle - theta0 - thetaA - poleAngle + Math.PI), Math.cos(zeroAngle - theta0 - thetaA - poleAngle + Math.PI));
  const magnitudeGain = Math.hypot(sigma, omega) * Math.hypot(a - sigma, omega) * Math.hypot(pole - sigma, omega) / (g * Math.hypot(zero - sigma, omega));
  if (Math.abs(angleResidual) > 1e-9 || Math.abs(magnitudeGain - gain) > 1e-9 * Math.max(1, gain)) throw new Error('Angle/magnitude checks did not resolve for this target.');
  return { ...target, g, a, pole, zero, gain, remaining, deficiency: theta0 + thetaA - Math.PI, poleAngle, zeroAngle, angleResidual, magnitudeGain };
}
export function requiredRatio(lead: Checked, maxError: number): number {
  bound(maxError, .0001, 1000, 'Maximum unit-ramp error');
  if (!lead.lead || lead.lag || lead.stability.status !== 'stable' || lead.rampError === null) throw new Error('Check a strictly stable lead-only model before allocating lag accuracy.');
  return Math.max(1, lead.rampError / maxError);
}
export function lagForTarget(lead: Checked, maxError: number, zero: number): Lag {
  const beta = requiredRatio(lead, maxError); bound(beta, 1, 50, 'Required lag ratio'); bound(zero, .002, 10, 'Lag zero');
  return { z: zero, p: bound(zero / beta, .00004, 10, 'Derived lag pole') };
}
function characteristic(p: Plant, lead: Lead | undefined, lag: Lag | undefined, gain: number): { open: number[]; numerator: number[]; closed: number[] } {
  let open = [1, p.a, 0], numerator = [p.g * gain];
  if (lead) { open = multiply(open, [1, lead.pole]); numerator = multiply(numerator, [1, lead.zero]); }
  if (lag) { open = multiply(open, [1, lag.p]); numerator = multiply(numerator, [1, lag.z]); }
  const closed = [...open], offset = open.length - numerator.length; numerator.forEach((v, i) => { closed[i + offset] += v; }); return { open, numerator, closed };
}
export function check(p: Plant, lead?: Lead, lag?: Lag): Checked {
  validatePlant(p);
  if (lag && !lead) throw new Error('Allocate the transient lead before adding lag.');
  if (lead) {
    if (lead.g !== p.g || lead.a !== p.a) throw new Error('Recalculate the lead for the current plant.');
    // Never accept an edited/corrupted gain/zero as the checked target construction.
    const derived = designLead(p, lead, lead.pole);
    if (Math.abs(lead.gain / derived.gain - 1) > 1e-10 || Math.abs(lead.zero / derived.zero - 1) > 1e-10) throw new Error('Recalculate the lead gain and zero for this target.');
  }
  if (lag) { bound(lag.z, .002, 10, 'Lag zero'); bound(lag.p, .00004, 10, 'Lag pole'); bound(lag.z / lag.p, 1, 50, 'Chosen lag ratio'); }
  const gain = lead ? lead.gain : p.c0, m = characteristic(p, lead, lag, gain), stability = routh(m.closed), roots = poles(m.closed);
  if (stability.status === 'stable' && roots.some(z => z.re >= 0)) throw new Error('Numerical poles and Routh do not agree on strict stability; revise the parameters.');
  const kv = p.g * gain / p.a * (lead ? lead.zero / lead.pole : 1) * (lag ? lag.z / lag.p : 1);
  const clustered = roots.some((z, i) => roots.some((w, j) => i !== j && Math.hypot(z.re - w.re, z.im - w.im) < 1e-4 * Math.max(1, Math.hypot(z.re, z.im), Math.hypot(w.re, w.im))));
  return { plant: { ...p }, ...(lead ? { lead: { ...lead } } : {}), ...(lag ? { lag: { ...lag } } : {}), gain, open: m.open,
    model: { closed: m.closed, numerator: m.numerator }, stability, poles: roots, clustered, kv, rampError: stability.status === 'stable' ? 1 / kv : null };
}
export interface Locus { gains: number[]; branches: Complex[][]; maximum: number }
function orders(n: number): number[][] { if (!n) return [[]]; return orders(n - 1).flatMap(p => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)])); }
/** Finite, bounded illustration. Each sample retains all roots; strict selected
 * stability is checked independently, never inferred from drawn branches. */
export function rootLocus(c: Checked, requestedMax: number): Locus {
  if (!c.lead) throw new Error('Reveal the lead before drawing its locus.'); bound(requestedMax, .01, 10000, 'Root-locus maximum gain');
  const maximum = Math.max(requestedMax, 1.2 * c.gain), gains = [...new Set([...Array.from({ length: 241 }, (_, i) => maximum * (i / 240) ** 2), c.gain])].sort((a, b) => a - b);
  const initial = [{ re: 0, im: 0 }, { re: -c.plant.a, im: 0 }, { re: -c.lead.pole, im: 0 }, ...(c.lag ? [{ re: -c.lag.p, im: 0 }] : [])];
  const branches = initial.map(z => [z]), permutations = orders(initial.length);
  for (const gain of gains.slice(1)) {
    const coefficients = characteristic(c.plant, c.lead, c.lag, gain).closed, roots = poles(coefficients);
    if (roots.some(z => residual(coefficients, z) >= 1e-9)) throw new Error('A locus sample did not resolve; reduce its gain range or revise the corners.');
    const previous = branches.map(b => b.at(-1)!);
    const cost = (order: number[]) => order.reduce((sum, j, i) => sum + Math.hypot(roots[j].re - previous[i].re, roots[j].im - previous[i].im) ** 2, 0);
    const best = permutations.reduce((a, b) => cost(a) <= cost(b) ? a : b); branches.forEach((b, i) => b.push(roots[best[i]]));
  }
  return { gains, branches, maximum };
}
export interface Limits { maxOvershoot: number; entryDeadline: number; maxRamp: number }
export function nextStep(c: Checked, trace: Trace | undefined, limits: Limits): string {
  if (c.stability.status !== 'stable') return 'Full model is not strictly stable. Revise the lead/lag corners before claiming transient or final-error performance.';
  if (c.lead && !c.lag && trace) {
    if (trace.overshoot > limits.maxOvershoot) return 'Lead overshoot fails. Revise the transient target or chosen lead pole before allocating lag.';
    if (trace.entry === null) return 'Lead band entry is unresolved. Increase the observation horizon if work limits permit before allocating lag.';
    if (trace.entry > limits.entryDeadline) return 'Lead entry deadline fails. Revise the transient target or lead pole before allocating lag.';
  }
  if (c.rampError! > limits.maxRamp * (1 + 1e-9)) return c.lag ? 'Tracking error fails: increase the lag ratio, then recheck how its corners affect the transients.' : c.lead ? 'Lead alone misses the tracking target. Allocate lag gain using the required error ratio.' : 'Baseline tracking error fails. Design lead for the transient target, then allocate the required lag accuracy.';
  if (!trace) return 'Verify the complete response before accepting the design.';
  if (trace.overshoot > limits.maxOvershoot) return c.lag ? 'Overshoot fails after adding lag. Move the lag corners farther below the transient modes, or redesign lead for more damping; keep rechecking the full model.' : c.lead ? 'Lead overshoot fails. Revise the transient target or chosen lead pole before allocating lag.' : 'Baseline overshoot fails. Design lead for the transient target and recheck all modes.';
  if (trace.entry === null) return 'Observed band entry is unresolved. Increase the observation horizon if work limits permit; inspect the slow added mode.';
  if (trace.entry > limits.entryDeadline) return 'Entry deadline fails. Revisit the transient target/lead and lag placement, then recheck every mode.';
  return 'All displayed checks met; transient values remain finite-window observations.';
}
