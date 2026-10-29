export type Domain = 'continuous' | 'discrete';
export type Category = 'representation' | 'plots' | 'stability' | 'performance' | 'design';

/** A new context is created on every visit and reset. Only this module owns
 * the children of container. Attach listeners with signal or release them
 * in cleanup. Cleanup runs after abort, while the container is still attached. */
export interface ModuleContext {
  readonly container: HTMLElement;
  readonly signal: AbortSignal;
}

export type ModuleMount = (context: ModuleContext) => void | (() => void);
export interface ModuleWorkspace { readonly mount: ModuleMount }

/** Keep this file's metadata import cheap. Load controls/math only in load().
 * DefaultExample is descriptive metadata; structured initial state belongs
 * inside the module's workspace and is created afresh by mount(). */
export interface ModuleManifest {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly domain: Domain;
  readonly category: Category;
  readonly defaultExample: string;
  readonly load: () => Promise<ModuleWorkspace>;
}
