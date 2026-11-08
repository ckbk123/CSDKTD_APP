import { readNumericInput } from '../../shared/numeric-input';
import { mapToW, type Complex } from './math';

const ns = 'http://www.w3.org/2000/svg';
const fmt = (n: number) => Math.abs(n) < 1e-13 ? '0' : n.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 7 });
const complex = (p: Complex) => `${fmt(p.re)}${p.im ? ` ${p.im < 0 ? '−' : '+'} ${fmt(Math.abs(p.im))}j` : ''}`;
const copy = (p: Complex): Complex => ({ ...p });
export function circlePoint(degrees: number): Complex {
  const a = ((degrees % 360) + 360) % 360;
  if (a % 90 === 0) return [{ re: 1, im: 0 }, { re: 0, im: 1 }, { re: -1, im: 0 }, { re: 0, im: -1 }][a / 90];
  return { re: Math.cos(a * Math.PI / 180), im: Math.sin(a * Math.PI / 180) };
}
export function checkedPoint(re: number, im: number): Complex {
  if (![re, im].every(v => Number.isFinite(v) && Math.abs(v) <= 5)) throw new Error('Choose finite real and imaginary parts between −5 and 5.');
  const distance = Math.hypot(re + 1, im);
  if (distance !== 0 && distance < 1e-8) throw new Error('This point is too close to the mapping pole. Choose z = −1 exactly, or a point at least 10⁻⁸ away.');
  return { re, im };
}
export interface Geometry { width: number; height: number; cx: number; cy: number; scale: number }
/** Account for SVG letterboxing before interpreting a pointer as coordinates. */
export function pointerPoint(clientX: number, clientY: number, rect: Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>, g: Geometry, circle: boolean): Complex {
  const scale = Math.min(rect.width / g.width, rect.height / g.height);
  if (!(scale > 0)) throw new Error('The point view is not ready.');
  const x = (clientX - rect.x - (rect.width - g.width * scale) / 2) / scale;
  const y = (clientY - rect.y - (rect.height - g.height * scale) / 2) / scale;
  const re = (x - g.cx) / g.scale, im = (g.cy - y) / g.scale;
  if (circle) return circlePoint(Math.round(Math.atan2(im, re) * 180 / Math.PI));
  return checkedPoint(Math.round(Math.max(-5, Math.min(5, re)) * 100) / 100, Math.round(Math.max(-5, Math.min(5, im)) * 100) / 100);
}
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e;
}

