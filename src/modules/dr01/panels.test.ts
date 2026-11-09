import{afterEach,describe,expect,it,vi}from'vitest';
import type{ModuleMount}from'../../core/module';
vi.mock('./explore',()=>({mountExplore:vi.fn()}));vi.mock('./practice',()=>({mountPractice:vi.fn()}));
import{mountPanels}from'./view';
let release:(()=>void)|undefined;afterEach(()=>{release?.();release=undefined;document.body.replaceChildren();});
function visit(explore:ModuleMount,practice:ModuleMount){const container=document.createElement('div'),parent=new AbortController();document.body.append(container);release=mountPanels({container,signal:parent.signal},explore,practice);return{container,parent,mode:container.querySelector('select')!};}
describe('independent retained Explore and Practice lifetimes',()=>{
  it('keeps same raw controls and dispatches suspension without remounting either panel',()=>{
    const suspend=vi.fn(),build=vi.fn<ModuleMount>(({container,signal})=>{const input=document.createElement('input');input.type='number';input.value='';Object.defineProperty(input,'validity',{value:{badInput:true}});container.append(input);container.addEventListener('dr01-suspend',suspend,{signal});});
    const state=visit(build,build),input=state.container.querySelector('input')!,writes=vi.spyOn(input,'value','set');state.mode.value='practice';state.mode.dispatchEvent(new Event('change'));state.mode.value='explore';state.mode.dispatchEvent(new Event('change'));
    expect(build).toHaveBeenCalledTimes(2);expect(state.container.querySelector('input')).toBe(input);expect(writes).not.toHaveBeenCalled();expect(suspend.mock.calls.length).toBeGreaterThanOrEqual(2);writes.mockRestore();
  });
  it('aborts a partial view before recovery, retains its sibling and returns focused Retry to the mode control',()=>{
    const probe=vi.fn(),goodRelease=vi.fn(),good=vi.fn<ModuleMount>(()=>goodRelease),badRelease=vi.fn();let child:AbortSignal|undefined;
    const bad=vi.fn<ModuleMount>(({container,signal})=>{child=signal;window.addEventListener('dr01-panel-probe',probe,{signal});if(bad.mock.calls.length===1){container.append(document.createElement('input'));throw Error('partial');}return badRelease;});
    const state=visit(bad,good);expect(child?.aborted).toBe(true);window.dispatchEvent(new Event('dr01-panel-probe'));expect(probe).not.toHaveBeenCalled();
    const retry=state.container.querySelector('button')!;retry.focus();retry.click();expect(bad).toHaveBeenCalledTimes(2);expect(good).toHaveBeenCalledTimes(1);expect(document.activeElement).toBe(state.mode);retry.click();expect(bad).toHaveBeenCalledTimes(2);
    release?.();expect(goodRelease).toHaveBeenCalledOnce();expect(badRelease).toHaveBeenCalledOnce();expect(state.parent.signal.aborted).toBe(false);
  });
  it('aborts all scopes and releases both once despite a throwing first disposer',()=>{
    const scopes:AbortSignal[]=[],second=vi.fn(),first=vi.fn(()=>{expect(scopes.every(s=>s.aborted)).toBe(true);throw Error('release failure');});
    const state=visit(({signal})=>{scopes.push(signal);return first;},({signal})=>{scopes.push(signal);return second;});expect(()=>release?.()).toThrow('release failure');expect(second).toHaveBeenCalledOnce();expect(state.container.children).toHaveLength(0);release?.();expect(first).toHaveBeenCalledOnce();
  });
  it('releases a late disposer after reentrant parent abort without mounting the other panel',()=>{
    const container=document.createElement('div'),parent=new AbortController(),late=vi.fn(),other=vi.fn();document.body.append(container);
    release=mountPanels({container,signal:parent.signal},()=>{parent.abort();return late;},other);expect(late).toHaveBeenCalledOnce();expect(other).not.toHaveBeenCalled();expect(container.children).toHaveLength(0);
  });
});
