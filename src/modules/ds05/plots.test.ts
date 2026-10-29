import { describe, expect, it } from 'vitest';
import { plane } from './plots';
import { modelFromText } from './model';
import { mapAt, winding } from './winding';

describe('computed contour plot boundaries', () => {
  it('lists roots outside the source box without clamping a false marker onto its edge', () => {
    const m = modelFromText('.5', 'z-20'), p = plane(m, winding(m).points, true);
    expect(p.outside).toBe(2); expect(p.contains({ re: 20, im: 0 })).toBe(false);
    expect(p.element.querySelectorAll('.dn-open-root,.dn-closed-root')).toHaveLength(0);
    p.update(mapAt(m, 0)); expect(p.element.querySelector('.dn-marker')!.getAttribute('visibility')).toBe('visible');
  });
  it('clips a selected critical view while retaining true coordinates', () => {
    const m = modelFromText(), run = winding(m), p = plane(m, run.points, false, true), cursor = mapAt(m, 0);
    expect(p.outside).toBeGreaterThan(0); expect(p.contains(cursor.loop!)).toBe(false); p.update(cursor);
    expect(Number(p.element.querySelector('.dn-marker')!.getAttribute('cx'))).toBeGreaterThan(330);
    expect(p.element.querySelector('svg svg')!.getAttribute('overflow')).toBe('hidden');
  });
  it('preserves gaps around interior contour poles and hides only the missing mapped point', () => {
    const m = modelFromText('.5', 'z^2+1'), run = winding(m), mapped = plane(m, run.points, false), source = plane(m, run.points, true);
    const path = mapped.element.querySelector('.dn-image-curve')!.getAttribute('d')!;
    expect((path.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(3); expect(path).not.toMatch(/NaN|Infinity/); expect(path).not.toContain('Z');
    const cursor = mapAt(m, Math.PI / 2); mapped.update(cursor); source.update(cursor);
    expect(mapped.element.querySelector('.dn-marker')!.getAttribute('visibility')).toBe('hidden');
    expect(source.element.querySelector('.dn-marker')!.getAttribute('visibility')).toBe('visible');
  });
});
