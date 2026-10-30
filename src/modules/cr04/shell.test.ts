import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app';

// Exercise the real shell, catalogue, lazy wrapper and CR04 view together.
// Browser MathLive behavior remains a separate integration gate.
vi.mock('../../shared/equations/example-panel', () => ({ mountExamplePanel: () => undefined }));
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string, label: string) => {
    const element = document.createElement('div');
    element.textContent = value; element.setAttribute('aria-label', label); return element;
  },
  createEquationInput: ({ label, value, signal, onChange }: {
    label: string; value: string; signal: AbortSignal; onChange: () => void;
  }) => {
    const element = document.createElement('input');
    element.value = value; element.setAttribute('aria-label', label);
    element.addEventListener('input', onChange, { signal });
    const destroy = () => element.remove();
    signal.addEventListener('abort', destroy, { once: true });
    return {
      element,
      getValue: () => ({ latex: element.value, empty: !element.value.trim(), hasPlaceholders: false, syntaxIssues: [] }),
      setValue: (next: string) => { element.value = next; },
      focus: () => element.focus(), destroy,
    };
  },
}));

describe('CR04 drag ownership with real shell navigation', () => {
  let root: HTMLDivElement;
  let dispose: (() => void) | undefined;
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    window.history.replaceState(null, '', '#/module/CR04');
    root = document.createElement('div'); document.body.append(root);
  });
  afterEach(() => {
    dispose?.(); dispose = undefined; root.remove();
    window.history.replaceState(null, '', '#/continuous');
    vi.restoreAllMocks();
  });
  const field = (label: string) => root.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  const button = (label: string) => [...root.querySelectorAll('button')].find(item => item.textContent === label)!;
  function pointer(type: string, values: Record<string, number | boolean>): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    for (const [key, value] of Object.entries(values)) Object.defineProperty(event, key, { value });
    return event;
  }
  async function start(): Promise<void> {
    dispose = createApp(root);
    await vi.waitFor(() => expect(root.querySelector('.cr04-canvas-scroll svg')).not.toBeNull());
  }
  function escape(): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    window.dispatchEvent(event); return event;
  }

  it('cancels only the active drag, retaining committed edits before allowing a later Escape to leave', async () => {
    await start();
    const x = field('Node x (layout units)'); x.value = '460';
    x.dispatchEvent(new Event('input', { bubbles: true })); button('Apply selected node edits').click();
    expect(root.textContent).toContain('Undo snapshots: 1/40');
    const svg = root.querySelector<SVGSVGElement>('.cr04-canvas-scroll svg')!;
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1680, height: 1020 } as DOMRect);
    const node = svg.querySelector<SVGGElement>('[data-node-id="g1"]')!;
    const release = vi.fn();
    Object.assign(node, { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: release });
    node.dispatchEvent(pointer('pointerdown', { button: 0, isPrimary: true, pointerId: 7, clientX: 550, clientY: 280 }));
    window.dispatchEvent(pointer('pointermove', { pointerId: 7, clientX: 650, clientY: 330 }));
    expect(field('Node x (layout units)').value).toBe('560');
    expect(escape().defaultPrevented).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(location.hash).toBe('#/module/CR04');
    expect(field('Node x (layout units)').value).toBe('460');
    expect(root.textContent).toContain('Undo snapshots: 1/40');
    expect(root.querySelector('.cr04-feedback')?.textContent).toContain('Drag cancelled');
    expect(release).toHaveBeenCalledExactlyOnceWith(7);
    window.dispatchEvent(pointer('pointerup', { pointerId: 7 }));
    expect(release).toHaveBeenCalledTimes(1);

    escape();
    await vi.waitFor(() => expect(root.querySelector('.cr04-canvas-scroll')).toBeNull());
    expect(location.hash).toBe('#/continuous/representation');
  });

  it('preserves ordinary shell Escape navigation when no drag has started', async () => {
    await start(); escape();
    await vi.waitFor(() => expect(root.querySelector('.cr04-canvas-scroll')).toBeNull());
    expect(location.hash).toBe('#/continuous/representation');
  });
});
