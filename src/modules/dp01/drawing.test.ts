import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fitAxis, fitPlane, plane, sequence } from './drawing';
const css = readFileSync('src/modules/dp01/workspace.css', 'utf8');
afterEach(() => vi.restoreAllMocks());
describe('DP01 measured sequence and equal-plane geometry', () => {
  it('keeps 12px sequence labels and independently clips data at a measured 273px width', () => {
    const draw = sequence([{ name: 'output', values: [0, .2, .36, .488] }], .1, true, true, { low: -.2, high: 1.3 }, 273);
    expect(draw.element.getAttribute('viewBox')).toBe('0 0 273 265');
    expect([...draw.element.querySelectorAll('text')].every(node => node.getAttribute('font-size') === '12')).toBe(true);
    const inner = draw.element.querySelector('svg')!; expect(inner.getAttribute('width')).toBe('191'); expect(inner.getAttribute('height')).toBe('190');
    const stems = [...draw.element.querySelectorAll('.dp01-live-stem')], path = draw.element.querySelector('.dp01-held-guide'), before = path!.getAttribute('d'); draw.select(3); draw.select(1);
    expect([...draw.element.querySelectorAll('.dp01-live-stem')]).toEqual(stems); expect(draw.element.querySelector('.dp01-held-guide')).toBe(path); expect(path!.getAttribute('d')).toBe(before);
    expect(Number(draw.element.querySelector('.dp01-live-cursor')!.getAttribute('x1'))).toBeCloseTo(66 + 191 / 3, 12); expect(draw.clipped).toBe(false);
  });
  it('maps nearest integer k with letterboxing and keeps full off-view sample values available', () => {
    const draw = sequence([{ name: 'output', values: [0, 1, 2, 3] }], .1, false, false, { low: 0, high: 1 }, 273);
    vi.spyOn(draw.element, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 546, height: 265 } as DOMRect);
    expect(draw.fromEvent(new MouseEvent('click', { clientX: 10 + 136.5 + 66 + 191 * 2 / 3 }))).toBe(2);
    expect(draw.fromEvent(new MouseEvent('click', { clientX: -100 }))).toBe(0); expect(draw.fromEvent(new MouseEvent('click', { clientX: 1000 }))).toBe(3);
    draw.select(3); expect(draw.element.querySelector('.dp01-cursor-marker')!.getAttribute('visibility')).toBe('hidden'); expect(draw.clipped).toBe(true);
    expect(fitAxis([{ name: 'x', values: [0, 3] }])).toEqual({ low: -.36, high: 3.36 });
  });
  it('keeps the plane square and font/hit size constant in CSS pixels on a narrow host', () => {
    const draw = plane([{ re: .5, im: .5, label: 'A', handle: 'a', selected: true }, { re: .5, im: -.5, label: 'mirror', ghost: true }], 1.65, 273, 'comparison');
    const inner = draw.element.querySelector('svg')!; expect([inner.getAttribute('x'), inner.getAttribute('y'), inner.getAttribute('width'), inner.getAttribute('height'), inner.getAttribute('viewBox')]).toEqual(['80', '20', '280', '280', '0 0 280 280']);
    expect(parseFloat(draw.element.style.getPropertyValue('--dp01-axis-font')) * 273 / 440).toBeCloseTo(12, 12);
    expect(Number(draw.element.querySelector('.dp01-lab-hit')!.getAttribute('r')) * 2 * 273 / 440).toBeCloseTo(44, 12);
    expect(inner.getAttribute('overflow')).toBe('visible');
    expect(draw.element.getAttribute('role')).toBe('group'); expect(inner.lastElementChild!.getAttribute('data-lab-handle')).toBe('a');
    expect(css).toContain('.dp01-responsive-plane > svg'); expect(css).not.toMatch(/\.dp01-responsive-plane\s+svg\s*\{/); expect(css).toMatch(/\.dp01-ghost-root\s*\{[^}]*pointer-events:\s*none/);
  });
  it('inverts equal axes with horizontal and vertical letterboxing and supports far accepted roots', () => {
    const draw = plane([{ re: 10000, im: 0, label: 'retained' }], 1.2, 273, 'all poles');
    vi.spyOn(draw.element, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 880, height: 350 } as DOMRect);
    expect(draw.fromEvent(new MouseEvent('pointermove', { clientX: 10 + 220 + 290, clientY: 20 + 90 }))).toEqual({ re: .6, im: .6 });
    expect(draw.clipped).toBe(true); expect(draw.element.querySelector('svg')!.getAttribute('overflow')).toBe('hidden'); expect(fitPlane([{ re: 10000, im: 0 }])).toBe(11500); expect(draw.element.getAttribute('role')).toBe('img');
    vi.mocked(draw.element.getBoundingClientRect).mockReturnValue({ left: 0, top: 0, width: 440, height: 700 } as DOMRect);
    expect(draw.fromEvent(new MouseEvent('pointermove', { clientX: 220, clientY: 335 }))).toEqual({ re: 0, im: 0 });
  });
});
