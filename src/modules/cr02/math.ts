/** One scalar force balance: m y'' + c y' + k y = b u + d u'. */
export interface Model { readonly m: number; readonly c: number; readonly k: number; readonly b: number; readonly d: number }
export interface Initial { readonly y: number; readonly v: number }
export type Excitation = 'zero' | 'step' | 'ramp';
export interface Experiment { readonly initial: Initial; readonly excitation: Excitation; readonly amplitude: number }
export interface Response { readonly t: number; readonly free: number; readonly forced: number; readonly total: number; readonly freeVelocity: number; readonly forcedVelocity: number; readonly velocity: number; readonly input: number }
export interface Pole { readonly re: number; readonly im: number }
export const BASELINE: Model = Object.freeze({ m: 1, c: 3, k: 2, b: 1, d: 0 });
const keys = ['m', 'c', 'k', 'b', 'd'] as const;
function fail(message: string): never { throw new Error(message); }
export function validateModel(model: Model): void {
  for (const key of keys) {
    const value = model[key];
    if (!Number.isFinite(value) || Math.abs(value) > 1000 || (value !== 0 && Math.abs(value) < 1e-9)) fail('Coefficients must be finite: zero or magnitude from 10⁻⁹ to 1,000.');
  }
  if (model.m < .01) fail('Mass m must be between 0.01 and 1,000 kg; a zero leading coefficient is not a second-order model.');
  if (model.c < 0 || model.k < 0) fail('This physical model supports nonnegative damping and stiffness.');
}
function literal(text: string): number {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) fail('Use numeric coefficients; unknown parameters and functions are unsupported.');
  const value = Number(text);
  if (!Number.isFinite(value) || (value === 0 && /[1-9]/.test(text.split(/[eE]/)[0]))) fail('A numeric coefficient is outside the supported floating-point range.');
  return value;
}
/** Read numeric MathLive fraction arguments, including its compact \\frac12. */
function expandFractions(text: string): string {
  let output = '', i = 0;
  while (i < text.length) {
    const match = /^\\(?:dfrac|tfrac|frac)(?=[{0-9])/.exec(text.slice(i));
    if (!match) { output += text[i++]; continue; }
    i += match[0].length;
    function argument(): string {
      if (text[i] !== '{') {
        if (/\d/.test(text[i] ?? '')) return text[i++];
        return fail('Complete both numeric fraction boxes.');
      }
      const start = ++i;
      while (i < text.length && text[i] !== '}') i++;
      if (i === text.length) fail('Close the numeric fraction.');
      return text.slice(start, i++);
    }
    const numerator = literal(argument()), denominator = literal(argument());
    if (denominator === 0) fail('A coefficient fraction cannot divide by zero.');
    const value = numerator / denominator;
    if (!Number.isFinite(value) || (numerator !== 0 && value === 0)) fail('A coefficient fraction is outside the supported numerical range.');
    output += `(${value})`;
  }
  return output;
}
export function parseOde(latex: string): Model {
  if (!latex.trim()) fail('Enter a second-order ODE.');
  if (latex.length > 600) fail('Keep the ODE under 600 characters.');
  let text = latex.replace(/\\(?:left|right)/g, '').replace(/\\(?:,|!|;|quad|qquad| )/g, '').replace(/\s/g, '').replace(/−/g, '-');
  // Font wrappers around a numeric literal are presentation, not new algebra.
  // Never remove them around variables, functions or arbitrary expressions.
  while(true){
    const next=text.replace(/\\(?:mathrm|mathit|mathbf|mathsf|mathtt|text)\{([+-]?(?:\d+(?:\.\d*)?|\.\d+))\}/g,'$1').replace(/\\mathrm([0-9])/g,'$1');
    if(next===text)break;
    text=next;
  }
  text = text.replace(/\\(?:cdot|times)/g, '*')
    .replace(/\\ddot\{?y\}?/g, "y''").replace(/\\dot\{?y\}?/g, "y'").replace(/\\dot\{?u\}?/g, "u'")
    .replace(/\\doubleprime/g, "''").replace(/\\prime/g, "'");
  if (/[eE]/.test(text)) fail('Enter decimal coefficients, not e/E notation: the visual editor treats e/E as mathematical symbols.');
  if (/[0-9)]\^\{?[+-]?[0-9]/.test(text)) fail('Enter decimal coefficients such as 0.01. Coefficient powers of ten are not supported in this ODE input.');
  text = expandFractions(text).replace(/([yu])((?:\^\{'+\}|\^'+|')+)/g, (_, variable: string, suffix: string) => {
    const order = [...suffix].filter(character => character === "'").length;
    if (order > (variable === 'y' ? 2 : 1)) fail('Only derivatives through y″ and the first derivative u′ are supported.');
    return variable + "'".repeat(order);
  })
    .replace(/y''/g, 'Y2').replace(/y'/g, 'Y1').replace(/u'/g, 'U1').replace(/y/g, 'Y0').replace(/u/g, 'U0');
  const scalar = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?`;
  const unsigned = scalar.replace('[+-]?', '');
  const numericGroup = new RegExp(`\\(([+-]*)(${unsigned})\\)`, 'g');
  while (true) {
    const next = text.replace(numericGroup, (_, signs: string, value: string) => `${[...signs].filter(s=>s==='-').length%2?'-':''}${value}`);
    if(next===text)break;
    text=next;
  }
  const sides = text.split('=');
  if (sides.length !== 2 || sides.some(s => !s)) fail('Use one equality: m y″ + c y′ + k y = b u + d u′.');
  function collect(side: string, channel: 'Y' | 'U'): number[] {
    if (side === '0') return [0, 0, 0];
    const term = new RegExp(`([+-]*)((${unsigned})\\*?)?(${channel}[012])`, 'gy');
    const values = [0, 0, 0]; let position = 0, count = 0;
    while (position < side.length) {
      term.lastIndex = position; const match = term.exec(side);
      if (!match || (position > 0 && !match[1]) || ++count > 16) fail('Use sums of numeric multiples of y″, y′, y on the left and u, u′ on the right.');
      const order = Number(match[4].slice(1));
      if (channel === 'U' && order > 1) fail('Only the first derivative of the same scalar input is supported.');
      const coefficient = ([...match[1]].filter(s=>s==='-').length%2 ? -1 : 1) * (match[3] ? literal(match[3]) : 1);
      values[order] += coefficient; position = term.lastIndex;
    }
    return values;
  }
  const a = collect(sides[0], 'Y'), b = collect(sides[1], 'U');
  const model = { m: a[2], c: a[1], k: a[0], b: b[0], d: b[1] };
  validateModel(model); return model;
}

// Four-state augmentation [y, v, t-generator, constant]. Scaling to norm <= 1/2
// bounds the 26-term exponential series remainder below 3e-36 before roundoff.
// Squaring restores the original time. No inverse of the physical A is used.
type Matrix = number[];
function identity(): Matrix { return Array.from({ length: 16 }, (_, i) => Number(Math.floor(i / 4) === i % 4)); }
function multiply(a: Matrix, b: Matrix): Matrix {
  return Array.from({ length: 16 }, (_, index) => {
    const row = Math.floor(index / 4), col = index % 4;
    let sum = 0; for (let k = 0; k < 4; k++) sum += a[4 * row + k] * b[4 * k + col];
    if (!Number.isFinite(sum) || Math.abs(sum) > 1e100) fail('The response calculation exceeds the numerical range. Reduce the data or horizon.');
    return sum;
  });
}
function exponential(a: Matrix): Matrix {
  const norm = Math.max(...Array.from({ length: 4 }, (_, row) => a.slice(4 * row, 4 * row + 4).reduce((sum, v) => sum + Math.abs(v), 0)));
  const squarings = Math.max(0, Math.ceil(Math.log2(norm / .5)));
  if (!Number.isFinite(norm) || squarings > 36) fail('The requested coefficient/time scale exceeds the bounded response calculation.');
  const scaled = a.map(v => v / 2 ** squarings);
  let term = identity(), result = identity();
  for (let n = 1; n <= 26; n++) { term = multiply(term, scaled).map(v => v / n); result = result.map((v, i) => v + term[i]); }
  for (let n = 0; n < squarings; n++) result = multiply(result, result);
  return result;
}
function validateExperiment(experiment: Experiment): void {
  if (!['zero', 'step', 'ramp'].includes(experiment.excitation)) fail('Choose zero, step or ramp excitation.');
  if (![experiment.initial.y, experiment.initial.v, experiment.amplitude].every(v => Number.isFinite(v) && Math.abs(v) <= 100)) fail('Initial displacement, velocity and input amplitude/slope must be finite with magnitude at most 100.');
}
export function responseAt(model: Model, experiment: Experiment, t: number): Response {
  validateModel(model); validateExperiment(experiment);
  if (!Number.isFinite(t) || t < 0 || t > 60) fail('Inspect a finite time between 0 and 60 seconds.');
  const { m, c, k, b, d } = model, amplitude = experiment.amplitude;
  const f0 = experiment.excitation === 'step' ? b * amplitude : experiment.excitation === 'ramp' ? d * amplitude : 0;
  const f1 = experiment.excitation === 'ramp' ? b * amplitude : 0;
  const velocityJump = experiment.excitation === 'step' ? d * amplitude / m : 0;
  const a = [0, 1, 0, 0, -k / m, -c / m, f1 / m, f0 / m, 0, 0, 0, 1, 0, 0, 0, 0].map(v => v * t);
  const e = exponential(a), free = e[0] * experiment.initial.y + e[1] * experiment.initial.v;
  const freeVelocity = e[4] * experiment.initial.y + e[5] * experiment.initial.v;
  const forced = e[1] * velocityJump + e[3], forcedVelocity = e[5] * velocityJump + e[7];
  const total = free + forced, velocity = freeVelocity + forcedVelocity;
  if (![free, freeVelocity, forced, forcedVelocity, total, velocity].every(v => Number.isFinite(v) && Math.abs(v) <= 1e12)) fail('A response exceeds magnitude 10¹². Reduce initial data, input or horizon.');
  const input = experiment.excitation === 'step' ? amplitude : experiment.excitation === 'ramp' ? amplitude * t : 0;
  return { t, free, forced, total, freeVelocity, forcedVelocity, velocity, input };
}
export function responseSamples(model: Model, experiment: Experiment, horizon: number, count = 301): Response[] {
  if (!Number.isFinite(horizon) || horizon < .001 || horizon > 60) fail('Plot horizon must be from 0.001 to 60 seconds.');
  if (!Number.isInteger(count) || count < 2 || count > 1001) fail('Use from 2 to 1,001 response samples.');
  return Array.from({ length: count }, (_, i) => responseAt(model, experiment, i * horizon / (count - 1)));
}
export function poles(model: Model): { discriminant: number; roots: readonly Pole[] } {
  validateModel(model);
  const { m, c, k } = model, discriminant = c * c - 4 * m * k;
  if (discriminant < 0) {
    const re = -c / (2 * m), im = Math.sqrt(-discriminant) / (2 * m);
    return { discriminant, roots: [{ re, im }, { re, im: -im }] };
  }
  const q = -.5 * (c + Math.sqrt(discriminant));
  return { discriminant, roots: q === 0 ? [{ re: 0, im: 0 }, { re: 0, im: 0 }] : [{ re: q / m, im: 0 }, { re: k / q, im: 0 }] };
}
export function dcGain(model: Model): { kind: 'finite'; value: number; cancellation: boolean } | { kind: 'no-finite-limit' | 'out-of-range' } {
  validateModel(model);
  let value: number, cancellation = false;
  if (model.b === 0 && model.d === 0) { value = 0; cancellation = model.k === 0; }
  else if (model.k > 0) value = model.b / model.k;
  else if (model.b === 0 && model.c > 0) { value = model.d / model.c; cancellation = true; }
  else return { kind: 'no-finite-limit' };
  return Number.isFinite(value) && Math.abs(value) <= 1e12 ? { kind: 'finite', value, cancellation } : { kind: 'out-of-range' };
}
export function initialPolynomial(model: Model, initial: Initial): readonly [number, number] {
  validateModel(model); validateExperiment({ initial, excitation: 'zero', amplitude: 0 });
  return [model.m * initial.y, model.m * initial.v + model.c * initial.y];
}
export function warnings(model: Model, horizon: number, count: number): string[] {
  const roots = poles(model).roots, result: string[] = [];
  if (Math.max(...roots.map(p => Math.abs(p.im))) * horizon / (count - 1) > Math.PI / 8) result.push('The plot spacing may miss fast oscillation. Reduce the horizon or increase samples; the connecting lines do not establish peaks.');
  if (Math.max(...roots.map(p => Math.abs(p.re))) * horizon / (count - 1) > 1) result.push('The plot spacing may miss a fast decay transient. Reduce the horizon or increase samples before interpreting early-time shape.');
  const decayRates = roots.filter(p => p.re < 0).map(p => -p.re);
  if (decayRates.length && horizon * Math.min(...decayRates) < 5) result.push('This horizon is shorter than five slow decay time constants; it may not show settling.');
  if (roots.some(p => p.re === 0)) result.push('A pole has zero real part. Do not infer settling or a final value from this finite trace.');
  return result;
}
export function formatNumber(value: number): string { return Number(value.toPrecision(7)).toString(); }
export function latexNumber(value: number): string { return formatNumber(value).replace(/e([+-]?\d+)$/, (_, exponent: string) => `\\times10^{${Number(exponent)}}`); }
function decimal(value: number): string {
  const s = value.toString(); if (!/[eE]/.test(s)) return s;
  const [mantissa, power] = s.split(/[eE]/), negative = mantissa.startsWith('-'), body = mantissa.replace('-', '');
  const digits = body.replace('.', ''), point = (body.includes('.') ? body.indexOf('.') : body.length) + Number(power);
  return `${negative ? '-' : ''}${point <= 0 ? `0.${'0'.repeat(-point)}${digits}` : point >= digits.length ? digits + '0'.repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`}`;
}
function sum(terms: readonly { coefficient: number; symbol: string }[], exactInput = false): string {
  const kept = terms.filter(t => t.coefficient !== 0);
  return kept.length ? kept.map((t, i) => `${t.coefficient < 0 ? '-' : i ? '+' : ''}${Math.abs(t.coefficient) === 1 && t.symbol ? '' : exactInput ? decimal(Math.abs(t.coefficient)) : latexNumber(Math.abs(t.coefficient))}${t.symbol}`).join('') : '0';
}
export function odeLatex(model: Model): string {
  return `${sum([{coefficient:model.m,symbol:"y''"},{coefficient:model.c,symbol:"y'"},{coefficient:model.k,symbol:'y'}], true)}=${sum([{coefficient:model.b,symbol:'u'},{coefficient:model.d,symbol:"u'"}], true)}`;
}
export function equations(model: Model, initial: Initial): { denominator: string; numerator: string; transfer: string; normalized: string; transformed: string; split: string; state: string } {
  validateModel(model); const { m, c, k, b, d } = model;
  const denominator = sum([{coefficient:m,symbol:'s^2'},{coefficient:c,symbol:'s'},{coefficient:k,symbol:''}]);
  const numerator = sum([{coefficient:d,symbol:'s'},{coefficient:b,symbol:''}]);
  const [i1, i0] = initialPolynomial(model, initial), history = sum([{coefficient:i1,symbol:'s'},{coefficient:i0,symbol:''}]);
  return { denominator, numerator,
    transfer: `G(s)=\\left.\\frac{Y(s)}{U(s)}\\right|_{\\mathrm{zero\\ initial}}=\\frac{${numerator}}{${denominator}}`,
    normalized: odeLatex({m:1,c:c/m,k:k/m,b:b/m,d:d/m}),
    transformed: `(${denominator})Y(s)=(${numerator})U(s)+(${history})`,
    split: `Y(s)=\\underbrace{\\frac{${history}}{${denominator}}}_{Y_{\\mathrm{zi}}(s)}+\\underbrace{\\frac{${numerator}}{${denominator}}U(s)}_{Y_{\\mathrm{zs}}(s)}`,
    state: `x_1=y,\\quad x_2=y'-(${latexNumber(d/m)})u,\\qquad \\dot x=\\begin{bmatrix}0&1\\\\${latexNumber(-k/m)}&${latexNumber(-c/m)}\\end{bmatrix}x+\\begin{bmatrix}${latexNumber(d/m)}\\\\${latexNumber(b/m-c*d/(m*m))}\\end{bmatrix}u,\\quad y=x_1`,
  };
}
