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
