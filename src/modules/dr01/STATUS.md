# DR01 implementation status

- **Stage:** in-progress (implementation and automated checks complete; real-browser checks pending)
- **Last assessed:** 2026-10-29
- **Starting revision:** `c5d1135ba8b595215dfc7007824d5bd206908152`
- **Ownership:** `src/modules/dr01/**`; [accepted contract](TASK.md)
- **Branch:** `codex/dr01-z-transforms-7e78`

## Requirement-to-evidence audit

| Accepted requirement | Implementation and evidence |
|---|---|
| Derive/invert supported sequences from editable data | `math.ts` parses bounded real rational arithmetic and normalizes coefficients ascending in q=z^-1. `view.ts` uses the shared visual equation input; geometric, delayed geometric, finite sum and finite average builders generate real input expressions. |
| Select sequence terms, shifts and transform factors | Builder family/gain/pole/delay/length controls, editable sums/products, linked z and z^-1 forms, forcing coefficients B(q), first-/second-order factors and geometric/repeated/distinct-pole inverse kernels connect the representations. The delayed-kernel convolution reconstructs each numerator term. |
| First-sample attempt, reveal, table and visualization | Three optional predictions checked with 1e-6 absolute/relative tolerance; explicit reveal; computed stems and table; numeric/keyboard selected index and table buttons highlight the corresponding old values and arithmetic. No interpolated continuous trace is claimed. |
| Initial values and causal convention | Zero-history X0 stays fixed; x[-1], x[-2] generate a separate unilateral numerator correction and a comparison response. Shift identity and guaranteed exterior convergence region are stated. The same rational expression's bilateral interior/exterior ambiguity is explained. |
| Moving sum versus normalized average | Distinct constructors and examples preserve their tap weights and DC sums. The length-4 fixtures produce gains 4 and 1; a length-3 average retains full floating-point weights through the equation input. |
| Changed data and failures | Independent fixtures cover changed gain/sign/delay, FIR, repeated/distinct/conjugate poles, nonzero history and recurrence residuals. Parser rejects malformed/empty/nonfinite/unsupported/improper or excessive inputs; sample overflow and tiny/ill-scaled coefficients produce errors. |
| Metadata and lifecycle | `index.ts` remains metadata-only. Synchronous `workspace.ts` starts a browser-only view import, ignores late results after abort/cleanup, and disposes once. All state/drafts are created per visit; listeners use the visit signal. The table uses one delegated listener across refreshes. |
| Actual project/browser integration | Automated results below pass. Real-browser evidence remains pending; stage must remain in-progress until that is completed. |

## Supported behavior and limits

- Real SISO rational expressions in z or q=z^-1: sums, subtraction, products (including implicit multiplication), fractions, groups and integer powers -14 through 14. No functions, symbolic parameters, matrices, general CAS or automatic non-delay pole/zero cancellation.
- After removing common q factors: numerator delay order <=14; denominator order <=2, normalized a0=1. Denominator memory is retained even with zero or canceling numerator, so specified history can activate a hidden recurrence mode.
- Up to 600 input characters, 240 tokens, 24 group levels; intermediate degree <=48 and coefficient magnitude <=1e12. Numeric literals are zero or have magnitude from 1e-12 through 1e6. Normalized coefficients have magnitude <=1e6. Numerical underflow/ill-scaled leading denominators are rejected.
- Builders: integer delay 0-12, finite length 1-12, last FIR index <=14; gain magnitude <=1e6 and pole magnitude <=10, each zero or magnitude >=1e-12. Generated expressions preserve full floating-point coefficient precision; displayed coefficients/results round to 7 significant digits.
- 4-64 discrete samples; histories x[-1],x[-2] finite with magnitude <=1e6; computed samples bounded by 1e12. T is 1e-6 through 100 seconds and labels t=kT only. No feedback loop is assumed. All inversion defaults to the unilateral causal exterior convention.
- The guaranteed convergence exterior uses retained denominator roots and can be conservative when a pole is removable. No maximal ROC or minimal realization is claimed. Algebraic evaluation at z=1 is distinguished from a convergent sequence sum when retained poles have radius >=1; near-zero denominator sums are reported as indeterminate.
- Kernels/shift identities are algebraic; computed coefficients, poles and samples are numerical approximations. Only causal inversion is implemented. Interior bilateral inversion, arbitrary higher-order transforms and continuous intersample reconstruction are outside the declared domain.

## Independent mathematical evidence

`math.test.ts` includes the baseline 1,.8,.64,.512,.4096,...; changed delayed 2(-.5)^(k-2); the repeated-pole identity (k+1)(.5)^k; distinct poles via independently derived 2(.5)^k-(.25)^k; conjugate poles with samples 1,0,-1,0,...; explicit FIR taps; moving-sum/average normalization; recurrence residuals and the unilateral initial-history correction. Tolerances are 1e-12 for ordinary fixtures, with exact comparisons for dyadic or integer samples. Parser/format equivalence tests complement these independent oracles.

`view.test.ts` uses an equation-interface mock to check prediction feedback, history separation, sum/average results, a changed delayed sequence, error visibility and independent visits. It does not establish interactive MathLive behavior. `workspace.test.ts` verifies abort-before-load, synchronous entry, once-only cleanup and already-aborted visits.

Course context read: atlas DR01, discrete source audit DR1 and E09's finite-sequence adaptation. Original source decks/PDF were not newly inspected. Numeric fixtures above are independently derived verification cases, not new claims of inspected course examples.

## Automated checks

Run in this isolated worktree with Node 24.22.1 (explicit bundled runtime and npm CLI; runtime directory on PATH):

- `npm run check`: passed.
- `node node_modules/vitest/vitest.mjs run src/modules/dr01`: 48/48 tests passed across three files.
- `npm test`: 90/90 tests passed across nine files.
- `npm run build`: passed, including its TypeScript check. The pre-existing shared MathLive chunk-size warning remains; all 20 WOFF2 font assets are emitted locally.
- `git diff --check`: passed before the latest local presentation refinements; rerun before submission.

The first full test run during implementation exposed MathLive's Node SSR export on direct workspace import. Moving browser-only view loading behind the guarded synchronous mount fixed this without shared edits. A later inspection found builder coefficients were rounded before re-parsing; full-precision generated inputs and an independent one-third average fixture fixed that. No known automated-test failures remain.

## Browser evidence and remaining work

Pending: reserve shared QA; inspect the production build with real equation typing, fraction/power tools, local fonts and Systems keyboard; check baseline/changed/history/error results, reset, leave/reopen, rapid navigation, narrow viewport and cleanup. DR02 held QA during the resumed automated work. No browser controls have been used by this worker yet.

No shared API/package/deployment changes or dependency requests. No merge or deployment performed. Implementation checkpoints are preserved on the worker branch; submission awaits real-browser checks and final evidence.
