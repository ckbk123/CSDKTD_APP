import { expect, it } from 'vitest';
import { fitPlane, plane, position, response, type Marker } from './drawing';
it('uses equal physical coordinate scales and separate45-unit hit targets on a narrow plane', () => {
  const points: Marker[] = [{ key: 'pole:0', x: -1, y: Math.sqrt(3), name: 'Upper pole' }, { key: 'pole:1', x: -1, y: -Math.sqrt(3), name: 'Lower pole' }], d = plane(points, 273, fitPlane(points)); expect((d.geometry.x[1] - d.geometry.x[0]) / (d.geometry.right - d.geometry.left)).toBeCloseTo((d.geometry.y[1] - d.geometry.y[0]) / (d.geometry.bottom - d.geometry.top), 13); expect(d.figure.querySelectorAll('[data-cp02-marker]')).toHaveLength(2); expect(d.figure.querySelector('.cp02-live-hit')!.getAttribute('r')).toBe('22.5'); expect(d.image.getAttribute('viewBox')).toBe('0 0 273 315');
});
it('keeps coincident selected markers accessible without shifting mathematical glyph coordinates', () => {
  const d = plane([{ key: 'pole:0', x: -2, y: 0, name: 'Pole', selected: true }, { key: 'zero', x: -2, y: 0, name: 'Zero', zero: true }], 400, { x: [-4, 0], y: [-2, 2] }); const groups = d.image.querySelectorAll('[data-cp02-marker]'); expect(groups[groups.length - 1].getAttribute('data-cp02-marker')).toBe('pole:0'); expect(groups[0].querySelector('.cp02-live-hit')!.getAttribute('cx')).toBe(groups[1].querySelector('.cp02-live-hit')!.getAttribute('cx')); expect(groups[0].getAttribute('role')).toBe('slider');
});
it('maps a letterboxed time point and moves the cursor without rewriting cached curve paths', () => {
  const d = response([0, 1, 2], [{ name: 'Full output', values: [0, .5, 1], className: 'full' }], 300, [-1, 2]), before = d.viewport.querySelector('path')!.getAttribute('d'), box = { left: 10, top: 20, width: 600, height: 700 } as DOMRect, x = (d.geometry.left + d.geometry.right) / 2; const selected = position(10 + 2 * x, 20 + 35 + 2 * d.geometry.top, box, d.geometry); expect(selected.x).toBeCloseTo(1, 12); d.select(1, .5); expect(d.viewport.querySelector('path')!.getAttribute('d')).toBe(before); expect(d.image.querySelector('[data-cp02-time]')!.getAttribute('aria-valuenow')).toBe('1');
});