export function createMapping(container: HTMLElement, parent: AbortSignal) {
  const life = new AbortController(), signal = life.signal;
  const root = el('section', undefined, 'ds-mapping'); container.prepend(root);
  let point: Complex = { re: 0, im: 1 }, previous: Complex | undefined, roots: readonly Complex[] = [], mapped: readonly (Complex | null)[] = [];
  let extents = [2, 2], width = 360, geometry: Geometry | undefined, disposed = false, invalid = false;
  let gesture: { pointer: number; base: Complex } | undefined;
  let observer: ResizeObserver | undefined;
  const readout = el('p', undefined, 'ds-map-readout'); readout.setAttribute('aria-live', 'polite');
  const status = el('p', '', 'ds-map-status'); status.setAttribute('role', 'status');
  const pair = el('div', undefined, 'ds-planes'); pair.tabIndex = -1;
  const actions = el('div', undefined, 'ds-actions ds-map-actions');
  function button(name: string, action: () => void) {
    const b = el('button', name); b.type = 'button'; b.addEventListener('click', action, { signal }); actions.append(b); return b;
  }
  const undo = button('Undo point edit', () => {
    if (!previous) return; cancel(); const next = previous; previous = copy(point); accept(next, false); handle()?.focus({ preventScroll: true });
  });
  button('Fit point views', () => {
    cancel(); extents = [fit([...roots, point]), fit([...mapped, mapToW(point)])]; render();
  });
  root.append(el('h3', 'Move a point in the z plane'), readout, status, actions, pair);
  const controls = el('div', undefined, 'ds-controls ds-map-controls');
  function number(label: string, value: string, min: number, max: number, step: string) {
    const wrap = el('label', label), field = el('input'); field.type = 'number'; field.value = value; field.min = String(min); field.max = String(max); field.step = step; field.setAttribute('aria-label', label); wrap.append(field); controls.append(wrap); return field;
  }
  const angle = number('Unit-circle angle θ (degrees)', '90', 0, 360, '1');
  const slider = el('input'); slider.type = 'range'; slider.min = '0'; slider.max = '360'; slider.step = '1'; slider.value = '90'; slider.setAttribute('aria-label', 'Unit-circle angle slider in degrees'); angle.parentElement!.append(slider);
  const re = number('Selected Re z (−5 to 5)', '0', -5, 5, '.01'), im = number('Selected Im z (−5 to 5)', '1', -5, 5, '.01');
  const lockLabel = el('label', undefined, 'ds-map-lock'), lock = el('input'); lock.type = 'checkbox'; lock.checked = true; lockLabel.append(lock, el('span', 'Keep pointer and arrow moves on the unit circle'));
  lock.addEventListener('change', () => { cancel(); if (lock.checked) accept(circlePoint(Math.round(Math.atan2(point.im, point.re) * 180 / Math.PI))); }, { signal });
  root.append(lockLabel, controls, el('p', 'Drag the selected circle or use its arrow keys. Circle moves use 1° steps (Shift: 10°); free moves use 0.01 (Shift: 0.1). Home selects z=1; End selects z=−1. Escape cancels a drag. Numeric coordinates also select interior/exterior points. Dimensions are unitless; w=(z−1)/(z+1), with no 2/T factor.', 'ds-small'));

  function fit(points: readonly (Complex | null)[]) { return Math.min(10, Math.max(1.5, ...points.filter((p): p is Complex => !!p).map(p => 1.2 * Math.max(Math.abs(p.re), Math.abs(p.im))))); }
  function handle() { return pair.querySelector<SVGElement>('[data-selected-point]'); }
  function sync() {
    re.value = String(point.re); im.value = String(point.im);
    const degrees = ((Math.atan2(point.im, point.re) * 180 / Math.PI) + 360) % 360;
    angle.value = String(degrees); slider.value = String(degrees);
  }
  function accept(next: Complex, remember = true) {
    if (![next.re, next.im].every(v => Number.isFinite(v) && Math.abs(v) <= 5)) throw new Error('Choose finite coordinates between −5 and 5.');
    if (remember) previous = copy(point); point = copy(next); invalid = false; status.textContent = ''; sync(); render();
  }
  function fail(error: unknown) { invalid = true; cancel(); status.textContent = error instanceof Error ? error.message : 'Check the selected point.'; render(); }
  function updateAngle(field: HTMLInputElement) {
    try { const v = readNumericInput(field, 'Unit-circle angle θ (degrees)'); if (v < 0 || v > 360) throw new Error('Choose an angle from 0° to 360°.'); cancel(); lock.checked = true; accept(circlePoint(v)); }
    catch (error) { fail(error); }
  }
  angle.addEventListener('input', () => updateAngle(angle), { signal }); slider.addEventListener('input', () => updateAngle(slider), { signal });
  const updatePoint = () => {
    try { const next = checkedPoint(readNumericInput(re, 'Selected Re z'), readNumericInput(im, 'Selected Im z')); cancel(); lock.checked = false; accept(next); }
    catch (error) { fail(error); }
  };
  re.addEventListener('input', updatePoint, { signal }); im.addEventListener('input', updatePoint, { signal });

  function plane(title: string, isW: boolean, values: readonly (Complex | null)[], selected: Complex | null, extent: number) {
    const figure = el('figure'), svg = document.createElementNS(ns, 'svg'); figure.append(el('figcaption', title), svg);
    const height = width, g: Geometry = { width, height, cx: width / 2, cy: height / 2 - 7, scale: (width - 100) / (2 * extent) };
    if (!isW) geometry = g;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('role', isW ? 'img' : 'group'); svg.setAttribute('aria-label', title);
    function shape(tag: string, attrs: Record<string, string | number>, text?: string, host: SVGElement = svg) {
      const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); if (text !== undefined) e.textContent = text; host.append(e); return e;
    }
    const x = (v: number) => g.cx + v * g.scale, y = (v: number) => g.cy - v * g.scale;
    if (isW) shape('rect', { x: 26, y: 25, width: g.cx - 26, height: height - 65, class: 'ds-region' });
    else shape('circle', { cx: g.cx, cy: g.cy, r: g.scale, class: 'ds-region' });
    shape('line', { x1: 26, x2: width - 26, y1: g.cy, y2: g.cy, class: 'ds-axis' });
    shape('line', { x1: g.cx, x2: g.cx, y1: 25, y2: height - 40, class: 'ds-axis' });
    shape('text', { x: width - 65, y: g.cy - 10 }, isW ? 'Re w' : 'Re z'); shape('text', { x: g.cx + 8, y: 21 }, isW ? 'Im w' : 'Im z');
    for (const t of [-extent, extent]) { shape('text', { x: x(t), y: g.cy + 18, 'text-anchor': 'middle' }, fmt(t)); }
    shape('text', { x: 28, y: height - 15 }, 'Equal real/imaginary scale');
    let hidden = 0;
    const visible = (p: Complex | null): p is Complex => !!p && Math.abs(p.re) <= extent && Math.abs(p.im) <= extent;
    values.forEach(p => { if (!visible(p)) { hidden++; return; } shape('path', { d: `M${x(p.re)-5},${y(p.im)-5}l10,10m0,-10l-10,10`, class: 'ds-root' }); });
    if (visible(selected)) {
      if (!isW) {
        const h = shape('g', { role: 'button', tabindex: 0, 'data-selected-point': '', 'aria-label': 'Selected z point — drag or use arrow keys' });
        shape('circle', { cx: x(selected.re), cy: y(selected.im), r: 22, class: 'ds-point-hit' }, undefined, h);
        shape('circle', { cx: x(selected.re), cy: y(selected.im), r: 6, class: 'ds-selected' }, undefined, h);
      } else shape('circle', { cx: x(selected.re), cy: y(selected.im), r: 6, class: 'ds-selected' });
    } else if (selected) hidden++;
    figure.append(el('p', `${isW ? 'Tint: Re w < 0.' : 'Tint: |z| < 1.'} ○ selected point; × checked roots.${hidden ? ` ${hidden} point(s) at infinity or outside this view; see numeric values.` : ''}`, 'ds-small'));
    return figure;
  }
  function render() {
    if (disposed || signal.aborted) return;
    const focused = pair.contains(document.activeElement), w = mapToW(point), radius = Math.hypot(point.re, point.im);
    const region = radius < 1 - 1e-12 ? 'inside the disk' : radius > 1 + 1e-12 ? 'outside the disk' : 'on the unit circle (within rounding)';
    readout.textContent = `${invalid ? 'Last checked point · ' : ''}Selected z = ${complex(point)}; |z| = ${fmt(radius)} · ${region}. ${w ? `w = ${complex(w)}.` : 'w is at infinity: z = −1 is the mapping pole.'}`;
    pair.replaceChildren(plane('z plane · unit disk', false, roots, point, extents[0]), plane('w plane · left half-plane', true, mapped, w, extents[1]));
    undo.disabled = !previous;
    if (focused) handle()?.focus({ preventScroll: true });
  }
  function release() { const id = gesture?.pointer; gesture = undefined; if (id !== undefined && pair.hasPointerCapture?.(id)) pair.releasePointerCapture(id); }
  function cancel() {
    if (!gesture) return;
    point = gesture.base; release(); if (!invalid) sync(); render();
  }
  pair.addEventListener('pointerdown', e => {
    if (gesture || e.button !== 0 || !(e.target as Element).closest('[data-selected-point]')) return;
    if (invalid) { status.textContent = 'Correct the invalid point draft, or select a valid angle, before dragging.'; return; }
    gesture = { pointer: e.pointerId, base: copy(point) }; e.preventDefault(); pair.setPointerCapture?.(e.pointerId); handle()?.focus({ preventScroll: true });
  }, { signal });
  window.addEventListener('pointermove', e => {
    if (gesture?.pointer !== e.pointerId || !geometry) return;
    const svg = pair.querySelector('svg'); if (!svg) return; e.preventDefault();
    try { point = pointerPoint(e.clientX, e.clientY, svg.getBoundingClientRect(), geometry, lock.checked); sync(); render(); }
    catch (error) { cancel(); fail(error); }
  }, { signal, passive: false });
  window.addEventListener('pointerup', e => { if (gesture?.pointer === e.pointerId) { previous = gesture.base; release(); sync(); render(); } }, { signal });
  window.addEventListener('pointercancel', e => { if (gesture?.pointer === e.pointerId) cancel(); }, { signal });
  pair.addEventListener('lostpointercapture', e => { if (gesture?.pointer === e.pointerId) cancel(); }, { signal });
  window.addEventListener('blur', cancel, { signal });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && gesture) { e.preventDefault(); e.stopImmediatePropagation(); cancel(); handle()?.focus({ preventScroll: true }); } }, { signal, capture: true });
  pair.addEventListener('keydown', e => {
    if (!(e.target as Element).closest('[data-selected-point]') || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) return;
    e.preventDefault(); if (invalid) { status.textContent = 'Correct the invalid point draft, or select a valid angle, before moving the point.'; return; }
    cancel();
    try {
      if (e.key === 'Home' || e.key === 'End') accept({ re: e.key === 'Home' ? 1 : -1, im: 0 });
      else if (lock.checked) accept(circlePoint(Math.atan2(point.im, point.re) * 180 / Math.PI + (e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)));
      else { const step = e.shiftKey ? .1 : .01; accept(checkedPoint(Math.round((point.re + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0)) * 100) / 100, Math.round((point.im + (e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0)) * 100) / 100)); }
      handle()?.focus({ preventScroll: true });
    } catch (error) { fail(error); }
  }, { signal });
  function resize() { if (disposed) return; const actual = pair.querySelector('figure')?.getBoundingClientRect().width; const next = actual ? Math.max(220, actual - 22) : 360; if (Math.abs(next - width) > 1) { cancel(); width = next; render(); } }
  function destroy() { if (disposed) return; disposed = true; parent.removeEventListener('abort', destroy); release(); observer?.disconnect(); life.abort(); root.remove(); }
  parent.addEventListener('abort', destroy, { once: true });
  render(); observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
  if (disposed || parent.aborted) { observer?.disconnect(); destroy(); } else { observer?.observe(pair); resize(); }
  return { element: root, setRoots(z: readonly Complex[], w: readonly (Complex | null)[]) { roots = z; mapped = w; render(); }, destroy };
}
