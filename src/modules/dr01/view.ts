import type {ModuleMount}from'../../core/module';
import {mountExplore}from'./explore';
import {mountPractice}from'./practice';
import './workspace.css';

type Slot={host:HTMLDivElement;name:string;factory:ModuleMount;life?:AbortController;recovery?:AbortController;release?:()=>void};
export const mountView:ModuleMount=context=>mountPanels(context,mountExplore,mountPractice);

/** Both panels retain their own drafts; a failed partial allocation owns only its own child signal. */
export const mountPanels=(context:Parameters<ModuleMount>[0],explore:ModuleMount,practice:ModuleMount)=>{
  const {container,signal:parent}=context;if(parent.aborted)return;
  const root=document.createElement('div');root.dataset.module='DR01';root.className='dr01-panels';container.append(root);
  const label=document.createElement('label'),mode=document.createElement('select');label.textContent='Learning mode';mode.setAttribute('aria-label','Learning mode');
  for(const[value,text]of[['explore','Explore sequences'],['practice','Practice inversion']]){const o=document.createElement('option');o.value=value;o.textContent=text;mode.append(o);}label.append(mode);root.append(label);
  const lifetime=new AbortController(),slots:Slot[]=[],signal=lifetime.signal;let disposed=false;
  const dispose=()=>{
    if(disposed)return;disposed=true;parent.removeEventListener('abort',dispose);lifetime.abort();
    for(const slot of slots){slot.life?.abort();slot.recovery?.abort();}
    let failure:unknown;for(const slot of slots){const release=slot.release;slot.release=undefined;try{release?.();}catch(error){failure??=error;}}
    root.remove();if(failure)throw failure;
  };
  parent.addEventListener('abort',dispose,{once:true});
  function start(slot:Slot){
    if(disposed)return;slot.recovery?.abort();slot.recovery=undefined;slot.life?.abort();slot.host.replaceChildren();
    const life=new AbortController();slot.life=life;
    try{
      const release=slot.factory({container:slot.host,signal:life.signal})||undefined;
      if(disposed||life.signal.aborted){release?.();return;}slot.release=release;
    }catch{
      life.abort();if(disposed)return;slot.host.replaceChildren();
      const message=document.createElement('p'),retry=document.createElement('button');message.setAttribute('role','alert');message.textContent=`${slot.name} could not load. Retry this view.`;retry.type='button';retry.textContent=`Retry ${slot.name}`;
      slot.host.append(message,retry);const recovery=new AbortController();slot.recovery=recovery;
      retry.addEventListener('click',()=>{const focused=slot.host.contains(document.activeElement);start(slot);if(!disposed&&focused)mode.focus({preventScroll:true});},{signal:recovery.signal});
    }
  }
  try{
    for(const[name,factory]of[['Explore sequences',explore],['Practice inversion',practice]]as const){const host=document.createElement('div');root.append(host);const slot={host,name,factory};slots.push(slot);start(slot);if(disposed)return dispose;}
    const change=()=>{
      const selected=mode.value==='practice'?1:0;for(const[at,slot]of slots.entries()){if(at!==selected){slot.host.dispatchEvent(new Event('dr01-suspend'));if(slot.host.contains(document.activeElement))mode.focus({preventScroll:true});}slot.host.hidden=at!==selected;slot.host.inert=at!==selected;}
      window.mathVirtualKeyboard?.hide();
    };
    mode.addEventListener('change',change,{signal});change();return dispose;
  }catch(error){dispose();throw error;}
};
