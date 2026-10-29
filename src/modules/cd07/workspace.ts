import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  void container;
  void signal;
  // Intentionally blank. Own module state and controls inside this mount.
};
