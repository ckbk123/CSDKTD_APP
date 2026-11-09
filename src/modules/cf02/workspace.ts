import type{ModuleMount}from'../../core/module';
/** Browser-only views load behind a synchronously owned host. */
export function mountWithLoader({container,signal}:Parameters<ModuleMount>[0],load:()=>Promise<{mount:ModuleMount}>):()=>void{
  const host=document.createElement('div'),lifetime=new AbortController(),message=document.createElement('p');message.setAttribute('role','status');message.textContent='Loading tracking-error exploration…';host.append(message);container.append(host);
  let disposed=false,release:(()=>void)|undefined;
  const cleanup=()=>{if(disposed)return;disposed=true;signal.removeEventListener('abort',cleanup);lifetime.abort();const previous=release;release=undefined;try{previous?.();}finally{host.remove();}};
  signal.addEventListener('abort',cleanup,{once:true});if(signal.aborted){cleanup();return cleanup;}
  void load().then(view=>{if(disposed||lifetime.signal.aborted)return;message.remove();const previous=view.mount({container:host,signal:lifetime.signal})||undefined;if(disposed||lifetime.signal.aborted)previous?.();else release=previous;}).catch(()=>{if(disposed||signal.aborted)return;lifetime.abort();host.replaceChildren(message);message.setAttribute('role','alert');message.textContent='Tracking-error views could not load. Reset the workspace to retry.';});
  return cleanup;
}
export const mount:ModuleMount=context=>mountWithLoader(context,()=>import('./panels'));
