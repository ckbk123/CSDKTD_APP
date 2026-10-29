import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  let disposed = false;
  let cleanup: void | (() => void);
  const visit = new AbortController();
  const host = document.createElement('div'), loading = document.createElement('p'); loading.textContent = 'Loading visual inputs…'; loading.setAttribute('role','status'); host.append(loading); container.append(host);
  const dispose = (): void => { if (disposed) return; disposed = true; signal.removeEventListener('abort', dispose); visit.abort(); const release=cleanup;cleanup=undefined;try{release?.();}finally{host.remove();} };
  signal.addEventListener('abort', dispose, { once: true });
  void import('./view').then(view => {
    if (disposed || signal.aborted) return;
    loading.remove(); const release = view.mountView({ container:host, signal: visit.signal });
    if(typeof release==='function'){if(disposed||visit.signal.aborted)release();else cleanup=release;}
  }).catch(() => {
    if (disposed || signal.aborted) return;
    visit.abort(); if(disposed)return;host.replaceChildren(loading);loading.setAttribute('role','alert'); loading.textContent = 'Visual inputs could not load. Reset the tool to try again.';
  });
  return dispose;
};
