import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  let dispose: (() => void) | undefined, closed = false;
  void import('./ui').then(({ mountUI }) => {
    if (closed || signal.aborted) return;
    const cleanup = mountUI({ container, signal }); if (typeof cleanup === 'function') dispose = cleanup;
  });
  return () => { closed = true; dispose?.(); };
};
