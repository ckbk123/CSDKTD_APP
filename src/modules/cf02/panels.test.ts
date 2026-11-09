import{afterEach,describe,expect,it,vi}from'vitest';
import type{ModuleMount}from'../../core/module';
vi.mock('./explore',()=>({mountExplore:vi.fn()}));vi.mock('./practice',()=>({mountPractice:vi.fn()}));
import{mountPanels}from'./panels';
let release:(()=>void)|undefined;afterEach(()=>{release?.();release=undefined;document.body.replaceChildren();});
describe('independent error exploration and retained Practice',()=>{
  it('retains both actual raw inputs across view-only mode switches',()=>{
    const container=document.createElement('div'),parent=new AbortController(),factory=vi.fn<ModuleMount>(({container:host})=>{const input=document.createElement('input');input.type='number';input.value='';Object.defineProperty(input,'validity',{value:{badInput:true}});host.append(input);});document.body.append(container);release=mountPanels({container,signal:parent.signal},factory,factory);const input=container.querySelector('input')!,writes=vi.spyOn(input,'value','set'),mode=container.querySelector('select')!;mode.value='practice';mode.dispatchEvent(new Event('change'));mode.value='explore';mode.dispatchEvent(new Event('change'));expect(factory).toHaveBeenCalledTimes(2);expect(container.querySelector('input')).toBe(input);expect(writes).not.toHaveBeenCalled();writes.mockRestore();
  });
  it('aborts all child scopes before releases and always removes the root despite a throwing release',()=>{
    const container=document.createElement('div'),parent=new AbortController(),scopes:AbortSignal[]=[],second=vi.fn();document.body.append(container);release=mountPanels({container,signal:parent.signal},({signal})=>{scopes.push(signal);return()=>{expect(scopes.every(s=>s.aborted)).toBe(true);throw Error('release failure');};},({signal})=>{scopes.push(signal);return second;});expect(()=>release?.()).toThrow('release failure');expect(second).toHaveBeenCalledOnce();expect(container.children).toHaveLength(0);
  });
  it('aborts a failed child before retry, retains its sibling and restores focused Retry to mode',()=>{
    const container=document.createElement('div'),parent=new AbortController(),probe=vi.fn(),other=vi.fn(),factory=vi.fn<ModuleMount>(({signal})=>{window.addEventListener('cf02-panel-probe',probe,{signal});if(factory.mock.calls.length===1)throw Error('partial');});document.body.append(container);release=mountPanels({container,signal:parent.signal},factory,other);window.dispatchEvent(new Event('cf02-panel-probe'));expect(probe).not.toHaveBeenCalled();const retry=container.querySelector('button')!;retry.focus();retry.click();expect(document.activeElement).toBe(container.querySelector('select'));expect(factory).toHaveBeenCalledTimes(2);expect(other).toHaveBeenCalledOnce();retry.click();expect(factory).toHaveBeenCalledTimes(2);
  });
});
