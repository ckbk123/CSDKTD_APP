import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({container,signal})=>{
  if(signal.aborted)return;
  const host=document.createElement('div'),pending=document.createElement('p');pending.textContent='Loading frequency specifications…';pending.setAttribute('role','status');host.append(pending);container.append(host);
  const child=new AbortController();let disposed=false,release:(()=>void)|undefined;
  const cleanup=()=>{if(disposed)return;disposed=true;signal.removeEventListener('abort',cleanup);child.abort();const dispose=release;release=undefined;try{dispose?.();}finally{host.remove();}};
  const failed=()=>{child.abort();if(!disposed&&!signal.aborted){pending.textContent='Frequency specifications could not load. Reset the tool to try again.';pending.setAttribute('role','alert');host.replaceChildren(pending);}};
  signal.addEventListener('abort',cleanup,{once:true});
  void import('./view').then(view=>{if(disposed||signal.aborted)return;try{const dispose=view.mount({container:host,signal:child.signal});if(typeof dispose==='function'){if(disposed||child.signal.aborted)dispose();else release=dispose;}if(!disposed)pending.remove();}catch{failed();}}).catch(failed);
  return cleanup;
};
