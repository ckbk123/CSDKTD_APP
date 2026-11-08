import { describe, expect, it } from 'vitest';
import { samplingWindow } from './window';
describe('declared sampling display windows', () => {
  it('keeps a three-second physical window while revealing the required sample count', () => {
    expect(samplingWindow(.1, 'window', 31, 3)).toEqual({ count: 31, visibleEnd: 3, retainedEnd: 3 });
    expect(samplingWindow(.2, 'window', 31, 3)).toEqual({ count: 16, visibleEnd: 3, retainedEnd: 3 });
    expect(samplingWindow(.05, 'window', 31, 3)).toEqual({ count: 61, visibleEnd: 3, retainedEnd: 3 });
    expect(samplingWindow(.1, 'window', 31, .3).count).toBe(4);
  });
  it('discloses a retained endpoint beyond a noncommensurate window and never rounds T', () => {
    expect(samplingWindow(.3, 'window', 31, 1)).toEqual({ count: 5, visibleEnd: 1, retainedEnd: 1.2 });
    expect(samplingWindow(10, 'window', 31, 3)).toEqual({ count: 4, visibleEnd: 3, retainedEnd: 30 });
  });
  it('rejects the physical-window budget instead of silently changing the clock or count', () => {
    expect(() => samplingWindow(.001, 'window', 31, 3)).toThrow('3001 sample instants');
    expect(() => samplingWindow(.1, 'window', 31, 0)).toThrow('time window');
  });
  it('preserves the entire original fixed-count domain and ignores inactive window drafts', () => {
    expect(samplingWindow(.0001, 'count', 120, NaN).retainedEnd).toBeCloseTo(.0119, 15);
    expect(samplingWindow(10, 'count', 120, NaN).retainedEnd).toBe(1190);
    expect(() => samplingWindow(.1, 'count', 4.5, 3)).toThrow('integer');
    expect(() => samplingWindow(0, 'count', 31, 3)).toThrow('T must');
  });
});
