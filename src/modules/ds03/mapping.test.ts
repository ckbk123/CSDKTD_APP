import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkedPoint, circlePoint, createMapping, pointerPoint } from './mapping';
import { mapToW } from './math';

const visits: { life: AbortController; destroy: () => void; root: HTMLElement }[] = [];
afterEach(() => { for (const v of visits.splice(0)) { v.destroy(); v.life.abort(); v.root.remove(); } vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function open() {
  const root = document.createElement('div'), life = new AbortController(); document.body.append(root); const map = createMapping(root, life.signal); visits.push({life,destroy:map.destroy,root}); return {root,life,...map};
}
const field = (root: HTMLElement, name: string) => root.querySelector<HTMLInputElement>(`[aria-label="${name}"]`)!;
const text = (root: HTMLElement) => root.querySelector('.ds-map-readout')!.textContent!;
function edit(input: HTMLInputElement, value: string) { input.value = value; input.dispatchEvent(new Event('input', {bubbles:true})); }
function click(root: HTMLElement, name: string) { [...root.querySelectorAll('button')].find(b=>b.textContent===name)!.click(); }
function key(root: HTMLElement, name: string, shiftKey=false) { const h=root.querySelector<SVGElement>('[data-selected-point]')!; h.focus(); h.dispatchEvent(new KeyboardEvent('keydown',{key:name,shiftKey,bubbles:true})); }
function pointer(target: EventTarget, type: string, id: number, x=180,y=180) { const e=new MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0}); Object.defineProperty(e,'pointerId',{value:id}); target.dispatchEvent(e); }
describe('disk/half-plane point controls',()=>{
  it('uses exact cardinal circle points, including the exceptional point, without changing near-pole mathematics',()=>{
    expect(circlePoint(180)).toEqual({re:-1,im:0}); expect(mapToW(circlePoint(180))).toBeNull();
    expect(mapToW(circlePoint(0))).toEqual({re:0,im:0}); expect(mapToW(circlePoint(90))).toEqual({re:0,im:1});
    const z=circlePoint(180-1e-12),w=mapToW(z)!; expect(w.im).toBeGreaterThan(1e13); expect(Number.isFinite(w.im)).toBe(true);
    expect(()=>checkedPoint(-1,1e-9)).toThrow('too close'); expect(checkedPoint(-1,1e-8)).toEqual({re:-1,im:1e-8});
  });
  it('maps letterboxed pointer coordinates onto an independent 0.5+0.5j fixture and integer circle angles',()=>{
    const g={width:300,height:300,cx:150,cy:150,scale:100};
    // 600×300 view leaves 150px side padding. (350,100) in viewport maps to (200,100).
    const p=pointerPoint(350,100,{x:0,y:0,width:600,height:300},g,false); expect(p).toEqual({re:.5,im:.5});
    expect(mapToW(p)!.re).toBeCloseTo(-.2,14); expect(mapToW(p)!.im).toBeCloseTo(.4,14);
    expect(pointerPoint(250,150,{x:0,y:0,width:600,height:300},g,true)).toEqual({re:-1,im:0});
  });
  it('keeps equal fixed planes while point/roots change, with explicit Fit and all-root visibility notices',()=>{
    const v=open(), before=v.root.querySelector('svg')!.innerHTML;
    edit(field(v.root,'Selected Re z (−5 to 5)'),'.5'); edit(field(v.root,'Selected Im z (−5 to 5)'),'.5');
    expect(text(v.root)).toContain('w = -0.2 + 0.4j'); expect(text(v.root)).toContain('inside the disk');
    v.setRoots([{re:4,im:0}], [{re:3,im:0}]); expect(v.root.textContent).toContain('outside this view');
    expect(v.root.querySelector('svg')!.querySelector('.ds-region')?.getAttribute('r')).toBe('65');
    click(v.root,'Fit point views'); expect(v.root.querySelector('svg')!.querySelector('.ds-region')?.getAttribute('r')).toBe(String(260/9.6));
    expect(before).toContain('Equal real/imaginary scale');
  });
  it('qualifies a numerically unresolved radius near the mapping pole rather than calling it a boundary point',()=>{
    const v=open(); edit(field(v.root,'Selected Re z (−5 to 5)'),'-1'); edit(field(v.root,'Selected Im z (−5 to 5)'),'1e-8');
    expect(text(v.root)).toContain('w = 1 + 200000000j.'); expect(text(v.root)).toContain('near the unit circle (radius tolerance 10⁻¹²)'); expect(text(v.root)).not.toContain('on the unit circle');
  });
  it('offers keyboard circle/free movement, retained focus, exceptional End and reversible edits',()=>{
    const v=open(); key(v.root,'End'); expect(text(v.root)).toContain('w is at infinity');
    expect(document.activeElement?.hasAttribute('data-selected-point')).toBe(true);
    key(v.root,'Home'); expect(text(v.root)).toContain('w = 0.'); click(v.root,'Undo point edit'); expect(text(v.root)).toContain('w is at infinity');
    edit(field(v.root,'Selected Re z (−5 to 5)'),'.5'); edit(field(v.root,'Selected Im z (−5 to 5)'),'.5');
    expect(v.root.querySelector<HTMLInputElement>('[type="checkbox"]')!.checked).toBe(false);
    key(v.root,'ArrowRight'); key(v.root,'ArrowUp',true); expect(field(v.root,'Selected Re z (−5 to 5)').value).toBe('.51'.replace(/^\./,'0.'));
    expect(field(v.root,'Selected Im z (−5 to 5)').value).toBe('0.6');
    expect(document.activeElement?.hasAttribute('data-selected-point')).toBe(true);
  });
  it.each(['1e-999',''])('preserves rejected native point text %s through Fit and checked-root changes with no value writes',raw=>{
    const v=open(),input=field(v.root,'Selected Im z (−5 to 5)'); edit(input,raw);
    const value=vi.spyOn(input,'value','set'); click(v.root,'Fit point views'); v.setRoots([{re:.5,im:0}],[{re:-1/3,im:0}]);
    expect(value).not.toHaveBeenCalled(); expect(input.value).toBe(raw); expect(text(v.root)).toContain('Last checked point'); expect(text(v.root)).toContain('w = 0 + 1j');
    edit(input,'0'); expect(text(v.root)).toContain('Selected z = 0;'); expect(v.root.querySelector('.ds-map-status')!.textContent).toBe('');
  });
  it('preserves native badInput and the original element through view and failed keyboard actions',()=>{
    const v=open(),input=field(v.root,'Selected Re z (−5 to 5)'); input.value=''; Object.defineProperty(input,'validity',{configurable:true,value:{badInput:true}}); input.dispatchEvent(new Event('input',{bubbles:true}));
    const set=vi.spyOn(input,'value','set'); click(v.root,'Fit point views'); key(v.root,'ArrowLeft');
    expect(set).not.toHaveBeenCalled(); expect(field(v.root,'Selected Re z (−5 to 5)')).toBe(input); expect(input.validity.badInput).toBe(true);
  });
  it('keeps one pointer owner and original snapshot while ignoring foreign cancellation, then Escape restores controls',()=>{
    const v=open(), pair=v.root.querySelector<HTMLElement>('.ds-planes')!, captured=vi.fn(),released=vi.fn();
    pair.setPointerCapture=captured; pair.hasPointerCapture=()=>true; pair.releasePointerCapture=released;
    const svg=v.root.querySelector('svg')!; vi.spyOn(svg,'getBoundingClientRect').mockReturnValue({x:0,y:0,width:360,height:360} as DOMRect);
    pointer(v.root.querySelector('[data-selected-point]')!,'pointerdown',7); pointer(v.root.querySelector('[data-selected-point]')!,'pointerdown',8);
    pointer(window,'pointercancel',8); pointer(pair,'lostpointercapture',8); pointer(window,'pointermove',7,245,173);
    expect(captured.mock.calls).toEqual([[7]]); expect(text(v.root)).not.toContain('Selected z = 0 + 1j;');
    const escape=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}); window.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true); expect(text(v.root)).toContain('Selected z = 0 + 1j;'); expect(field(v.root,'Selected Re z (−5 to 5)').value).toBe('0'); expect(field(v.root,'Selected Im z (−5 to 5)').value).toBe('1'); expect(released).toHaveBeenCalledWith(7);
  });
  it('aborts direct-disposal listeners and observer while the parent remains active',()=>{
    const disconnected=vi.fn(); vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){disconnected();}});
    const v=open(),input=field(v.root,'Selected Re z (−5 to 5)'),readout=v.root.querySelector('.ds-map-readout')!;
    v.destroy(); v.destroy(); expect(v.life.signal.aborted).toBe(false); edit(input,'.5'); expect(readout.textContent).toContain('Selected z = 0 + 1j;'); expect(disconnected).toHaveBeenCalledOnce(); expect(v.root.childElementCount).toBe(0);
  });
  it('uses the measured phone width for 12px labels and 44px point targets, and disconnects an observer allocated during abort',()=>{
    let resize: (()=>void) | undefined; const disconnect=vi.fn();
    vi.stubGlobal('ResizeObserver',class {constructor(callback:()=>void){resize=callback;} observe(){} disconnect(){disconnect();}});
    const v=open(); vi.spyOn(v.root.querySelector('figure')!,'getBoundingClientRect').mockReturnValue({width:329} as DOMRect); resize!();
    expect(v.root.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 307 307'); expect(v.root.querySelector('.ds-point-hit')?.getAttribute('r')).toBe('22');
    v.destroy(); expect(disconnect).toHaveBeenCalledOnce();
    const root=document.createElement('div'),life=new AbortController(),late=vi.fn();
    vi.stubGlobal('ResizeObserver',class {constructor(){life.abort();} observe(){} disconnect(){late();}});
    createMapping(root,life.signal); expect(late).toHaveBeenCalledOnce(); expect(root.childElementCount).toBe(0);
  });
});
