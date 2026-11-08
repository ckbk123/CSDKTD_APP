import {afterEach,describe,expect,it,vi} from 'vitest';
import type {ModuleMount} from '../../core/module';
import {mount} from './view';
const state=vi.hoisted(()=>({fail:true,probes:0,aborts:0,cleanup:0,signals:[] as AbortSignal[],during:undefined as (()=>void)|undefined}));
vi.mock('./explore',()=>({mount:(({container,signal})=>{const input=document.createElement('input');input.value='explored state';container.append(input);window.addEventListener('dp02-test-explore',()=>state.probes++,{signal});return()=>input.remove();}) satisfies ModuleMount}));
vi.mock('./practice',()=>({mount:(({container,signal})=>{
  state.signals.push(signal);const input=document.createElement('input');input.dataset.practice='';container.append(input);window.addEventListener('dp02-test-practice',()=>state.probes++,{signal});signal.addEventListener('abort',()=>state.aborts++,{once:true});state.during?.();if(state.fail)throw new Error('Synthetic partial mount');return()=>{state.cleanup++;input.remove();};
}) satisfies ModuleMount}));
const visits:(()=>void)[]=[];
afterEach(()=>{visits.splice(0).forEach(f=>f());document.body.replaceChildren();state.fail=true;state.probes=state.aborts=state.cleanup=0;state.signals=[];state.during=undefined;});
function visit(){const root=document.createElement('div'),controller=new AbortController();document.body.append(root);const cleanup=mount({container:root,signal:controller.signal})||(()=>{});visits.push(()=>{cleanup();controller.abort();});const button=(name:string)=>[...root.querySelectorAll('button')].find(n=>n.textContent===name)!;return{root,controller,cleanup,button};}
describe('DP02 mode resource ownership',()=>{
  it('aborts a failed lazy attempt, retains Explore, then retries with visible focus and one resource',()=>{
    const v=visit();v.button('Practice').click();expect(v.controller.signal.aborted).toBe(false);expect(state.signals[0].aborted).toBe(true);expect(v.root.querySelector('[data-practice]')).toBeNull();expect(v.root.querySelector<HTMLElement>('[data-learning-mode="explore"]')!.hidden).toBe(false);
    window.dispatchEvent(new Event('dp02-test-practice'));expect(state.probes).toBe(0);state.fail=false;v.button('Retry Practice').focus();v.button('Retry Practice').click();expect(document.activeElement).toBe(v.button('Practice'));expect(v.root.querySelectorAll('[data-practice]')).toHaveLength(1);window.dispatchEvent(new Event('dp02-test-practice'));expect(state.probes).toBe(1);
    v.cleanup();expect(v.controller.signal.aborted).toBe(false);expect(state.aborts).toBe(2);expect(state.cleanup).toBe(1);window.dispatchEvent(new Event('dp02-test-explore'));window.dispatchEvent(new Event('dp02-test-practice'));expect(state.probes).toBe(1);
  });
  it('releases the late disposer if parent aborts synchronously inside the lazy mount',()=>{
    const v=visit();state.fail=false;state.during=()=>v.controller.abort();v.button('Practice').click();expect(state.signals[0].aborted).toBe(true);expect(state.cleanup).toBe(1);expect(v.root.childElementCount).toBe(0);window.dispatchEvent(new Event('dp02-test-practice'));expect(state.probes).toBe(0);
  });
});
