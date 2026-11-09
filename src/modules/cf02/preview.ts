/** One bounded latest-value preview per interval; continuous input does not postpone it indefinitely. */
export function createPreview<T>(signal:AbortSignal,calculate:(value:T)=>void,onError:(error:unknown)=>void,delay=40){
  let timer:ReturnType<typeof setTimeout>|undefined,latest:{value:T}|undefined,disposed=false;
  const cancel=()=>{if(timer!==undefined){clearTimeout(timer);timer=undefined;}latest=undefined;};
  const dispose=()=>{if(disposed)return;disposed=true;signal.removeEventListener('abort',dispose);cancel();};
  const flush=()=>{
    if(timer!==undefined){clearTimeout(timer);timer=undefined;}if(disposed||signal.aborted){latest=undefined;return;}
    const request=latest;latest=undefined;if(!request)return;
    try{calculate(request.value);}catch(error){if(!disposed&&!signal.aborted)onError(error);}
  };
  const request=(value:T)=>{if(disposed||signal.aborted)return;latest={value};if(timer===undefined)timer=setTimeout(flush,delay);};
  signal.addEventListener('abort',dispose,{once:true});if(signal.aborted)dispose();
  return{request,flush,cancel,dispose,get pending(){return latest!==undefined;}};
}
