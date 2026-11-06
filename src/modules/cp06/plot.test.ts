import { describe, expect, it } from 'vitest';
import { c } from './complex';
import { trace } from './continuation';
import { baseline } from './model';
import { plane } from './plot';
import { rules } from './rules';

describe('root-locus fixed equal-scale coordinate window', () => {
  it('uses the same world distance for horizontal and vertical movement, including SVG letterboxing', () => {
    const model = baseline(), p = plane(model, trace(model, 140), rules(model), [], c(0), { segments: false, asymptotes: false, tangents: false, vectors: false }, { window: { center: 0, extent: 10 } });
    // An 800×440 box letterboxes the 480×440 viewBox by 160 px on each side.
    p.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 440 } as DOMRect);
    const at = (x: number, y: number) => p.pointFromEvent(new MouseEvent('click', { clientX: x, clientY: y }))!;
    expect(at(400, 204)).toEqual(c(0)); expect(at(436, 204)).toEqual(c(2)); expect(at(400, 168)).toEqual(c(0, 2));
    expect(p.pointFromEvent(new MouseEvent('click', { clientX: 100, clientY: 204 }))).toBeUndefined();
    expect(p.window).toEqual({ center: 0, extent: 10 });
  });
  it('resizes only label/handle styling with readable phone text and the same geometry', () => {
    const model = baseline(), p = plane(model, trace(model, 140), rules(model), [], c(0), { segments: true, asymptotes: false, tangents: false, vectors: false }, { window: { center: 0, extent: 10 }, markers: [{ id: 'pole-0', kind: 'pole', point: c(-5), label: 'Pole', selected: true }] });
    const paths = [...p.element.querySelectorAll('.cp-branch')].map(n => n.getAttribute('d')); p.resize(276);
    const font = Number.parseFloat(p.element.style.getPropertyValue('--cp-plane-font'));
    expect(font * 276 / 480).toBeCloseTo(12, 12); expect(p.element.dataset.compact).toBe('true');
    expect([...p.element.querySelectorAll<SVGTextElement>('.cp-tick')].filter(n => n.style.display !== 'none')).toHaveLength(6);
    expect(Number(p.element.querySelector('.cp-edit-hit')!.getAttribute('r')) * 2 * 276 / 480).toBeCloseTo(44, 10);
    expect([...p.element.querySelectorAll('.cp-branch')].map(n => n.getAttribute('d'))).toEqual(paths); expect(p.window).toEqual({ center: 0, extent: 10 });
  });
});
