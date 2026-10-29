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
  a.forEach((x, i) => b.forEach((y, j) => {
    const term = x * y;
    if (x !== 0 && y !== 0 && term === 0) fail('A polynomial product is too small to represent. Rescale the expression.');
    p[i + j] += term;
  }));
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

/** MathLive may omit braces around one-token fraction arguments (\frac12).
 * Expand those TeX arguments before tokenizing decimal numbers. */
function expandFractions(source: string): string {
  let i = 0;
  function argument(depth: number): string {
    if (depth > 24) fail('The expression is nested too deeply.');
    if (source[i] === '{') {
      i++; const body = scan(true, depth + 1);
      if (source[i++] !== '}') fail('Close each fraction box.');
      return body;
    }
    if (source.startsWith('\\frac', i)) return fraction(depth + 1);
    if (source[i] && /[0-9s]/.test(source[i])) return source[i++];
    return fail('Complete each fraction numerator and denominator.');
  }
  function fraction(depth: number): string {
    i += 5; const numerator = argument(depth), denominator = argument(depth);
    return `\\frac{${numerator}}{${denominator}}`;
  }
  function scan(untilBrace: boolean, depth: number): string {
    if (depth > 24) fail('The expression is nested too deeply.');
    let output = '';
    while (i < source.length && !(untilBrace && source[i] === '}')) {
      if (source.startsWith('\\frac', i)) output += fraction(depth + 1);
      else if (source[i] === '{') {
        i++; output += `{${scan(true, depth + 1)}}`;
        if (source[i++] !== '}') fail('Close each expression box.');
      } else output += source[i++];
    }
    return output;
  }
  return scan(false, 0);
}

