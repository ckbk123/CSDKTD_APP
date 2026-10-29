export type IntegralRule = 'forward' | 'backward' | 'trapezoidal';
export type DerivativeRule = 'backward' | 'tustin' | 'filtered' | 'forward';
export interface Parameters {
  readonly kp: number; readonly ki: number; readonly kd: number; readonly period: number;
  readonly integral: IntegralRule; readonly derivative: DerivativeRule; readonly tau: number;
}
export interface Model extends Parameters {
  readonly c0: number; readonly c1: number; readonly alpha: number; readonly beta: number;
  readonly b: readonly [number, number, number]; readonly a: readonly [number, number, number];
}
export interface InitialMemory { readonly e0: number; readonly eMinus1: number; readonly i0: number; readonly d0: number }
export interface Memory {
  readonly k: number; readonly ePrev: number; readonly eOlder: number;
  readonly integral: number; readonly derivative: number; readonly output: number; readonly delta: number;
}
const fail = (message: string): never => { throw new Error(message); };
function bounded(value: number, bound: number, label: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > bound) fail(`${label} must be finite with magnitude at most ${bound}.`);
  return value;
}
function arithmetic(value: number): number {
  return bounded(value, 1e12, 'Computed arithmetic (reduce gains, memory or error)');
}
function multiply(a: number, b: number): number {
  const value = a * b;
  if (a !== 0 && b !== 0 && value === 0) fail('A nonzero product is too small to represent. Increase its magnitude.');
  return arithmetic(value);
}
function divide(a: number, b: number): number {
  const value = a / b;
  if (a !== 0 && value === 0) fail('A nonzero quotient is too small to represent. Increase its magnitude.');
  return arithmetic(value);
}

/** q=z^-1 coefficients, ordered from present sample to oldest delayed sample. */
export function derive(p: Parameters): Model {
  for (const [name, value] of [['Kp', p.kp], ['Ki', p.ki], ['Kd', p.kd]] as const) bounded(value, 10000, name);
  if (!Number.isFinite(p.period) || p.period < 0.001 || p.period > 10) fail('T must be from 0.001 to 10 seconds.');
  if (!['forward', 'backward', 'trapezoidal'].includes(p.integral)) fail('Choose a supported integration rule.');
  if (p.derivative === 'forward') fail('Forward differentiation requires e[k+1]. It cannot execute causally from the current and old errors; choose backward, Tustin or filtered D.');
  if (!['backward', 'tustin', 'filtered'].includes(p.derivative)) fail('Choose a supported derivative rule.');
  if (p.derivative === 'filtered' && (!Number.isFinite(p.tau) || p.tau < 0.001 || p.tau > 10)) fail('Filter time constant τ must be from 0.001 to 10 seconds.');
  const h = multiply(p.ki, p.period);
  const c0 = p.integral === 'forward' ? 0 : p.integral === 'backward' ? h : divide(h, 2);
  const c1 = p.integral === 'backward' ? 0 : p.integral === 'forward' ? h : divide(h, 2);
  const alpha = p.derivative === 'backward' ? 0 : p.derivative === 'tustin' ? -1 : p.tau / (p.tau + p.period);
  const beta = p.derivative === 'backward' ? divide(p.kd, p.period)
    : p.derivative === 'tustin' ? divide(2 * p.kd, p.period) : divide(p.kd, p.tau + p.period);
  if (p.kd !== 0 && beta === 0) fail('The derivative gain is too small to represent. Increase its magnitude.');
  const b = [p.kp + c0 + beta, -p.kp * (1 + alpha) + c1 - alpha * c0 - 2 * beta, p.kp * alpha - alpha * c1 + beta] as const;
  return { ...p, c0, c1, alpha, beta, b, a: [1, -(1 + alpha), alpha] };
}

/** k starts at 1. Map the positional states into a consistent incremental history. */
export function initialize(model: Model, initial: InitialMemory): Memory {
  bounded(initial.e0, 10000, 'e[0]'); bounded(initial.eMinus1, 10000, 'e[−1]');
  bounded(initial.i0, 1e6, 'I[0]'); bounded(initial.d0, 1e6, 'D[0]');
  const derivative = model.alpha === 0 ? multiply(model.beta, initial.e0 - initial.eMinus1) : initial.d0;
  const output = arithmetic(multiply(model.kp, initial.e0) + initial.i0 + derivative);
  let delta = 0; // alpha=0 discards this history exactly.
  if (model.alpha !== 0) {
    const previousI = arithmetic(initial.i0 - multiply(model.c0, initial.e0) - multiply(model.c1, initial.eMinus1));
    const previousD = divide(derivative - multiply(model.beta, initial.e0 - initial.eMinus1), model.alpha);
    const previousU = arithmetic(multiply(model.kp, initial.eMinus1) + previousI + previousD);
    delta = arithmetic(output - previousU);
  }
  return { k: 1, ePrev: initial.e0, eOlder: initial.eMinus1, integral: initial.i0, derivative, output, delta };
}

/** Pure read/calculate step. The returned next memory is committed by the caller. */
export function calculate(model: Model, old: Memory, error: number) {
  if (!Number.isInteger(old.k) || old.k < 1 || old.k > 40) fail('Execute at most 40 error samples.');
  bounded(error, 10000, 'Error sample');
  for (const value of [old.ePrev, old.eOlder, old.integral, old.derivative, old.output, old.delta]) arithmetic(value);
  const proportional = multiply(model.kp, error);
  const integralCurrent = multiply(model.c0, error), integralPrevious = multiply(model.c1, old.ePrev);
  const integral = arithmetic(old.integral + integralCurrent + integralPrevious);
  const derivativeMemory = multiply(model.alpha, old.derivative);
  const derivativeChange = multiply(model.beta, error - old.ePrev);
  const derivative = arithmetic(derivativeMemory + derivativeChange);
  const position = arithmetic(proportional + integral + derivative);
  const incrementTerms = [multiply(model.alpha, old.delta), multiply(model.b[0], error), multiply(model.b[1], old.ePrev), multiply(model.b[2], old.eOlder)];
  const increment = arithmetic(incrementTerms.reduce((sum, term) => sum + term, 0));
  const incremental = arithmetic(old.output + increment);
  const residual = Math.abs(position - incremental);
  const scale = Math.max(1, Math.abs(proportional), Math.abs(integral), Math.abs(derivative), Math.abs(incremental), ...incrementTerms.map(Math.abs));
  if (residual > 1e-9 * scale) fail('Positional and incremental arithmetic lost agreement. Reduce gain or memory magnitudes.');
  const next: Memory = { k: old.k + 1, ePrev: error, eOlder: old.ePrev, integral, derivative, output: position, delta: position - old.output };
  return { k: old.k, time: old.k * model.period, error, old, proportional, integralCurrent, integralPrevious,
    integral, derivativeMemory, derivativeChange, derivative, position, incrementTerms, increment, incremental, residual, next };
}
export type Step = ReturnType<typeof calculate>;

export function simulate(model: Model, initial: InitialMemory, errors: readonly number[]): Step[] {
  if (!errors.length || errors.length > 40) fail('Enter 1 to 40 error samples.');
  let memory = initialize(model, initial);
  return errors.map(error => { const step = calculate(model, memory, error); memory = step.next; return step; });
}
