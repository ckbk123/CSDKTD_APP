import { describe, expect, it } from 'vitest';
import { plot } from './plot';
describe('bounded plots', () => {
  it('uses data, common axes, units, guides, requirement band and actual crossing markers', () => {
    const chart = plot({ title: 'Bode', xLabel: 'ω (rad/s)', yLabel: 'Magnitude (dB)', logX: true,
      series: [{ name: 'Before', points: [{ x: .1, y: 20 }, { x: 1, y: 0 }, { x: 10, y: -20 }] }, { name: 'After', points: [{ x: .1, y: 30 }, { x: 1, y: 5 }, { x: 10, y: -15 }] }],
      guides: [{ x: 1 }, { y: 0 }], band: { low: .5, high: 2 }, marks: [{ x: 1, y: 0 }] });
    expect(chart.querySelector('svg')?.getAttribute('aria-label')).toContain('Magnitude (dB)'); expect(chart.textContent).toContain('Before'); expect(chart.textContent).toContain('After');
    expect(chart.querySelectorAll('path')).toHaveLength(2); expect(chart.querySelectorAll('circle')).toHaveLength(1); expect(chart.querySelector('rect')?.getAttribute('width')).not.toBe('0');
    expect(chart.querySelectorAll('path')[0].getAttribute('d')).not.toBe(chart.querySelectorAll('path')[1].getAttribute('d'));
    expect(chart.outerHTML).not.toMatch(/NaN|Infinity/);
  });
  it('handles a zero response and refuses invalid logarithmic/nonfinite/empty data', () => {
    expect(plot({ title: 'Step', xLabel: 's', yLabel: 'y', series: [{ name: 'Zero', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }] }).outerHTML).not.toMatch(/NaN|Infinity/);
    for (const points of [[], [{ x: 0, y: 1 }], [{ x: 1, y: NaN }]]) expect(() => plot({ title: 'Bad', xLabel: 'x', yLabel: 'y', logX: true, series: [{ name: 'bad', points }] })).toThrow('finite');
  });
  it('preserves model line identity if another response cannot be plotted', () => {
    const e = plot({ title: 'Partial', xLabel: 's', yLabel: 'y', series: [{ name: 'Lead–lag', styleIndex: 2, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }] });
    expect(e.querySelector('path')?.classList.contains('cd06-series-2')).toBe(true); expect(e.querySelector('.cd06-key-2')?.textContent).toBe('Lead–lag');
  });
});
