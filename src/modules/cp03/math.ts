/** CP03 only. Polynomial arrays are ascending powers, [constant, s, s²]. */
export interface Plant { numerator: number[]; denominator: number[] }
export interface Complex { re: number; im: number }
type Rational = { n: number[]; d: number[] };
const fail = (message: string): never => { throw new Error(message); };
function trim(p: number[]): number[] {
  while (p.length > 1 && p.at(-1) === 0) p.pop();
  if (p.length > 9 || p.some(x => !Number.isFinite(x) || Math.abs(x) > 1e12)) fail('The expression exceeds the polynomial calculation limit.');
  return p;
}
function add(a: number[], b: number[], sign = 1): number[] {
  return trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + sign * (b[i] ?? 0)));
}
function mul(a: number[], b: number[]): number[] {
  const p = Array(a.length + b.length - 1).fill(0) as number[];
  a.forEach((x, i) => b.forEach((y, j) => { p[i + j] += x * y; }));
  return trim(p);
}
function combine(a: Rational, b: Rational, op: string): Rational {
  if (op === '+') return { n: add(mul(a.n, b.d), mul(b.n, a.d)), d: mul(a.d, b.d) };
  if (op === '-') return { n: add(mul(a.n, b.d), mul(b.n, a.d), -1), d: mul(a.d, b.d) };
  if (op === '/') {
    if (b.n.every(x => x === 0)) fail('Division by a zero polynomial is undefined.');
    return { n: mul(a.n, b.d), d: mul(a.d, b.n) };
  }
  return { n: mul(a.n, b.n), d: mul(a.d, b.d) };
}

/** Bounded recursive parser; never executes input. No symbolic cancellation. */
export function parsePlant(latex: string): Plant {
  if (!latex.trim()) fail('Enter a plant transfer function.');
  if (latex.length > 300) fail('Keep the plant expression within 300 characters.');
  const source = latex.replace(/\\(?:left|right)\b/g, '')
    .replace(/\\(?:dfrac|tfrac)\b/g, '\\frac').replace(/\\(?:cdot|times)\b/g, '*')
    .replace(/\\[,;! ]/g, '').replace(/\s/g, '').replace(/−/g, '-').replace(/^G\(s\)=/, '');
  const tokens = source.match(/\\frac|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[s()+\-*/^{}]/g) ?? [];
  if (!tokens.length || tokens.join('') !== source) fail('Use real numbers, s, sums, products, fractions and integer powers only.');
  if (tokens.length > 160) fail('The plant expression contains too many terms.');
  let i = 0, depth = 0;
  const peek = () => tokens[i];
  function group(): Rational {
    const opener = tokens[i++];
    const closer = opener === '(' ? ')' : '}';
    const value = expression();
    if (tokens[i++] !== closer) fail('Close each parenthesis and fill each fraction box.');
    return value;
  }
  function atom(): Rational {
    if (++depth > 24) fail('The expression is nested too deeply.');
    let value: Rational;
    const t = peek();
    if (t === '+' || t === '-') {
      i++; value = atom();
      if (t === '-') value = { n: value.n.map(x => -x), d: value.d };
    } else if (t === '(' || t === '{') value = group();
    else if (t === '\\frac') {
      i++;
      if (peek() !== '{') fail('Complete the fraction numerator.');
      const n = group();
      if (peek() !== '{') fail('Complete the fraction denominator.');
      value = combine(n, group(), '/');
    } else if (t === 's') { i++; value = { n: [0, 1], d: [1] }; }
    else if (t && /^(?:\d|\.)/.test(t)) { i++; value = { n: [Number(t)], d: [1] }; }
    else return fail('Complete the plant expression; a number or s is missing.');
    if (peek() === '^') {
      i++;
      const braces = peek() === '{'; if (braces) i++;
      let sign = 1; if (peek() === '-') { sign = -1; i++; }
      const exponent = Number(tokens[i++]) * sign;
      if (!Number.isInteger(exponent) || Math.abs(exponent) > 2 || (braces && tokens[i++] !== '}')) fail('Use integer powers from −2 to 2.');
      let powered: Rational = { n: [1], d: [1] };
      for (let k = 0; k < Math.abs(exponent); k++) powered = combine(powered, value, '*');
      value = exponent < 0 ? combine({ n: [1], d: [1] }, powered, '/') : powered;
    }
    depth--;
    return value;
  }
  function product(): Rational {
    let value = atom();
    while (i < tokens.length) {
      const t = peek();
      if (t === '*' || t === '/') { i++; value = combine(value, atom(), t); }
      else if (t === 's' || t === '(' || t === '{' || t === '\\frac' || /^(?:\d|\.)/.test(t ?? '')) {
        if (/^(?:\d|\.)/.test(t ?? '') && /^(?:\d|\.)/.test(tokens[i - 1] ?? '')) fail('Check the decimal number; separate factors with a multiplication sign.');
        value = combine(value, atom(), '*');
      }
      else break;
    }
    return value;
  }
  function expression(): Rational {
    let value = product();
    while (peek() === '+' || peek() === '-') { const t = tokens[i++]; value = combine(value, product(), t); }
    return value;
  }
  const parsed = expression();
  if (i !== tokens.length) fail('Check the parentheses, powers and fraction structure.');
  const n = trim(parsed.n), d = trim(parsed.d);
  if (d.every(x => x === 0)) fail('The denominator cannot be zero.');
  if (d.length > 3 || n.length > 3) fail('This exercise supports polynomials through second order.');
  if (n.length > d.length) fail('An improper plant requires derivatives of the input; use a proper transfer function here.');
  if ([...n, ...d].some(x => Math.abs(x) > 1e4)) fail('Keep expanded coefficients at or below 10000 in magnitude.');
  const leading = d.at(-1)!;
  if (Math.abs(leading) < 1e-8) fail('The leading denominator coefficient is too small (minimum magnitude 10⁻⁸).');
  const plant = { numerator: n.map(x => x / leading), denominator: d.map(x => x / leading) };
  if ([...plant.numerator, ...plant.denominator].some(x => Math.abs(x) > 1e6 || !Number.isFinite(x))) fail('Normalized coefficients exceed 10⁶; rescale the model.');
  if (poles(plant).some(p => Math.hypot(p.re, p.im) > 100)) fail('Keep pole magnitudes at or below 100 rad/s.');
  return plant;
}

