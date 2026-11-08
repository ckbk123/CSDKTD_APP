import { describe, expect, it } from 'vitest';
import { createPlot, fittedAxis, pointerFrequency } from './plot';
describe('CP04 responsive logarithmic plot geometry', () => {
  it('maps equal distances to equal frequency ratios and clamps outside the data area', () => {
    const geometry = { start: .01, end: 100, left: 60, right: 300, width: 330 }, rect = { left: 20, width: 330 };
    expect(pointerFrequency(80, rect, geometry)).toBe(.01); expect(pointerFrequency(200, rect, geometry)).toBeCloseTo(1, 14); expect(pointerFrequency(320, rect, geometry)).toBe(100);
    expect(pointerFrequency(-1000, rect, geometry)).toBe(.01); expect(pointerFrequency(1000, rect, geometry)).toBe(100); expect(() => pointerFrequency(10, { ...rect, width: 0 }, geometry)).toThrow('not ready');
  });
  it('retains tiny relative amplitude variation in a fitted linear axis', () => {
    const axis = fittedAxis([{ name: 'tiny response', style: '', values: [1e-18, 1e-20] }], true);
    expect(axis.high).toBeGreaterThan(1e-18); expect(axis.high).toBeLessThan(1.2e-18); expect(axis.low).toBe(0);
  });
  it('keeps six coincident handles separately selectable and clips curves to the fixed axes', () => {
    const result = createPlot([.01, 1, 100], [{ name: 'exact', values: [0, 5, 10], style: 'bode-exact-line' }], Array.from({ length: 6 }, (_, factor) => ({ omega: 1, name: `c${factor + 1}`, style: factor === 2 ? 'bode-selected-marker' : 'bode-checked-marker', factor })), 1, 'rad/s', 'Magnitude response', 'Magnitude [dB]', { width: 305, axis: { low: 0, high: 5 }, interactive: true });
    expect(result.clipped).toBe(true); expect(result.figure.querySelectorAll('[role="slider"]')).toHaveLength(6);
    expect(new Set([...result.figure.querySelectorAll('.bode-hit')].map(c => c.getAttribute('cy'))).size).toBe(6);
    expect([...result.figure.querySelectorAll('.bode-hit')].every(c => c.getAttribute('r') === '22.2')).toBe(true);
    expect(result.figure.querySelector('.bode-selected-marker')).not.toBeNull(); expect(result.figure.querySelector('svg svg')?.getAttribute('overflow')).toBe('hidden');
    expect(result.figure.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 305 270');
  });
});
