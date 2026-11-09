import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModuleContext } from '../../core/module';
import { mount } from './workspace';
const state = vi.hoisted(() => ({ fail: false, calls: 0, releases: 0, probes: 0, child: undefined as AbortSignal | undefined, during: undefined as (() => void) | undefined }));
vi.mock('../../shared/equations/input', () => ({}));
vi.mock('./view', () => ({ mountView: ({ container, signal }: ModuleContext) => { state.calls++; state.child = signal; container.append(document.createElement('input')); window.addEventListener('ds01-loader-resource', () => state.probes++, { signal }); state.during?.(); if (state.fail) throw new Error('Partial view failed'); return () => { state.releases++; container.replaceChildren(); }; } }));
const visits: (() => void)[] = [];
function open() { const root = document.createElement('div'), parent = new AbortController(), cleanup = mount({ container: root, signal: parent.signal }); visits.push(() => { if (typeof cleanup === 'function') cleanup(); parent.abort(); }); return { root, parent, cleanup }; }
afterEach(() => { visits.splice(0).forEach(dispose => dispose()); state.fail = false; state.calls = state.releases = state.probes = 0; state.child = undefined; state.during = undefined; });
describe('DS01 unchanged lazy entry contract with late-disposer protection', () => {
  it('aborts resources from a failed child while its parent remains active and shows recovery', async () => { state.fail = true; const visit = open(); expect(visit.root.textContent).toContain('Loading'); await vi.waitFor(() => expect(state.calls).toBe(1)); expect(visit.parent.signal.aborted).toBe(false); expect(state.child?.aborted).toBe(true); expect(visit.root.textContent).toContain('could not load'); expect(visit.root.querySelector('input')).toBeNull(); window.dispatchEvent(new Event('ds01-loader-resource')); expect(state.probes).toBe(0); });
  it('immediately calls a returned disposer after reentrant parent abort', async () => { const visit = open(); state.during = () => visit.parent.abort(); await vi.waitFor(() => expect(state.calls).toBe(1)); expect(state.child?.aborted).toBe(true); expect(state.releases).toBe(1); expect(visit.root.childElementCount).toBe(0); if (typeof visit.cleanup === 'function') visit.cleanup(); expect(state.releases).toBe(1); });
  it('does not mount a late child after direct disposal with parent active', async () => { const visit = open(); if (typeof visit.cleanup === 'function') visit.cleanup(); await Promise.resolve(); await Promise.resolve(); expect(visit.parent.signal.aborted).toBe(false); expect(state.calls).toBe(0); expect(visit.root.childElementCount).toBe(0); });
});
