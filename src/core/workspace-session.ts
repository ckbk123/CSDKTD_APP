import type { ModuleManifest } from './module';

interface Visit {
  controller: AbortController;
  container: HTMLElement;
  cleanup?: () => void;
}

/** Owns a single module visit. Late network imports cannot mount into a
 * different page. A module's private state is released on reset/navigation. */
export class WorkspaceSession {
  private visit?: Visit;

  constructor(private readonly onCleanupError: (error: unknown) => void = console.error) {}

  close(): void {
    const visit = this.visit;
    this.visit = undefined;
    if (!visit) return;
    visit.controller.abort();
    try { visit.cleanup?.(); }
    catch (error) { this.onCleanupError(error); }
    finally { visit.container.replaceChildren(); }
  }

  async open(manifest: ModuleManifest, container: HTMLElement): Promise<boolean> {
    this.close();
    // The shell may have rendered a load-error message after a failed visit.
    // A retry starts with an empty container even when no visit is active.
    container.replaceChildren();
    const visit: Visit = { controller: new AbortController(), container };
    this.visit = visit;
    try {
      const workspace = await manifest.load();
      if (this.visit !== visit) return false;
      const cleanup = workspace.mount({ container, signal: visit.controller.signal });
      if (cleanup) visit.cleanup = cleanup;
      return true;
    } catch (error) {
      if (this.visit !== visit) return false;
      this.close();
      throw error;
    }
  }
}
