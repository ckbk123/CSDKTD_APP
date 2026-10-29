/** Read a native numeric control without silently rounding nonzero input to zero.
 * Range, integer and unit constraints remain the caller's responsibility. */
export function readNumericInput(input: HTMLInputElement, label: string): number {
  const raw = input.value.trim();
  const value = input.valueAsNumber;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw) || !Number.isFinite(value)) {
    throw new Error(`Enter ${label} as a finite number.`);
  }
  const mantissa = raw.split(/[eE]/, 1)[0];
  if (value === 0 && /[1-9]/.test(mantissa)) {
    throw new Error(`${label} is nonzero but too small to represent. Rescale it, or enter 0 explicitly.`);
  }
  return value;
}
