/** Presentation policy only: every experiment still uses math.run's sample/hold model. */
export type WindowPolicy = 'window' | 'count';
export interface SamplingWindow { readonly count: number; readonly visibleEnd: number; readonly retainedEnd: number }
export function samplingWindow(T: number, policy: WindowPolicy, count: number, requested: number): SamplingWindow {
  if (!Number.isFinite(T) || T < .0001 || T > 10) throw new Error('T must be from 0.0001 to 10 seconds.');
  if (policy === 'window') {
    if (!Number.isFinite(requested) || requested < .0001 || requested > 1190) throw new Error('Use a finite time window from 0.0001 to 1190 seconds.');
    const quotient = requested / T, nearest = Math.round(quotient);
    // A few floating-point ulps at an integer endpoint do not create an extra sample.
    const intervals = Math.ceil(Math.abs(quotient - nearest) <= 8 * Number.EPSILON * Math.max(1, quotient) ? nearest : quotient);
    count = Math.max(4, intervals + 1);
    if (count > 120) throw new Error('This time window needs ' + count + ' sample instants; the limit is 120. Shorten the window, increase T, or choose Fixed sample count.');
  } else if (policy !== 'count') throw new Error('Choose a physical time window or a fixed sample count.');
  if (!Number.isInteger(count) || count < 4 || count > 120) throw new Error('Use an integer from 4 to 120 sample instants.');
  return { count, visibleEnd: policy === 'window' ? requested : (count - 1) * T, retainedEnd: (count - 1) * T };
}
