/** CF01 continuous closed-loop step response. Coefficients of T are descending:
 * g/(s²+a1 s+a0). Optional factors p/(s+p) and (1+s/z) have unity DC gain.
 * All explicitly chosen denominator factors are retained, including cancellation.
 * Finite modal evaluation is numerical; no sampled trace is a settling proof. */
export interface Model { g: number; a1: number; a0: number; pole?: number; zero?: number }
export interface Complex { re: number; im: number }
export interface Mode { pole: Complex; coefficient: Complex; power: number }
export interface Response {
  model: Model; naturalFrequency: number; damping: number; finalValue: number;
  poles: Complex[]; modes: Mode[]; coefficientScale: number;
}
const fail = (message: string): never => { throw new Error(message); };
const c = (re: number, im = 0): Complex => ({ re, im });
const add = (a: Complex, b: Complex) => c(a.re + b.re, a.im + b.im);
const sub = (a: Complex, b: Complex) => c(a.re - b.re, a.im - b.im);
const mul = (a: Complex, b: Complex) => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const scale = (a: Complex, b: number) => c(a.re * b, a.im * b);
const magnitude = (a: Complex) => Math.hypot(a.re, a.im);
function div(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0 || !Number.isFinite(d)) return fail('A modal denominator is singular or outside the finite range.');
  return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
}
function product(a: Complex[], b: Complex[]): Complex[] {
  const result = Array.from({ length: a.length + b.length - 1 }, () => c(0));
  a.forEach((x, i) => b.forEach((y, j) => { result[i + j] = add(result[i + j], mul(x, y)); }));
  return result;
}
const factorial = (n: number) => n === 2 ? 2 : 1;
function settings(model: Model): { naturalFrequency: number; damping: number } {
  const { g, a1, a0, pole, zero } = model;
  if (![g, a1, a0].every(Number.isFinite) || g < 1e-9 || g > 1000 || a1 <= 0 || a0 <= 0) fail('Use a finite positive numerator and stable second-order denominator; gain is from 10⁻⁹ to 1000.');
  const naturalFrequency = Math.sqrt(a0), damping = a1 / (2 * naturalFrequency);
  if (naturalFrequency < .05 || naturalFrequency > 20 || damping < .02 || damping > 3) fail('Use natural frequency 0.05–20 rad/s and damping ratio 0.02–3.');
  if (pole !== undefined && (!Number.isFinite(pole) || pole < .02 || pole > 50)) fail('The added stable pole is at −p, with p from 0.02 to 50 s⁻¹.');
  if (zero !== undefined && (!Number.isFinite(zero) || Math.abs(zero) < .02 || Math.abs(zero) > 50)) fail('The added zero is at −z, with |z| from 0.02 to 50 s⁻¹; negative z gives a RHP zero.');
  return { naturalFrequency, damping };
}
export function buildResponse(input: Model): Response {
  const model = { ...input }, { naturalFrequency, damping } = settings(model);
  const discriminant = model.a1 * model.a1 - 4 * model.a0;
  let poles: Complex[];
  if (discriminant < 0) {
    const frequency = Math.sqrt(-discriminant) / 2;
    poles = [c(-model.a1 / 2, frequency), c(-model.a1 / 2, -frequency)];
  } else if (discriminant === 0) poles = [c(-model.a1 / 2), c(-model.a1 / 2)];
  else {
    const fast = -(model.a1 + Math.sqrt(discriminant)) / 2;
    poles = [c(fast), c(model.a0 / fast)];
  }
  if (model.pole !== undefined) poles.push(c(-model.pole));
  const groups: { pole: Complex; multiplicity: number }[] = [];
  for (const pole of poles) {
    const match = groups.find(group => group.pole.re === pole.re && group.pole.im === pole.im);
    if (match) match.multiplicity++;
    else groups.push({ pole, multiplicity: 1 });
  }
  for (let i = 0; i < groups.length; i++) for (let j = 0; j < i; j++) {
    if (magnitude(sub(groups[i].pole, groups[j].pole)) <= 1e-5 * Math.max(1, magnitude(groups[i].pole), magnitude(groups[j].pole))) fail('Distinct poles are too close for the supported modal conditioning. Use exactly repeated factors or separate them further.');
  }
  const numerator = model.a0 * (model.pole ?? 1), modes: Mode[] = [];
  for (const group of groups) {
    // Taylor coefficients of g(s)=s times every other denominator factor,
    // at s=λ+t. Expanding N/g supplies all repeated-pole partial fractions.
    let denominator = [group.pole, c(1)];
    for (const other of groups) if (other !== group) for (let j = 0; j < other.multiplicity; j++) denominator = product(denominator, [sub(group.pole, other.pole), c(1)]);
    const top = model.zero === undefined ? [c(numerator)] : [scale(add(c(1), scale(group.pole, 1 / model.zero)), numerator), c(numerator / model.zero)];
    const expansion: Complex[] = [];
    for (let k = 0; k < group.multiplicity; k++) {
      let value = top[k] ?? c(0);
      for (let j = 1; j <= k; j++) value = sub(value, mul(denominator[j] ?? c(0), expansion[k - j]));
      expansion.push(div(value, denominator[0]));
      const power = group.multiplicity - 1 - k;
      modes.push({ pole: group.pole, power, coefficient: scale(expansion[k], 1 / factorial(power)) });
    }
  }
  const coefficientScale = modes.reduce((sum, mode) => sum + magnitude(mode.coefficient), 0);
  if (!Number.isFinite(coefficientScale) || coefficientScale > 1e6) fail('Modal coefficients are too ill-conditioned for a reliable response. Separate near-coincident poles.');
  const result: Response = { model, naturalFrequency, damping, finalValue: model.g / model.a0, poles, modes, coefficientScale };
  const origin = normalizedAt(result, 0);
  const expectedSlope = model.pole === undefined && model.zero !== undefined ? model.a0 / model.zero : 0;
  if (Math.abs(origin.value) > 1e-9 || Math.abs(origin.slope - expectedSlope) > 1e-8 * (1 + Math.abs(expectedSlope))) fail('Initial-condition residual is too large for reliable modal evaluation.');
  // A different rational identity checks the entire expansion, including
  // repeated terms, at three non-pole points before showing a response.
  for (const point of [c(.5), c(.7, 1.3), c(2.1, -.8)]) {
    let expanded = div(c(1), point);
    for (const mode of modes) {
      let divisor = c(1);
      for (let j = 0; j <= mode.power; j++) divisor = mul(divisor, sub(point, mode.pole));
      expanded = add(expanded, div(scale(mode.coefficient, factorial(mode.power)), divisor));
    }
    let divisor = point;
    for (const pole of poles) divisor = mul(divisor, sub(point, pole));
    const top = model.zero === undefined ? c(numerator) : scale(add(c(1), scale(point, 1 / model.zero)), numerator);
    const expected = div(top, divisor);
    if (magnitude(sub(expanded, expected)) > 1e-9 * (1 + magnitude(expected))) fail('Transfer-identity residual is too large for reliable modal evaluation.');
  }
  return result;
}
/** Value and slope normalized by the positive DC step value; all initial states
 * zero. The optional zero may cause inverse response, not a derivative impulse. */
