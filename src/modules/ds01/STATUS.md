# DS01 implementation status

- **Stage:** in-progress
- **Assessed:** 2026-10-29; starting revision `c5d1135`
- **Ownership:** `src/modules/ds01/**`; [accepted contract](TASK.md)

## Requirement audit before implementation

The starting `workspace.ts` is an empty synchronous mount; `index.ts` provides the correct lazy metadata. There are no module tests. The shell equation preview is not a solver.

| Accepted requirement | Starting evidence | Delivery work |
|---|---|---|
| Editable/selectable poles and computed modes | Absent | Visual complex-pole fields, sample period, finite sample horizon, selected mode |
| Strict disk test; .8, -.8, 1, -1 | Absent | Radius calculation and independently checked modal sequences |
| Repeated boundary modes | Absent | Distinguish two independent copies from Jordan chains of length 2/3; show boundedness versus asymptotic decay |
| Eigenvalues versus reduced TF | Absent | Explicit block realization with selectable output visibility; retain hidden modes in internal verdict |
| Prediction, reasoning, reveal, changed data | Absent | Predict classification before reveal, linked pole/sequence plots, boundary and hidden-mode experiments |
| Validation and bounded support | Absent | Tested complex-literal parser, numeric bounds, explicit near-boundary uncertainty |
| Lifecycle, browser and integration checks | Scaffold only | Abort-owned fields/listeners, reset/reopen/fast navigation, keyboard/fonts, narrow viewport; project checks |

## Chosen bounded model

Up to four distinct real poles or conjugate pairs, each simple, repeated independently twice, or in a Jordan chain of length 2/3. This avoids guessing Jordan structure from algebraic multiplicity. Construct a real SISO block realization; output-hidden blocks remain part of A. No general polynomial root finder or arbitrary matrix eigensolver is promised. Private math will need no shared API or dependency changes.

## Verification and remaining work

Implementation, independent fixtures and actual browser verification are pending. Original decks were not re-inspected; TASK/atlas source anchors Ch8:4–13 and S13:4 remain course provenance, while new fixtures will be explicitly independent examples.

## Working checkpoint

- Private `math.ts` now computes radii, classifications, bounded Jordan/conjugate modes and explicit real state blocks. `workspace.ts` implements visual inputs, editable structures/channel visibility, predictions/reveal, linked plots, sample tables and preset experiments.
- `npm run check`: passed. `node node_modules/vitest/vitest.mjs run src/modules/ds01/math.test.ts`: 57 tests passed, including independently derived modal samples and real-matrix Markov coefficients.
- Still pending: complete project tests/build, real-browser evidence and final acceptance assessment. Stage remains in-progress.
- Follow-up integration fix: workspace mount now defers the browser-only equation import and guards abort/disposal. The first full-suite run exposed MathLive's Node export at catalog import time (98 passed, 1 failed); after the local fix all 99 then-existing tests passed. Six additional local UI/lifecycle tests pass, making 63 module tests. Rebuilt successfully, with only the existing MathLive large-chunk warning. Browser reservation was busy with DP02; no browser control was taken.
