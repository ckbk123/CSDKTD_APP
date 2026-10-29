import type { ModuleMount } from '../../core/module';
export const mount:ModuleMount=({container,signal})=>{
  let closed=signal.aborted,dispose:(()=>void)|undefined;
  const loading=document.createElement('p');loading.textContent='Loading error and effort exercise…';if(!closed)container.append(loading);
  void import('./view').then(view=>{if(closed||signal.aborted)return;loading.remove();dispose=view.mount({container,signal})||undefined;}).catch(()=>{if(!closed&&!signal.aborted){loading.textContent='The exercise could not load. Reset the tool to retry.';container.append(loading);}});
  return()=>{closed=true;dispose?.();dispose=undefined;loading.remove();};
};