export function normalizedAt(response: Response, time: number): { value: number; slope: number } {
  if (!Number.isFinite(time) || time < 0 || time > 100) fail('Use a response time from 0 to 100 seconds.');
  let value = 1, slope = 0;
  for (const mode of response.modes) {
    const exponential = scale(c(Math.cos(mode.pole.im * time), Math.sin(mode.pole.im * time)), Math.exp(mode.pole.re * time));
    const power = time ** mode.power, common = mul(mode.coefficient, exponential);
    value += common.re * power;
    const derivative = add(scale(mode.pole, power), c(mode.power === 0 ? 0 : mode.power * time ** (mode.power - 1)));
    slope += mul(common, derivative).re;
  }
  if (![value, slope].every(Number.isFinite)) fail('Response exceeded the finite numerical range.');
  return { value, slope };
}
/** Upper envelope of every modal term for all t≥H, with a roundoff allowance.
 * Repeated terms reach their maximum at k/σ; never assume t^k exp(−σt)
 * is already decreasing at the displayed horizon. Numerical conditioning and
 * residual gates apply; this is not interval-certified arithmetic. */
export function futureEnvelope(response: Response, horizon: number): number {
  if (!Number.isFinite(horizon) || horizon < 0 || horizon > 100) fail('Use a horizon from 0 to 100 seconds.');
  let envelope = 0;
  for (const mode of response.modes) {
    const maximumTime = Math.max(horizon, mode.power / -mode.pole.re);
    envelope += magnitude(mode.coefficient) * maximumTime ** mode.power * Math.exp(mode.pole.re * maximumTime);
  }
  return envelope + roundoffAllowance(response, horizon);
}
export function roundoffAllowance(response: Response, horizon: number): number {
  if (!Number.isFinite(horizon) || horizon < 0 || horizon > 100) fail('Use a horizon from 0 to 100 seconds.');
  return 512 * Number.EPSILON * (1 + response.coefficientScale) * (1 + horizon * horizon);
}
