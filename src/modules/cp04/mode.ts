/** Per-panel visit lifecycle; no state leaves this module or survives Reset. */
export interface ModeHooks { suspend?: () => void; resume?: () => void }
