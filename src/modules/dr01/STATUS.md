# DR01 implementation status

- **Stage:** in-progress
- **Last assessed:** 2026-10-29
- **Starting revision:** `c5d1135ba8b595215dfc7007824d5bd206908152`
- **Ownership:** `src/modules/dr01/**`; [accepted contract](TASK.md)

## Requirement audit before implementation

The starting workspace is a blank synchronous mount; no module tests or computation exist. index.ts is metadata-only and will be preserved. The shared equation banner is only a preview.

| Accepted requirement | Current evidence / next action |
|---|---|
| Derive/invert supported sequences | Missing. Implement a local bounded real rational parser, geometric/FIR builders and causal recurrence inversion. |
| Sequence terms, shift identities, transform factors | Missing. Connect geometric and finite sum/average constructors to visual equation entry; derive factor kernels and delayed terms. |
| First samples, prediction and plot | Missing. Predict samples before revealing computed stems/table with a selected index. |
| Initial values and transform convention | Missing. Separate zero-history expression from unilateral initial-history correction; state causal exterior ROC and bilateral ambiguity. |
| Moving sum versus average | Missing. Show explicit weights and DC gains, never normalize a sum silently. |
| Mathematical fixtures and failures | Missing. Independently derived geometric, repeated/conjugate poles, FIR, delay, history and invalid-form tests planned. |
| Project/browser/lifecycle checks | Not performed yet. Record exact results before calling the module implemented. |

## Bounded design

Support real rational expressions in z with numerator degree at most 14 and denominator degree at most 2 in q=z^-1 after common delay factors are removed. Provide geometric sequences with integer delay and finite rectangular sums/averages. Compute at most 64 samples; show discrete samples, not continuous interpolation. Explicit unilateral k>=0 convention; histories x[-1], x[-2] alter the initial response while preserving the entered zero-history transform. No general CAS or automatic pole/zero cancellation.

## Evidence and remaining work

Course context read: atlas DR01, discrete source audit DR1, and E09's finite-sequence adaptation. Original source slides/PDF have not been independently re-inspected; added numeric fixtures will be identified as independent fixtures, not new source claims. All implementation and verification rows above remain open at this checkpoint. No shared dependency changes requested.

## Implementation checkpoint (before browser verification)

- Added local bounded arithmetic parser and causal recurrence inversion in math.ts; linked transform forms, factors, unilateral correction and sequence builders in view.ts.
- Added prediction/reveal, selected-sample memory arithmetic, sample table and computed SVG stems. Sum/average examples preserve explicit tap weights.
- Browser-only equation view now loads after the synchronous mount, guarded against abort/cleanup. A direct top-level MathLive import exposed its Node SSR limitation in the existing catalogue test; module-local view loading resolves this without shared edits.
- `npm run check` passed and production build passed before the view split; the existing MathLive chunk-size warning remains. Initial full test run exposed the SSR import issue; after the fix `npm test` passed 81/81. Additional edge checks are still being added.
- Shared browser reservation was busy (DP02) at 15:50 local time; no browser controls used. Browser checks and final rerun remain required. Stage remains in-progress.

## Resumed checkpoint

Resumed 2026-10-29 with a clean worktree and the same active DR01 claim. At revision 1f1ddbc, `npm run check`, module tests (42/42), full `npm test` (84/84) and `npm run build` passed under Node 24.22.1. Follow-up inspection found generated average weights were rounded before being re-parsed; the editor now receives full-precision generated coefficients, with display rounding separate. Added independent one-third normalization and exercise-flow tests. Current `npm run check` and module tests pass (48/48). No real-browser evidence is claimed yet; DR02 held QA during the resumed checks.
