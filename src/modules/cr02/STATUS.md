# CR02 implementation status

- **Stage:** in-progress — automated checks pass; actual-browser QA remains.
- **Assessed:** 2026-10-29
- **Baseline:** `ae7daf3477c322d980418ec094b35585e43e109c` (fresh primary-main snapshot)
- **Owned scope:** `src/modules/cr02/**`
- **Worker chat:** `01a186d2-0050-7de0-aa3f-c6616623f222`
- **Branch:** `codex/cr02-ode-laplace-01a186d2`
- **Worktree:** `C:/Users/baokh/.codex/worktrees/cr02-ode-laplace-01a186d2/CSDKTD APP`
- **PR:** [CR02 #12](https://github.com/ckbk123/CSDKTD_APP/pull/12), attached to this chat, draft pending browser QA
- **Contract:** [TASK.md](TASK.md)

## Accepted requirements and evidence

The claimed baseline contained metadata and a blank mount, with no local mathematics, controls or tests to preserve.

| Requirement | Current behavior / evidence |
|---|---|
| Verified physical balance and normalization | Signed Newton balance and mass/spring/damper schematic; physical coefficient cells and two-way visual ODE draft; division by mass |
| Link physical, ODE, Laplace and coefficient terms | Selecting each force highlights its cell/schematic and shows units, ODE term and unilateral derivative identity |
| Retain initial terms | Transformed equation includes m·y(0−)·s + m·v(0−) + c·y(0−); initial data remain separate from G(s) |
| Separate system and experiment | Zero-state G(s), Y_zi and Y_zs; total = free + forced at a time cursor, in computed curves and sample table |
| Change mass and initial displacement | Arbitrary supported cell/ODE edits, W02, nonzero-IC, derivative-input and free-mass presets; Apply synchronizes drafts |
| Input derivatives from one input | Separate modified-state construction x1=y, x2=y′−(d/m)u; explicit step impulse/velocity jump and ramp timing |
| Prediction, errors and lifecycle | Prediction before reveal, edits invalidate answers, local state, abort-safe lazy loading, attached load-error recovery and cleanup tests |
| Visual equations and narrow layout | Shared MathLive input/display and scoped styles implemented; actual keyboard/fonts/phone/navigation QA pending |
| Independent mathematics | 41 mathematical/parser/notation tests, including required analytic fixtures and 3,906 independent changed-model comparisons |
| Project validation | 50 local tests, 92 full-project tests, type check, build and diff whitespace check pass |

## Supported mathematical domain

Continuous SISO LTI force balance m y″+c y′+k y=b u+d u′, with no feedback connection. Mass is 0.01…1,000 kg; c,k≥0; every other coefficient is zero or has magnitude 10⁻⁹…1,000; b,d may be negative. Laplace coefficients are in descending powers of s. G(s)=(d s+b)/(m s²+c s+k), independently of initial conditions.

Time is seconds, displacement metres, velocity m/s; damping N·s/m, stiffness N/m, b N/input unit, d N·s/input unit. Initial displacement/velocity and command amplitude or ramp slope have magnitude at most 100. Initial data refer to 0− and u(0−)=0. Commands are zero, step A or ramp A·t. A step changes velocity by dA/m and keeps displacement continuous; a ramp starts at zero without an initial jump. No sampling period applies to this continuous model.

The bounded visual grammar accepts sums of numeric multiples of y″,y′,y on the left and u,u′ on the right; prime/dot notation; decimals; compact/mixed/signed/grouped numeric fractions; numeric font wrappers emitted by paste. Unknown parameters, nonlinear terms, arbitrary algebra, excessive derivatives, more than 16 terms/side or 600 characters are rejected. Raw e/E is rejected because MathLive shows a mathematical symbol. Generated results use textbook powers of ten. Numeric HTML fields accept scientific notation but reject nonzero underflow to zero.

The response uses a four-state augmented matrix exponential, row-norm scaling ≤0.5, 26 Taylor terms and at most 36 squarings; pre-roundoff series remainder is below 3×10⁻³⁶. No physical-matrix inverse or time-step integration is used. Horizon 0.001…60 s, 2…1,001 computed points, numeric cursor inside the plotted interval. Displacement/velocity beyond 10¹², nonfinite values and excessive intermediate scale receive feedback. Curves join computed points, warn about unresolved fast modes/insufficient horizon and do not certify extrema or settling between samples. Display uses 7 significant digits; prediction tolerance is 10⁻⁷ absolute/relative.

Quadratic roots use a cancellation-resistant real-root formula. DC results distinguish finite limits, true zero-factor cancellation, no finite limit and out-of-range values. Original denominator poles and initial response survive cancellation in the zero-state ratio. Zero stiffness/damping and free-mass cases are supported; zero mass is rejected.

## Automated validation

Commands ran here with bundled Node 24:

- `node node_modules/vitest/vitest.mjs run src/modules/cr02`: **3 files, 50 tests passed** (41 math/parser/notation, six caller-state, three loading/lifecycle).
- `npm run check`: passed.
- `npm test`: **9 files, 92 tests passed**.
- `npm run build`: passed; existing MathLive chunk-size warning remains.
- `git diff --check`: passed.

Independent analytic fixtures include baseline step 1/2−e⁻ᵗ+(1/2)e⁻²ᵗ, free response 2e⁻ᵗ−e⁻²ᵗ, W02 step 1/3−e⁻ᵗ+(2/3)e⁻¹·⁵ᵗ, repeated/complex poles, zero stiffness, free-mass cubic ramp and derivative-input step/ramp formulas. A separate scalar closed-form reference uses roots, exponential/trigonometric homogeneous solutions and polynomial particular solutions without calling implementation matrix/pole routines. It agrees across 62 models, three excitation modes and seven times through 60 s: **3,906 free/forced/total comparisons**, tolerance 2×10⁻⁷ absolute/relative.

Parser regressions include signed/grouped fractions, pasted numeric font wrappers, malformed/unsupported expressions, visual e/E meaning and underflow. Caller tests cover stale-answer invalidation, empty cells, numeric underflow, unchanged G after initial edits and lifecycle isolation. MathLive SSR and mocked input tests are not browser evidence.

## Browser evidence and remaining work

Worker production preview is on port 8852; primary port 8787 is untouched. Shared browser QA remains pending. Actual CR02 typing, keyboard/fonts, baseline/W02/nonzero-IC results, derivative-input step/ramp, changed coefficients and failures, plots/cursor/table, reset/reopen/rapid navigation, narrow viewport and cleanup have not yet been checked in a real browser. Capture evidence, repair issues, repeat affected checks, then make PR #12 ready and submit its exact tested pushed SHA.

At 18:02 local the coordinator reserved the next slot after DS01 for DS02 integration/shared numeric-input review. This worker stopped its pending event-based QA acquisition and will wait for normal scheduling to resume. No other reservation was interrupted.

## Source distinction and recoverable checkpoints

The repository's continuous audit records inspected W02 model 2y″+5y′+3y=u, poles −1,−1.5 and DC gain 1/3. Its nonzero-IC and input-derivative examples are proposed verification fixtures. Original worksheets/decks were not found at the recorded parent path; no new inspection is claimed. Independent algebra verifies fixtures separately.

Mathematics checkpoint `661cdd002e5370364ac17a691bad57fa0e40041e` was suspended for DR02 e/E review; UI checkpoint `d98baee63a1bee87f7c6bc0cc0820bbdb974ef81` for DR02 signed-fraction review. Corrections stayed on DR02's preserved PR/branch. CR02 resumed afterward; no sibling imports or combined contribution commits. Checkpoint `9bbaf0bbc385037b6f71f322b9880e1dcadd3118` added the independent closed-form audit.

DR02 remains separately submitted at `a8d544aaafe122588b8b58fa88a8b06a4594813e`, worktree `C:/Users/baokh/.codex/worktrees/dr02-difference-equation/CSDKTD APP`, branch `codex/dr02-01a186d2`, [PR #5](https://github.com/ckbk123/CSDKTD_APP/pull/5). Its final signed visual fraction gate is coordinator-owned. A newly confirmed numeric font-wrapper equivalence defect is recorded on that PR for reopening; the frozen branch has not changed. Review returns take priority after checkpointing CR02.

## Current shared API coordination

Primary v0.3.3 introduced stateless readNumericInput(input,label). This older branch retains its independently tested equivalent local native-number guard: empty/nonfinite/over-limit entries fail, and a nonzero significand that underflows to zero is rejected. The coordinator explicitly approved this carry-forward on 29 October 2026 and will adapt the import during checked integration. No unowned helper was copied and no rebase/main merge was performed.

The static interface audit also made metadata immutable, clarified rounded numerical labels, gave diagrams/plots keyboard-accessible local horizontal scrolling to retain readable labels on phones, and cleared stale selected Laplace terms after invalid initial data. The affected 50 module tests and production build pass. Actual-browser evidence is still pending. Current recoverable implementation checkpoint before this documentation is 977b39b1c84c43f9c5d57921cb2413e0d4464f07.
