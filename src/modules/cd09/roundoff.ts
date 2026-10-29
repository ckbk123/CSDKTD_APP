/** Numerical qualification of a fixed signed transition, not an interval proof.
 * Local errors are propagated by signed powers before taking absolute bounds;
 * iterating |F| would invent growth even for a stable rotating trajectory. */
export function allowanceStepper(F: readonly number[], initial: readonly number[], n: number): (local: readonly number[]) => number[] {
  const round = 64 * Number.EPSILON;
  interface Power { value: number[]; radius: number[]; absolute: number[] }
  const make = (value: number[], radius: number[]): Power => ({ value, radius, absolute: value.map((v, i) => (Math.abs(v) + radius[i]) * (1 + round)) });
  const zero = Array(n * n).fill(0) as number[];
  const cache = new Map<number, Power>([
    [0, make(Array.from({ length: n * n }, (_, i) => Number(Math.floor(i / n) === i % n)), [...zero])],
    [1, make([...F], [...zero])],
  ]);
  function product(a: Power, b: Power): Power {
    const value = [...zero], radius = [...zero];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      const x = a.value[i * n + k], y = b.value[k * n + j], ex = a.radius[i * n + k], ey = b.radius[k * n + j], term = x * y;
      value[i * n + j] += term;
      radius[i * n + j] += Math.abs(x) * ey + ex * Math.abs(y) + ex * ey + round * Math.abs(term);
    }
    if ([...value, ...radius].some(v => !Number.isFinite(v))) throw new Error('Roundoff amplification makes the transition powers numerically unresolved. Shorten the horizon or rescale the model.');
    return make(value, radius.map(v => v * (1 + round)));
  }
  function power(k: number): Power {
    const found = cache.get(k); if (found) return found;
    const half = power(Math.floor(k / 2)), result = k % 2 ? product(product(half, half), cache.get(1)!) : product(half, half);
    cache.set(k, result); return result;
  }
  const history: (readonly number[])[] = [];
  return local => {
    history.push(local); const length = history.length, first = power(length).absolute;
    const errors = Array.from({ length: n }, (_, i) => initial.reduce((sum, e, j) => sum + first[i * n + j] * e, 0));
    history.forEach((errorsAtStep, j) => {
      const kernel = power(length - j - 1).absolute;
      for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) errors[i] += kernel[i * n + k] * errorsAtStep[k];
    });
    return errors.map(v => v * (1 + round * (length + 1)));
  };
}
