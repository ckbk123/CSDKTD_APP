import type { ModuleMount } from '../../core/module';
import { mount as mountExplore } from './explore';
import { mount as mountPractice } from './practice';

/** Modes keep independent visit-local attempts; a failed lazy mode owns its abort scope. */
export const mount: ModuleMount = ({container, signal}) => {
  const root=document.createElement('div'); root.className='dp-modes';
  const tabs=document.createElement('div'); tabs.className='dp-presets'; tabs.setAttribute('role','group'); tabs.setAttribute('aria-label','Pole mapping learning mode');
  const explore=document.createElement('button'), practice=document.createElement('button');
  explore.type=practice.type='button'; explore.textContent='Explore'; practice.textContent='Practice'; tabs.append(explore,practice);
  const panels=[document.createElement('div'),document.createElement('div')]; panels[0].dataset.learningMode='explore'; panels[1].dataset.learningMode='practice'; panels[1].hidden=true;
  const notice=document.createElement('p'), retry=document.createElement('button'); notice.setAttribute('role','status'); notice.hidden=true; retry.type='button'; retry.textContent='Retry Practice'; retry.hidden=true;
  root.append(tabs,notice,retry,...panels); container.append(root);
  const lifetime=new AbortController(), scopes: AbortController[]=[]; const releases: (()=>void)[]=[];
  let disposed=false, practiceReady=false;
  const cleanup=()=>{if(disposed)return;disposed=true;signal.removeEventListener('abort',cleanup);lifetime.abort();scopes.forEach(s=>s.abort());releases.forEach(f=>f());root.remove();};
  signal.addEventListener('abort',cleanup,{once:true}); lifetime.signal.addEventListener('abort',cleanup,{once:true});
  const start=(index:number, fn:ModuleMount)=>{
    const scope=new AbortController(), host=document.createElement('div'), forward=()=>scope.abort();
    lifetime.signal.addEventListener('abort',forward,{once:true}); panels[index].replaceChildren(host);
    try {
      if(disposed||signal.aborted)throw new Error('Visit ended');
      const release=fn({container:host,signal:scope.signal});
      if(disposed||scope.signal.aborted){release?.();scope.abort();host.remove();return false;}
      scopes.push(scope); releases.push(()=>{lifetime.signal.removeEventListener('abort',forward);release?.();}); return true;
    } catch(error){scope.abort();lifetime.signal.removeEventListener('abort',forward);host.remove();if(index===0)throw error;return false;}
  };
  const show=(first:boolean)=>{
    if(disposed)return; const retryFocused=document.activeElement===retry;
    window.mathVirtualKeyboard?.hide({animate:false});
    if(!first){panels[0].dispatchEvent(new Event('dp02-suspend'));if(!practiceReady){practiceReady=start(1,mountPractice);if(!practiceReady){if(!disposed){notice.textContent='Practice could not open. Retry or continue exploring.';notice.hidden=retry.hidden=false;}return;}}}
    notice.hidden=retry.hidden=true;panels[0].hidden=!first;panels[1].hidden=first;explore.setAttribute('aria-pressed',String(first));practice.setAttribute('aria-pressed',String(!first));
    if(retryFocused)(first?explore:practice).focus({preventScroll:true});
  };
  try {
    if(signal.aborted){cleanup();return cleanup;}
    if(!start(0,mountExplore))return cleanup;
    explore.addEventListener('click',()=>show(true),{signal:lifetime.signal});practice.addEventListener('click',()=>show(false),{signal:lifetime.signal});retry.addEventListener('click',()=>show(false),{signal:lifetime.signal});show(true);return cleanup;
  }catch(error){cleanup();throw error;}
};
