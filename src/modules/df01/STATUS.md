# DF01 implementation status

- **Stage:** in-progress
- **Assessed:** 2026-10-29; starting revision `c5d1135`
- **Ownership:** `src/modules/df01/**`; accepted contract: [TASK.md](TASK.md)

## Requirement audit before implementation

The starting workspace is a blank synchronous mount, metadata is lazy, and no local tests exist. The shell equation preview does not feed a solver. Preserve metadata and shared lifecycle.

| Accepted requirement | Starting evidence / next action |
|---|---|
| Editable TF, sample period and horizon | Absent; add shared visual field, bounded rational-polynomial parser and numeric controls |
| Manually identify peak/settling before checking | Absent; add sample selectors, prediction feedback and answer reveal |
| Stem response, final value, selectable band and markers | Absent; compute from input and label sample/time axes |
| Samples and seconds with explicit timing | Absent; use k=0 at initial output, t=kT, unit input from k=0 |
| All subsequent samples and sufficient horizon | Absent; combine observed suffix with a conservative state-matrix tail bound; otherwise report not established |
| Compare recurrence and state with same initialization | Absent; independently step output recurrence and controllable state realization, both zero prehistory |
| Independent baseline / changes / errors | Absent; derive closed-form first-order, alternating, repeated and conjugate-mode fixtures |
| Browser/lifecycle and project validation | Not yet performed |

## Planned bounded domain

Real proper rational TFs in z, denominator degree 1 or 2; real decimal coefficients, sums/products, parentheses, powers 0–2 and a single fraction. Strictly disk-stable denominator without cancellation; nonzero final value. Zero prehistory, direct feedthrough permitted. Unit step input, 2%/5% bands relative to absolute DC final value, last index N=2–500 and T=0.000001–1000 seconds. No continuous plant/hold is supplied: no intersample reconstruction or continuous-peak claim.

The source audit's DF1 entry supports recurrence/state comparison and sampled metrics (CH8:41–62; S13:6–11). Original slide assets have not been inspected by this worker. The default and additional fixtures are independently derived tests, not asserted slide transcriptions.

## Remaining work

Implementation, mathematical tests, actual browser checks, final project checks and delivery remain. No shared dependency changes are needed.

## Implementation checkpoint (before browser QA)

- `math.ts`: bounded visual-fraction polynomial parser, stable order 1–2 model, independently stepped recurrence/state realization, final value, band and conservative future-error bound.
- `view.ts` and scoped `style.css`: editable model/T/N/band, stems and sample inspector, manual predictions and reveal, oscillatory and short-horizon experiments, equations and units.
- `workspace.ts`: synchronous guarded lazy view; cleanup also prevents a late view import from mounting.
- `math.test.ts`: 27 mathematical/parser tests; `workspace.test.ts`: 2 late-import/cleanup tests.
- Node 24.22.1 and locked dependencies installed in this worktree. An initial `npm ci` used the machine default Node 20 and printed engine warnings; it was repeated successfully under Node 24 via explicit npm CLI invocation. No dependency files changed.
- `npm run check` passed. A first full `npm test` exposed MathLive's Node SSR export when importing the workspace; moving browser initialization into the visit-owned lazy view resolved it without shared changes. Full `npm test` now passes **8 files / 71 tests**. Production build passed before this lazy-view adjustment; rerun required for final evidence.
- Browser QA reservation was busy (DR01); no browser surface has been accessed. Browser verification and final delivery remain pending; stage stays in-progress.

## Boundary-review checkpoint

- Added a true temporary-entry fixture: `(z²−z+1.64)/(z²+.64)` has y[2]=1 but y[3]=1.64. A short in-band suffix does not establish settling.
- A sample within the roundoff margin of the band boundary now leaves the earliest settling index unestablished; it is never silently skipped in favor of a later index. Added an independent `r=sqrt(.05)` fixture with its k=2 error exactly 5%.
- Small nonzero residuals remain visible; scientific coefficients typeset as powers of ten.
- Added UI transition tests for model-error invalidation, time recomputation and fresh reopening. Current local suite: **3 files / 33 tests**. Full suite before the final scientific-number formatting adjustment: **9 files / 74 tests**, type check and build passed. Final checks/browser evidence remain pending.
