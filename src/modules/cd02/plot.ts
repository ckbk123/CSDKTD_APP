import { draw } from './drawing';
export interface Series { label: string; x: readonly number[]; y: readonly number[]; dashed?: boolean }
export interface Mark { x: number; y: number; label: string; kind: 'pole' | 'zero' | 'selected' }
export type Plot = HTMLDivElement & { redraw: (width: number) => void };
/** Data and redraw state belong to this returned visit-owned element. */
export function plot(title: string, xLabel: string, yLabel: string, series: Series[], marks: Mark[] = [], equalScale = false): Plot {
  const host = document.createElement('div') as Plot; host.className = 'cd02-plot-holder'; let lastWidth = 0;
  host.redraw = width => {
    width = Math.max(200, width); if (Math.abs(width - lastWidth) < 1) return; lastWidth = width;
    const drawing = draw({ title, width, equal: equalScale, curves: series.map(s => ({ label: s.label, points: s.x.map((re, i) => ({ re, im: s.y[i] })), dashed: s.dashed })), points: marks.map(m => ({ re: m.x, im: m.y, label: m.label, kind: m.kind === 'selected' ? 'root' : m.kind })), xLabel, yLabel }); host.replaceChildren(drawing.figure);
    if (marks.length) { const legend = document.createElement('p'); legend.className = 'cd02-note'; legend.textContent = `× open-loop poles; ○ zero; ● selected closed-loop poles. ${marks.map(m => m.label).join('; ')}`; host.append(legend); }
  };
  host.redraw(680); return host;
}