export function poles(plant: Plant): Complex[] {
  const d = plant.denominator;
  if (d.length === 1) return [];
  if (d.length === 2) return [{ re: -d[0], im: 0 }];
  const a = -d[1] / 2, delta = a * a - d[0];
  if (delta < 0) return [{ re: a, im: Math.sqrt(-delta) }, { re: a, im: -Math.sqrt(-delta) }];
  // Use the product of the roots to avoid subtracting almost equal values.
  const r = a + (a >= 0 ? 1 : -1) * Math.sqrt(delta);
  return [{ re: r, im: 0 }, { re: r === 0 ? 0 : d[0] / r, im: 0 }];
}
export function evaluatePolynomial(p: number[], w: number): Complex {
  return { re: (p[0] ?? 0) - (p[2] ?? 0) * w * w, im: (p[1] ?? 0) * w };
}
export interface FrequencyValue extends Complex { magnitude: number; phase: number | null; db: number | null }
export function frequency(plant: Plant, w: number): FrequencyValue {
  if (!Number.isFinite(w) || w < 0.01 || w > 100) fail('Frequency must be between 0.01 and 100 rad/s.');
  const n = evaluatePolynomial(plant.numerator, w), d = evaluatePolynomial(plant.denominator, w);
  const scale = plant.denominator.reduce((v, c, i) => v + Math.abs(c) * w ** i, 0);
  if (Math.hypot(d.re, d.im) <= 1e-10 * scale) fail('G(jω) is singular or too close to a denominator zero. Choose another frequency.');
  const q = d.re * d.re + d.im * d.im;
  const re = (n.re * d.re + n.im * d.im) / q, im = (n.im * d.re - n.re * d.im) / q;
  const magnitude = Math.hypot(re, im);
  const nscale = plant.numerator.reduce((v, c, i) => v + Math.abs(c) * w ** i, 0);
  const zero = Math.hypot(n.re, n.im) <= 1e-12 * nscale || magnitude === 0;
  return { re, im, magnitude, phase: zero ? null : Math.atan2(im, re), db: zero ? null : 20 * Math.log10(magnitude) };
}