/** Bounded recursive parser; never executes input. No symbolic cancellation. */
export function parsePlant(latex: string): Plant {
  if (!latex.trim()) fail('Enter a plant transfer function.');
  if (latex.length > 300) fail('Keep the plant expression within 300 characters.');
  const cleaned = latex.replace(/\\(?:left|right)\b/g, '')
    .replace(/\\(?:dfrac|tfrac)\b/g, '\\frac').replace(/\\(?:cdot|times)(?![A-Za-z])/g, '*')
    .replace(/\\[,;! ]/g, '').replace(/\s/g, '').replace(/−/g, '-').replace(/^G\(s\)=/, '');
  const source = expandFractions(cleaned);
  if (/[0-9.][eE]/.test(source)) fail('Use decimal coefficients or textbook powers of ten. In a visual equation, e/E notation is algebra, not a decimal exponent.');
  const tokens = source.match(/\\frac|(?:\d+(?:\.\d*)?|\.\d+)|[s()+\-*/^{}]/g) ?? [];
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
    else if (t && /^(?:\d|\.)/.test(t)) {
      i++; const number = Number(t);
      if (number === 0 && /[1-9]/.test(t.split(/[eE]/)[0])) fail('A nonzero number is too small to represent. Rescale the expression.');
      value = { n: [number], d: [1] };
    }
    else return fail('Complete the plant expression; a number or s is missing.');
    if (peek() === '^') {
      i++;
      const braces = peek() === '{'; if (braces) i++;
      let sign = 1; if (peek() === '-' || peek() === '+') { sign = peek() === '-' ? -1 : 1; i++; }
      const exponent = Number(tokens[i++]) * sign;
      const ten = value.n.length === 1 && value.d.length === 1 && value.n[0] === 10 && value.d[0] === 1;
      if (!Number.isInteger(exponent) || Math.abs(exponent) > (ten ? 400 : 2) || (braces && tokens[i++] !== '}')) fail('Use powers −2…2 for polynomials, or integer powers −400…400 of the number 10, within numeric bounds.');
      if (ten) {
        const result = 10 ** exponent;
        if (result === 0) fail('This power of ten is too small to represent. Rescale the expression.');
        value = { n: trim([result]), d: [1] };
      } else {
        let powered: Rational = { n: [1], d: [1] };
        for (let k = 0; k < Math.abs(exponent); k++) powered = combine(powered, value, '*');
        value = exponent < 0 ? combine({ n: [1], d: [1] }, powered, '/') : powered;
      }
    }
    depth--;
    return value;
  }
  function beginsNumber(at: number): boolean {
    while (tokens[at] === '+' || tokens[at] === '-') at++;
    return /^(?:\d|\.)/.test(tokens[at] ?? '');
  }
  function product(): Rational {
    let start = i;
    let value = atom(), lastNumeric = beginsNumber(start);
    while (i < tokens.length) {
      const t = peek();
      if (t === '*' || t === '/') { i++; start = i; value = combine(value, atom(), t); lastNumeric = beginsNumber(start); }
      else if (t === 's' || t === '(' || t === '{' || t === '\\frac' || /^(?:\d|\.)/.test(t ?? '')) {
        if (t === '\\frac' && lastNumeric) fail('Mixed-number adjacency is unsupported. Use explicit + or − for addition, or × for a product between a number and a fraction.');
        if (/^(?:\d|\.)/.test(t ?? '') && /^(?:\d|\.)/.test(tokens[i - 1] ?? '')) fail('Check the decimal number; separate factors with a multiplication sign.');
        start = i; value = combine(value, atom(), '*'); lastNumeric = beginsNumber(start);
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
  if (n.some((x, k) => x !== 0 && plant.numerator[k] === 0) || d.some((x, k) => x !== 0 && plant.denominator[k] === 0)) fail('Normalization would lose a nonzero coefficient. Rescale the model.');
  if ([...plant.numerator, ...plant.denominator].some(x => Math.abs(x) > 1e6 || !Number.isFinite(x))) fail('Normalized coefficients exceed 10⁶; rescale the model.');
  if (poles(plant).some(p => Math.hypot(p.re, p.im) > 100)) fail('Keep pole magnitudes at or below 100 rad/s.');
  return plant;
}

export function poles(plant: Plant): Complex[] {
  const d = plant.denominator;
  if (d.length === 1) return [];
  if (d.length === 2) return [{ re: -d[0], im: 0 }];
  if (d[0] === 0) return [{ re: 0, im: 0 }, { re: -d[1], im: 0 }];
  const a = -d[1] / 2, delta = a * a - d[0];
  if (d[1] !== 0 && a === 0) fail('The pole real part is too small to represent. Rescale the model.');
  if (delta < 0) return [{ re: a, im: Math.sqrt(-delta) }, { re: a, im: -Math.sqrt(-delta) }];
  // Use the product of the roots to avoid subtracting almost equal values.
  const r = a + (a >= 0 ? 1 : -1) * Math.sqrt(delta);
  const second = r === 0 ? 0 : d[0] / r;
  if (second === 0) fail('A nonzero pole is too small to represent. Rescale the model.');
  return [{ re: r, im: 0 }, { re: second, im: 0 }];
}
export function evaluatePolynomial(p: number[], w: number): Complex {
  const quadratic = (p[2] ?? 0) * w * w, linear = (p[1] ?? 0) * w;
  if ((p[2] && quadratic === 0) || (p[1] && linear === 0)) fail('Frequency substitution would lose a nonzero term. Rescale the model.');
  return { re: (p[0] ?? 0) - quadratic, im: linear };
}
export interface FrequencyValue extends Complex { magnitude: number; phase: number | null; db: number | null }
export function frequency(plant: Plant, w: number): FrequencyValue {
  if (!Number.isFinite(w) || w < 0.01 || w > 100) fail('Frequency must be between 0.01 and 100 rad/s.');
  const n = evaluatePolynomial(plant.numerator, w), d = evaluatePolynomial(plant.denominator, w);
  const scale = plant.denominator.reduce((v, c, i) => v + Math.abs(c) * w ** i, 0);
  if (Math.hypot(d.re, d.im) <= 1e-10 * scale) fail('G(jω) is singular or too close to a denominator zero. Choose another frequency.');
  const norm = Math.hypot(d.re, d.im), dr = d.re / norm, di = d.im / norm;
  const re = (n.re * dr + n.im * di) / norm, im = (n.im * dr - n.re * di) / norm;
  const magnitude = Math.hypot(re, im);
  if (magnitude === 0 && (n.re !== 0 || n.im !== 0)) fail('The nonzero frequency response is too small to represent. Rescale the numerator.');
  const nscale = plant.numerator.reduce((v, c, i) => v + Math.abs(c) * w ** i, 0);
  const zero = Math.hypot(n.re, n.im) <= 1e-12 * nscale || magnitude === 0;
  return { re, im, magnitude, phase: zero ? null : Math.atan2(im, re), db: zero ? null : 20 * Math.log10(magnitude) };
}

/** Insert known positive imaginary-axis poles and numerator notches even when
 * the log grid misses them. Poles break every curve; notches break phase/dB. */
export function frequencySweep(plant: Plant, selected: number): ({ w: number } & FrequencyValue | null)[] {
  const frequencies = Array.from({ length: 301 }, (_, i) => 10 ** (-2 + 4 * i / 300));
  frequencies.push(selected);
  poles(plant).forEach(p => { if (p.re === 0 && p.im >= 0.01 && p.im <= 100) frequencies.push(p.im); });
  const n = plant.numerator;
  if (n.length === 3 && n[1] === 0 && n[0] / n[2] > 0) {
    const notch = Math.sqrt(n[0] / n[2]);
    if (notch >= 0.01 && notch <= 100) frequencies.push(notch);
  }
  return [...new Set(frequencies)].sort((a, b) => a - b).map(w => {
    try { return { w, ...frequency(plant, w) }; } catch { return null; }
  });
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
  if (value.magnitude !== 0 && amplitude * value.magnitude === 0) fail('The output sinusoid amplitude is too small to represent. Increase the input amplitude.');
  const stable = roots.every(p => p.re < 0);
  const classification = stable ? 'Stable steady-state experiment' : roots.some(p => p.re > 0) ? 'Unstable model: analytic frequency evaluation only' : 'Marginal model: no guaranteed steady-state experiment';
  const d = plant.denominator, n = plant.numerator;
  const positiveRate = Math.max(0, ...roots.map(p => p.re));
  let dynamicOutput = false;
  let transient: (t: number) => number = () => 0;
  let bound: (t: number) => number = () => 0;
  if (d.length === 2) {
    const a = d[0], remainder = (n[0] ?? 0) - (n[1] ?? 0) * a;
    dynamicOutput = remainder !== 0;
    const c = amplitude * w / (a * a + w * w) * remainder;
    transient = t => c === 0 ? 0 : c * Math.exp(-a * t);
    bound = t => Math.abs(c) * Math.exp(-a * t);
  } else if (d.length === 3) {
    const a0 = d[0], a1 = d[1], direct = n[2] ?? 0;
    const r0 = (n[0] ?? 0) - direct * a0, r1 = (n[1] ?? 0) - direct * a1;
    dynamicOutput = r0 !== 0 || r1 !== 0;
    const real = a0 - w * w, imaginary = a1 * w, q = real * real + imaginary * imaginary;
    // Particular canonical state x1=A Im(exp(jwt)/D(jw)); x2=x1'.
    const c = amplitude * imaginary / q, v = -amplitude * w * real / q;
    const alpha = -a1 / 2, delta = alpha * alpha - a0;
    if (delta > 0) {
      const [first, second] = roots.map(p => p.re);
      const k1 = (v - second * c) / (first - second), k2 = c - k1;
      const C = (r0 + r1 * first) * k1, E = (r0 + r1 * second) * k2;
      const high = Math.max(first, second), low = Math.min(first, second), gap = high - low;
      const C0 = r0 * c + r1 * v, E0 = r0 * (v - alpha * c) + r1 * (alpha * v - a0 * c);
      transient = t => {
        // Nearby modes can have huge, opposite residues. expm1 evaluates the
        // divided exponential difference without losing the repeated-pole limit.
        if (gap * t < 0.5) {
          if (C0 === 0 && E0 === 0) return 0;
          const coshScaled = (Math.exp(high * t) + Math.exp(low * t)) / 2;
          const sinhScaled = Math.exp(high * t) * -Math.expm1(-gap * t) / gap;
          return C0 * coshScaled + E0 * sinhScaled;
        }
        return (C === 0 ? 0 : C * Math.exp(first * t)) + (E === 0 ? 0 : E * Math.exp(second * t));
      };
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
      if (dynamicOutput && positiveRate * t > 20) fail('The unstable time trace exceeds the numeric reliability bound (positive pole rate × time ≤20). Move the window earlier or raise ω; analytic frequency results remain available.');
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
