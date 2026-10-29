/** Private bounded root routine ported from CP05 at upstream a43989d. */
export interface Root { readonly re: number; readonly im: number; readonly residual: number }
export function numericRoots(input: readonly number[]): Root[] {
  if (input.length < 2 || input.length > 4 || input.some(x => !Number.isFinite(x)) || input.at(-1) === 0) throw new Error('Root evaluation needs a finite degree1–3 polynomial.');
  if (input[0] === 0) {
    let count = 1; while (count < input.length - 1 && input[count] === 0) count++;
    const rest = input.slice(count), remaining = rest.length > 1 ? numericRoots(rest) : [];
    return [...Array.from({ length: count }, () => ({ re: 0, im: 0, residual: 0 })), ...remaining].sort((a, b) => a.re - b.re || a.im - b.im);
  }
  const degree = input.length - 1, leading = input.at(-1)!, monic = input.map(x => x / leading);
  const radius = Math.max(1, ...monic.slice(0, -1).map((c, i) => 2 * Math.abs(c) ** (1 / (degree - i))));
  const p = monic.map((c, i) => c / radius ** (degree - i)); let raw: { re: number; im: number }[];
  if (degree === 1) raw = [{ re: -p[0], im: 0 }];
  else if (degree === 2) {
    const delta = p[1] * p[1] - 4 * p[0];
    if (delta < 0) raw = [{ re: -p[1] / 2, im: Math.sqrt(-delta) / 2 }, { re: -p[1] / 2, im: -Math.sqrt(-delta) / 2 }];
    else if (!delta) raw = [{ re: -p[1] / 2, im: 0 }, { re: -p[1] / 2, im: 0 }];
    else { const q = -.5 * (p[1] + (p[1] < 0 ? -1 : 1) * Math.sqrt(delta)); raw = [{ re: q, im: 0 }, { re: p[0] / q, im: 0 }]; }
  } else {
    const a = p[2], b = p[1] - a * a / 3, c = 2 * a * a * a / 27 - a * p[1] / 3 + p[0], delta = c * c / 4 + b * b * b / 27;
    if (delta >= 0) {
      // Choose the larger Cardano radical, avoiding subtraction of nearly equal
      // terms when the depressed linear coefficient approaches zero.
      const u = Math.cbrt(-c / 2 - (c < 0 ? -1 : 1) * Math.sqrt(delta)), v = u ? -b / (3 * u) : 0, sum = u + v, difference = Math.sqrt(3) * (u - v) / 2;
      raw = [{ re: sum - a / 3, im: 0 }, { re: -sum / 2 - a / 3, im: difference }, { re: -sum / 2 - a / 3, im: -difference }];
    } else {
      const r = 2 * Math.sqrt(-b / 3), angle = Math.acos(Math.max(-1, Math.min(1, -c / (2 * Math.sqrt(-(b * b * b) / 27))))) / 3;
      raw = [0, 1, 2].map(i => ({ re: r * Math.cos(angle - 2 * Math.PI * i / 3) - a / 3, im: 0 }));
    }
  }
  const result = raw.map(z => {
    const re = z.re * radius, im = z.im * radius; let real = 0, imaginary = 0, scale = 0;
    for (let i = monic.length - 1; i >= 0; i--) { [real, imaginary] = [real * re - imaginary * im + monic[i], real * im + imaginary * re]; scale = scale * Math.hypot(re, im) + Math.abs(monic[i]); }
    return { re, im, residual: Math.hypot(real, imaginary) / (scale || 1) };
  });
  let product = [{ re: 1, im: 0 }];
  for (const z of result) {
    const next = Array.from({ length: product.length + 1 }, () => ({ re: 0, im: 0 }));
    product.forEach((c, i) => { next[i].re += -z.re * c.re + z.im * c.im; next[i].im += -z.re * c.im - z.im * c.re; next[i + 1].re += c.re; next[i + 1].im += c.im; }); product = next;
  }
  if (result.some(z => !Number.isFinite(z.residual) || z.residual > 1e-9) || product.some((c, i) => Math.hypot(c.re - monic[i], c.im) > 1e-7 * Math.max(1, Math.abs(monic[i])))) throw new Error('Denominator roots are not resolved at this numerical scale: residual/reconstruction check failed. Rescale coefficients or use a better-separated model.');
  return result.sort((a, b) => a.re - b.re || a.im - b.im);
}