export interface Experiment {
  value: FrequencyValue; stable: boolean; classification: string; period: number;
  particular(t: number): { input: number; particular: number };
  sample(t: number): { input: number; particular: number; transient: number; output: number };
  tailBound(t: number): number;
}
export function experiment(plant: Plant, w: number, amplitude: number): Experiment {
  if (!Number.isFinite(amplitude) || amplitude < 0.01 || amplitude > 100) fail('Input amplitude must be between 0.01 and 100.');
  const value = frequency(plant, w), roots = poles(plant);
  const stable = roots.every(p => p.re < 0);
  const classification = stable ? 'Stable steady-state experiment' : roots.some(p => p.re > 0) ? 'Unstable model: analytic frequency evaluation only' : 'Marginal model: no guaranteed steady-state experiment';
  const d = plant.denominator, n = plant.numerator;
  let transient: (t: number) => number = () => 0;
  let bound: (t: number) => number = () => 0;
  if (d.length === 2) {
    const a = d[0], remainder = (n[0] ?? 0) - (n[1] ?? 0) * a;
    const c = amplitude * w / (a * a + w * w) * remainder;
    transient = t => c === 0 ? 0 : c * Math.exp(-a * t);
    bound = t => Math.abs(c) * Math.exp(-a * t);
  } else if (d.length === 3) {
    const a0 = d[0], a1 = d[1], direct = n[2] ?? 0;
    const r0 = (n[0] ?? 0) - direct * a0, r1 = (n[1] ?? 0) - direct * a1;
    const real = a0 - w * w, imaginary = a1 * w, q = real * real + imaginary * imaginary;
    // Particular canonical state x1=A Im(exp(jwt)/D(jw)); x2=x1'.
    const c = amplitude * imaginary / q, v = -amplitude * w * real / q;
    const alpha = -a1 / 2, delta = alpha * alpha - a0;
    if (delta > 0) {
      const [first, second] = roots.map(p => p.re);
      const k1 = (v - second * c) / (first - second), k2 = c - k1;
      const C = (r0 + r1 * first) * k1, E = (r0 + r1 * second) * k2;
      transient = t => (C === 0 ? 0 : C * Math.exp(first * t)) + (E === 0 ? 0 : E * Math.exp(second * t));
      bound = t => Math.abs(C) * Math.exp(first * t) + Math.abs(E) * Math.exp(second * t);
    } else if (delta < 0) {
      const beta = Math.sqrt(-delta), k = (v - alpha * c) / beta;
      const C = r0 * c + r1 * v, E = r0 * k + r1 * (alpha * k - beta * c);
      transient = t => C === 0 && E === 0 ? 0 : Math.exp(alpha * t) * (C * Math.cos(beta * t) + E * Math.sin(beta * t));
      bound = t => Math.exp(alpha * t) * Math.hypot(C, E);
    } else {
      const k = v - alpha * c;
      const C = r0 * c + r1 * v, E = (r0 + r1 * alpha) * k;
      transient = t => C === 0 && E === 0 ? 0 : (C + E * t) * Math.exp(alpha * t);
      bound = t => {
        const peak = alpha < 0 && E !== 0 ? Math.max(t, -1 / alpha - Math.abs(C / E)) : t;
        return (Math.abs(C) + Math.abs(E) * peak) * Math.exp(alpha * peak);
      };
    }
  }
  const particularSample = (t: number) => {
      if (!Number.isFinite(t) || t < 0 || t > 3000) fail('Time must be between 0 and 3000 s.');
      const input = amplitude * Math.sin(w * t);
      const particular = amplitude * (value.re * Math.sin(w * t) + value.im * Math.cos(w * t));
      if (![input, particular].every(x => Number.isFinite(x) && Math.abs(x) <= 1e8)) fail('The particular sinusoid exceeds the display bound (10⁸). Reduce the amplitude or plant gain.');
      return { input, particular };
  };
  return {
    value, stable, classification, period: 2 * Math.PI / w, particular: particularSample,
    sample(t) {
      const { input, particular } = particularSample(t);
      const tr = transient(t), output = particular + tr;
      if (![input, particular, tr, output].every(x => Number.isFinite(x) && Math.abs(x) <= 1e8)) fail('The response exceeds the display bound (10⁸). Shorten the start time or use a stable model.');
      return { input, particular, transient: tr, output };
    },
    tailBound(t) {
      if (!Number.isFinite(t) || t < 0 || t > 3000) fail('Time must be between 0 and 3000 s.');
      return stable ? bound(t) : Infinity;
    },
  };
}

/** Marker phase uses the principal interval [−π, π], modulo one period. */
export function measure(inputTime: number, outputTime: number, outputAmplitude: number, w: number, inputAmplitude: number): { gain: number; phase: number } {
  if (![inputTime, outputTime, outputAmplitude, w, inputAmplitude].every(Number.isFinite) || w <= 0 || inputAmplitude <= 0 || outputAmplitude < 0) fail('Use finite marker values and positive frequency/input amplitude.');
  const raw = -w * (outputTime - inputTime);
  return { gain: outputAmplitude / inputAmplitude, phase: Math.atan2(Math.sin(raw), Math.cos(raw)) };
}
