import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = context => {
  if (context.signal.aborted) return;
  let disposed = false, cleanup: (() => void) | void;
  const viewController = new AbortController();
  const host=document.createElement('div'),message = document.createElement('p'); message.textContent = 'Loading realization and coordinate controls…';message.setAttribute('role','status');host.append(message);context.container.append(host);
  const dispose=()=>{if(disposed)return;disposed=true;context.signal.removeEventListener('abort',dispose);viewController.abort();const release=cleanup;cleanup=undefined;try{release?.();}finally{host.remove();}};
  context.signal.addEventListener('abort', dispose, { once: true });
  void import('./view').then(view => {
    if (disposed || context.signal.aborted) return;
    message.remove();const release = view.mount({ container:host, signal: viewController.signal });
    if(typeof release==='function'){if(disposed||viewController.signal.aborted)release();else cleanup=release;}
  }).catch(() => {
    if (disposed || context.signal.aborted) return;
    viewController.abort();if(disposed)return;
    message.textContent = 'The exercise could not load. Reset the workspace to try again.'; message.setAttribute('role', 'alert'); host.replaceChildren(message);
  });
  return dispose;
};
