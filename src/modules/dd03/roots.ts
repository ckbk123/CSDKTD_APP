export interface Complex { re: number; im: number }
const ROUND = 64 * Number.EPSILON;
function quadratic(p: number[]): Complex[] {
  const [a, b, c] = p, discriminant = b * b - 4 * a * c, noise = ROUND * (b * b + Math.abs(4 * a * c));
  if (discriminant !== 0 && Math.abs(discriminant) <= noise) throw new Error('Nearly repeated roots are numerically unresolved at this coefficient precision.');
  if (discriminant < 0) { const im = Math.sqrt(-discriminant) / (2 * Math.abs(a)); return [{ re: -b / (2 * a), im }, { re: -b / (2 * a), im: -im }]; }
  if (discriminant === 0) return [{ re: -b / (2 * a), im: 0 }, { re: -b / (2 * a), im: 0 }];
  const q = -.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant)); return [{ re: q / a, im: 0 }, { re: c / q, im: 0 }];
}
function cMultiply(a: Complex, b: Complex): Complex { return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }; }
function evaluate(p: number[], z: Complex) {
  let value: Complex = { re: 0, im: 0 };
  for (const coefficient of p) { value = cMultiply(value, z); value.re += coefficient; }
  return Math.hypot(value.re, value.im);
}
/** Complete degree1–3 roots; stable quadratic deflation, cubic real solution,
 * scaled residuals and a full Vieta check. Conditioning failure is explicit. */
export function polynomialRoots(p: number[]): Complex[] {
  if (p.length < 2 || p.length > 4 || p[0] !== 1 || p.some(x => !Number.isFinite(x) || Math.abs(x) > 1e6)) throw new Error('Use a monic degree1–3 polynomial with finite coefficients of magnitude at most1e6.');
  let values: Complex[];
  if (p.length === 2) values = [{ re: -p[1], im: 0 }];
  else if (p[p.length - 1] === 0) values = [...polynomialRoots(p.slice(0, -1)), { re: 0, im: 0 }];
  else if (p.length === 3) values = quadratic(p);
  else {
    const [, a, b, c] = p, depressedP = b - a * a / 3, depressedQ = 2 * a ** 3 / 27 - a * b / 3 + c;
    const q2 = (depressedQ / 2) ** 2, p3 = (depressedP / 3) ** 3, delta = q2 + p3;
    if (delta !== 0 && Math.abs(delta) <= ROUND * (Math.abs(q2) + Math.abs(p3))) throw new Error('Nearly repeated cubic roots are numerically unresolved at this coefficient precision.');
    if (delta < 0) {
      const size = 2 * Math.sqrt(-depressedP / 3), cosine = -depressedQ / (2 * Math.sqrt(-((depressedP / 3) ** 3)));
      if (Math.abs(cosine) > 1 + ROUND) throw new Error('Cubic angle conditioning is unresolved.');
      const angle = Math.acos(Math.max(-1, Math.min(1, cosine)));
      values = [0, 1, 2].map(k => ({ re: size * Math.cos((angle + 2 * k * Math.PI) / 3) - a / 3, im: 0 }));
    } else if (delta === 0) {
      const u = Math.cbrt(-depressedQ / 2); values = [{ re: 2 * u - a / 3, im: 0 }, { re: -u - a / 3, im: 0 }, { re: -u - a / 3, im: 0 }];
    } else {
      const u = Math.cbrt(-depressedQ / 2 - (depressedQ < 0 ? -1 : 1) * Math.sqrt(delta)), v = u === 0 ? 0 : -depressedP / (3 * u);
      let real = u + v - a / 3;
      for (let step = 0; step < 8; step++) {
        const f = ((real + a) * real + b) * real + c, derivative = (3 * real + 2 * a) * real + b;
        if (derivative === 0) break;
        const next = real - f / derivative;
        if (!Number.isFinite(next) || Math.abs(((next + a) * next + b) * next + c) > Math.abs(f)) break;
        real = next;
      }
      if (real === 0) throw new Error('Cubic deflation is numerically unresolved.');
      values = [{ re: real, im: 0 }, ...quadratic([1, a + real, -c / real])];
    }
  }
  for (const z of values) {
    const r = Math.hypot(z.re, z.im), scale = p.reduce((s, coefficient, i) => s + Math.abs(coefficient) * r ** (p.length - i - 1), 0);
    if (!Number.isFinite(r) || evaluate(p, z) > 1e-8 * Math.max(1, scale)) throw new Error('The complete root residual check failed; roots are unavailable.');
  }
  let reconstructed: Complex[] = [{ re: 1, im: 0 }];
  for (const z of values) {
    const next = Array.from({ length: reconstructed.length + 1 }, () => ({ re: 0, im: 0 }));
    reconstructed.forEach((coefficient, i) => { next[i].re += coefficient.re; next[i].im += coefficient.im; const term = cMultiply(coefficient, z); next[i + 1].re -= term.re; next[i + 1].im -= term.im; });
    reconstructed = next;
  }
  if (reconstructed.some((z, i) => Math.hypot(z.re - p[i], z.im) > 1e-8 * Math.max(1, ...p.map(Math.abs)))) throw new Error('The full Vieta reconstruction is unresolved; no complete pole set is certified.');
  return values;
}
