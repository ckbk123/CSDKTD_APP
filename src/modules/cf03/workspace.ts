import type { ModuleMount } from '../../core/module';
export const mount:ModuleMount=({container,signal})=>{
  if(signal.aborted)return;
  const host=document.createElement('div'),loading=document.createElement('p');
  loading.textContent='Loading error and effort exercise…';loading.setAttribute('role','status');host.append(loading);container.append(host);
  const child=new AbortController();let closed=false,release:(()=>void)|undefined;
  const dispose=()=>{
    if(closed)return;closed=true;signal.removeEventListener('abort',dispose);child.abort();
    const cleanup=release;release=undefined;try{cleanup?.();}finally{host.remove();}
  };
  const failed=()=>{child.abort();if(closed)return;loading.textContent='The exercise could not load. Reset the tool to retry.';loading.setAttribute('role','alert');host.replaceChildren(loading);};
  signal.addEventListener('abort',dispose,{once:true});
  void import('./view').then(view=>{
    if(closed)return;
    try{const cleanup=view.mount({container:host,signal:child.signal});
      if(typeof cleanup==='function'){if(closed||child.signal.aborted)cleanup();else release=cleanup;}
      if(!closed)loading.remove();
    }catch{failed();}
  }).catch(failed);
  return dispose;
};
