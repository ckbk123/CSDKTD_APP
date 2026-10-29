/** Approved carry-forward of the shared v0.3.3 guard into this older worktree.
 * Integration can replace this local import with src/shared/numeric-input.ts.
 * Domain bounds and units remain the caller's responsibility. */
export function readNumericInput(input: HTMLInputElement, label: string): number {
  const raw = input.value.trim(), value = input.valueAsNumber;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw) || !Number.isFinite(value)) throw new Error(`Enter ${label} as a finite number.`);
  const mantissa = raw.split(/[eE]/, 1)[0];
  if (value === 0 && /[1-9]/.test(mantissa)) throw new Error(`${label} is nonzero but too small to represent. Rescale it, or enter 0 explicitly.`);
  return value;
}
