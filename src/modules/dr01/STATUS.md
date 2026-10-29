# DR01 implementation status

- **Stage:** in-progress (compact-fraction browser follow-up pending)
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
| Actual project/browser integration | Automated checks and real-browser production checks below pass; final submission retains the bounded domain described here. |

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
- `node node_modules/vitest/vitest.mjs run src/modules/dr01`: 51/51 tests passed across three files.
- `npm test`: 93/93 tests passed across nine files.
- `npm run build`: passed, including its TypeScript check. The pre-existing shared MathLive chunk-size warning remains; all 20 WOFF2 font assets are emitted locally.
- `git diff --check`: passed. All tracked changes are confined to this module folder.

The first full test run during implementation exposed MathLive's Node SSR export on direct workspace import. Moving browser-only view loading behind the guarded synchronous mount fixed this without shared edits. A later inspection found builder coefficients were rounded before re-parsing; full-precision generated inputs and an independent one-third average fixture fixed that. No known automated-test failures remain.

## Real-browser evidence (2026-10-29)

Reserved QA exclusively through the helper, used a new worker-owned in-app Chromium tab against the production build at `http://127.0.0.1:12784/`, then closed that tab, restored the viewport override, released QA and stopped this worker's preview. Primary port 8787 and other workers' tabs/processes were not changed. The first attempted worker port (8793) was occupied and was left alone.

- Baseline predictions 1,.8,.64 matched; table/stems continued .512,.4096,... . Selected-sample numeric entry, ArrowUp and table buttons exposed the corresponding old-memory multiplication and current result.
- With x[-1]=2, the same zero-history transform produced selected-history samples 2.6,2.08,1.664 while the zero-history column remained 1,.8,.64.
- Ordinary keys plus the fraction button entered z/(z+.5), producing 1,-.5,.25,-.125,... . The power button entered z^-2, producing 0,0,1,0,... . Incomplete fraction placeholders, an empty editor and noncausal z produced useful feedback with no displayed stale result.
- Changed builder gain=2, pole=-.5, delay=2 produced 0,0,2,-1,.5,-.25,... . A three-tap normalized average displayed .3333333 for its three taps and reported sum 1. The four-tap moving sum displayed four unit taps and sum 4. Repeated-pole and conjugate-pole presets matched 1,1,.75,.5,... and 1,0,-1,0,...; boundary convergence wording did not equate algebraic X(1) with a convergent sum.
- The actual Systems keyboard rendered, toggled and closed on Escape, reset and leaving. Tab from the mathfield reached Insert fraction. Visual fractions/powers and typeset derivations rendered correctly. Asset inventory observed five used WOFF2 fonts, all from this worker's same-origin /assets/ URLs; no browser console warnings/errors were recorded.
- Reset and leave/reopen restored baseline expression, zero history, blank predictions and hidden results. Rapid catalogue -> DR01 -> DR02 navigation left no DR01 view or keyboard in the next workspace. The production build was reloaded after the view-failure/normalization fixes; baseline, leave/reopen and rapid navigation were checked again.
- At a 390x844 viewport override (375 px client width after scrollbar), document scrollWidth equaled clientWidth both before and after reveal. Numeric inputs, equations and selected-sample arithmetic remained readable. Chart and table scrolling were local (307 px containers; 620 px chart and 329 px table content), with no page-wide overflow. Default desktop client width was restored to 1265 px. Browser visual checks used the system dark theme; light-mode tokens are inherited and were not separately browser-tested.

## Independent review findings resolved

The coordinator's preliminary read-only review of `0e470130f9adc8b72aa59e32737cf85a616ba15a` identified two failures. The guarded workspace now owns a host and child abort controller: import/mount failures abort partial view resources and replace partial DOM with attached recoverable feedback. A throwing-mount regression and aborted-visit regressions pass. Normalization now rejects any nonzero numerator or denominator coefficient that divides to zero; independently derived 10^-312 / 10^12 fixtures cover both positions. The final change has not been labeled independently verified; that stage belongs to the integration review.

## Remaining work and delivery boundary

No accepted requirement remains open within the declared domain. No shared API/package/deployment changes or dependency requests. This contribution is implemented and checked on its own branch; serial integration and version management belong to the coordinator. No merge, version bump or deployment was performed. The final exact tested commit/branch/worktree are recorded in the submitted claim.

## Pull request and compact-fraction follow-up

PR: https://github.com/ckbk123/CSDKTD_APP/pull/1 (same preserved branch, draft while this correction is checked). Under the human's expanded continuous-worker instruction, the coordinator reopened the existing claim. The parser now expands MathLive's single-token fraction arguments before tokenizing numbers: \frac12, \frac1{...}, mixed braced arguments and nested fractions are supported. A regression independently checks 1/2, a changed .5 geometric sequence and nested 1/(2/3). Module tests pass 51/51, application tests 93/93 and the production build passes. A real-editor shorthand check remains pending shared QA; earlier browser evidence above is preserved and not substituted for this new check. Next action: reserve QA, enter 1/2 with the fraction button, verify its inverse and final resubmission, then claim the next module under the continuous goal. Earlier one-module stopping language is superseded by the latest human steering.
