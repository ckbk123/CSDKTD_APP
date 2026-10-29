# DR05 implementation status

- **Stage:** in-progress
- **Assessed:** 2026-10-29. Contribution base: 8696261267b7620bfc101ce2b5f13772bfaa529a. This delivery record accompanies the tested tree; the submitted claim names its exact final commit.
- **Worker chat:** 01a18700-cc48-7482-ba96-f9aab107f802
- **Branch/worktree:** codex/dr05-zoh-f802; C:\Users\baokh\.codex\worktrees\dr05-zoh-f802\CSDKTD APP
- **Pull request:** [#11](https://github.com/ckbk123/CSDKTD_APP/pull/11), reused for the review correction.
- **Ownership/contract:** src/modules/dr05/**; [TASK.md](TASK.md).

## Requirement audit

The claimed baseline contained metadata and a blank workspace, with no local mathematical tests. The shared banner was a notation preview. Metadata and shell behavior are preserved.

| Accepted requirement | Delivered evidence |
|---|---|
| Editable continuous source and sampled target | Shared visual equation entry/typeset results in view.ts; bounded rational parser; coefficient-derived continuous canonical realization. |
| Exact ZOH including singular A | Augmented exponential of [A B;0 0]T gives Ad and the input integral without dividing by A. Tests include integrators, oscillator, repeated/distinct real poles and feedthrough. |
| Selected approximations | Forward Euler, backward Euler and trapezoidal integration use the same constant held value on each interval. Formulas, matrices and finite-horizon sampled output difference are shown. Failed comparisons preserve valid exact results with feedback. |
| Source trajectory, held input, clock | Reconstructed continuous interval paths, exact sample circles, approximation squares and separate held-input/clock panel. Separate paths preserve feedthrough jumps. Drawing density does not alter sampled values. |
| Intermediate reasoning and recurrence | Source equations/matrices, augmented construction, exp/integral identities, sampled update, conditioned zero-state pulse TF/scalar recurrence, inspected arithmetic and complete accessible sample/state table. Unreliable scalar conversion is explicitly omitted while the state recurrence survives. |
| Integer delay | Causal input delay mT before plant, zero input history and right-hand output timing. Fractional delay rejected; insufficient post-delay horizon reported. |
| Attempt/reveal and variation | First-sample prediction with explicit tolerance; editable plant/T/delay/input/amplitude/initial state/count/density/method. Baseline/.2 s worksheet, singular integrators, delayed 5/s² and oscillator presets. Edits hide stale results. |
| Validation and lifecycle | 62 math/parser, 11 view-flow and 5 loader tests. Synchronous workspace, owned lazy host/child signal, immediate partial-mount abort, active error recovery and equation destruction. Mutable state belongs to mount. Scoped CSS, numeric controls, keyboard access and internal math/plot/table scrolling. |

## Supported domain and conventions

Real proper SISO rational continuous plants with denominator order 1–2. Grammar: s, decimal literals, sums/products, supported implicit multiplication, fractions, visible parentheses and integer powers 0–2; optional G(s)=. Full, compact, mixed-argument and nested MathLive fractions are equivalent. Numeric-only font wrappers retain their defined grouping.

Mixed-number adjacency, numeric/fraction adjacency and adjacency before an invisible group require explicit + or ×. Standalone invisible algebraic groups are rejected with visible-parenthesis guidance; fraction/exponent arguments retain their normal grouping. Unsupported functions, embedded delays, other variables, arbitrary styled algebra and visual e/E scientific literals are rejected. Native number controls separately accept scientific numeric notation. Nonzero literal/product/normalization underflow is rejected. Prediction and sample-index controls use the local native-number guard too.

Arrays use descending powers. Original denominator is retained and normalized into controllable canonical coordinates: for order 2, A=[[0,1],[-a0,-a1]], B=[0,1], D=b2, C=[b0−D a0,b1−D a1]. Initial states are these canonical coordinates. There is no feedback connection in this experiment. Input/output units are normalized; time is seconds.

u[k−m] acts on [kT,(k+1)T); negative-index input history is zero. Initial plant state is independent of that history. y[k] is right-hand Cx[k]+D u[k−m]. Fixed m with changed T changes physical delay τ=mT. Step, one-period pulse (not Dirac impulse) and sampled physical ramp A kT are supported. Transfer/scalar recurrence is zero-state; selected initial conditions propagate through the state model.

Bounds: T=.0001–10 s, 4–120 sample instants, integer m=0–12, 2–16 drawing subdivisions per interval, amplitude/initial-state magnitude ≤10⁴, output ≤10¹⁰, state ≤10¹². Parser: 512 characters, nesting 20, intermediate degree 6/coefficient ≤10¹², entered/normalized coefficients ≤10⁶, leading denominator ≥10⁻⁸. Exponential: size ≤3, infinity norm ≤64, scaled to norm ≤.5, at most 64 Taylor terms/7 squarings; convergence threshold 2×10⁻¹⁶ max(1,sum norm). Implicit-method pivot tolerance: 10⁻¹² max(1,matrix norm). Invalid dimensions/nonfinite data, unsupported size, singular implicit methods, excessive response/work and nonconvergence have explicit feedback.

Scalar coefficients have a separate conservative conditioning limit: cancellation amplification must be below 10⁸; nonfinite/nonzero-underflow products are rejected; the two-state determinant must agree with exp(tr(A)T) to relative residual ≤10⁻⁹. An unreliable TF/recurrence is omitted, with an announced explanation and smaller-T suggestion. State matrices, recurrence, samples and trajectory remain available. A nominal zero coefficient obtained by cancellation can also be withheld. This gate is not a general condition-number certificate or a claim that scalar conversion works throughout the state-simulation domain.

Prediction tolerance: |guess−y[1]| ≤10⁻⁵ max(1,|y[1]|). Displays use 7 significant digits; calculation uses floating point. ZOH identities are exact for this hold; matrices numerically evaluate them. Continuous drawing is a finite grid, not a peak calculation. Pole-scale coarse-drawing feedback is diagnostic, not an accuracy certificate. Comparisons cover the chosen sampled horizon and are plant-interval integration methods, distinct from controller emulation by frequency substitution. No complete stability/performance region is claimed.

## Sources and independent references

Read TASK, atlas DR05 and the recorded discrete audit DR3/DR4. They cite Ch7:4–8,22–29,43–49 and S12:4–11,13–14, including the .2 s worksheet. Original external decks were not newly inspected. Delayed 5/s² is the audit's separately declared ZOH plant path, not an unverified complete original feedback topology. Integrator/oscillator examples are independent teaching fixtures.

Independent test oracles: baseline Ad=e^(−T), Bd=1−e^(−T), step y[k]=1−e^(−kT); nilpotent single/double integrator; oscillator sine/cosine; repeated critically damped/distinct real-pole step formulas; delayed 5/s² T=.2,m=1 giving y[2]=.1; feedthrough jumps and selected-state/zero-input-history cases. Approximation formulas use independent scalar/matrix results and refinement checks. Tests cover changed coefficients/T, density invariance, scalar recurrence, fraction notation/precedence, resource failures, native underflow, singular comparison and insufficient horizon. View tests stub the public equation API; they are not real-editor evidence.

Supplemental own SciPy 1.18.1 scipy.linalg.expm comparisons on 40 deterministic models (seed 20261029) checked 480 samples/1,760 trajectory points. Maximum matrix absolute discrepancy: 1.23×10⁻¹⁵; scaled sample/trajectory discrepancies <9.8×10⁻¹⁵. Finite checks supplement analytical fixtures, not proof for arbitrary conditioning/order. The private reference summary is retained with the worker ledger.

## Review correction and preliminary independent review

The coordinator returned source 0872a8f in this same PR for a real scalar-conversion defect. For G(s)=1/((s−60)(s+.01)), T=1, count 4, density 16, amplitude 1e−70 and zero initial state, the augmented norm is about 61.59 and responses remain bounded. Subtracting huge products to obtain scalar coefficients loses a mode: true discrete pole product exp(59.99)≈1.130644226e26 was replaced by 3.245185537e32. The prior implemented assessment did not certify that case.

The correction applies the separate scalar gate above and preserves valid state results. The independent partial-fraction oracle integrates modes 60 and −.01; changed T=.1 checks scalar coefficients through modal geometric sequences. UI regression checks omission of scalar equations, retained state recurrence/table, announced status and recovery at smaller T. Additional notation regressions reject mixed numbers/invisible grouping without silently changing displayed meaning.

Coordinator chat 01a182f7-8bce-7fb3-b79d-2ef1b1cfe8dd reported preliminary review of immutable bb301f8c480de842e96acbc8ebc2e53c3d7708d0: the returned conditioning gate passed; 1,212 model/interval probes found no further blocker (1,163 accepted, 49 conservatively suppressed), maximum scaled coefficient error 1.03×10⁻⁹. This is independent evidence for that correction, not final integration acceptance. The mathematical implementation remains unchanged by the later UI/lifecycle correction below.

## Second review return: inspection draft and partial-mount cleanup

The coordinator reopened submitted 9124825 in the same PR after integration preparation found two owned defects. CR06 was checkpointed at 21e8cbc and suspended before these repairs.

Reveal previously used Number(inspect.value)||0, silently changing nonzero underflow 1e-400 into sample zero despite guarded inspection input events. Reveal now reads through the approved local guard, preserves invalid/empty/negative/noninteger drafts for localized showSample feedback, and clamps only a validated nonnegative integer to a shortened sample count. Newly revealed plots are cleared before inspection so an invalid draft cannot leave old-model plots beside new equations/table. The valid numerical model/table stays available. Intentional zero 0e-400 still selects zero; invalid drafts do not.

The local reader also explicitly rejects nonfinite values, and an optional prediction with browser validity.badInput is validated rather than silently treated as omitted. Its view regression models the native invalid-edit state (empty DOM value but badInput=true), which cannot be created by assigning input.value programmatically.

workspace.ts now creates its own host and child AbortController, forwards parent abort, and aborts child resources immediately when lazy view mounting throws after partial allocation. Recovery replaces only the owned host. Disposal aborts/detaches once, calls normal cleanup if returned, and removes the host; unrelated container siblings survive. Tests register an actual signal-owned listener and abort cleanup before deliberately throwing, then verify immediate release while the parent remains active. Normal disposal and repeated cleanup are tested too.

The focused regressions and complete automated checks pass below. Actual-browser Reveal/underflow/intentional-zero and normal reset/navigation checks on this corrected build remain pending under the shared QA order DD04 -> CP03 -> DR01 -> DP03 -> normal acquisition. Deliberate partial-mount failure is tested with an allocated-resource mock, not claimed as browser fault injection.

## Automated verification

Executed in this isolated worktree using Node 24.22.1/npm 10.8.2 (explicit bundled Node invoking npm CLI):

- npm ci: passed, 109 packages, zero audit vulnerabilities at installation.
- npm test -- src/modules/dr05: **78 passed** across 3 files (62 math/parser, 11 view, 5 loader), after the second review correction.
- npm run check: TypeScript passed.
- npm test: **161 passed** across 11 files on this branch's recorded base, after the second review correction.
- npm run build: type check/production Vite build passed; existing MathLive large-chunk advisory only. Generated output is untracked.
- [GitHub check for reviewed code checkpoint bb301f8](https://github.com/ckbk123/CSDKTD_APP/actions/runs/40869920735): passed. Final submitted SHA also includes this evidence record.

## Real-browser verification

Private production preview 8892, exclusive shared QA reservations; primary 8787 untouched. In-app Chromium, system dark theme; actual MathLive fonts/fractions/matrices visually inspected.

Original exercise checks, retained after the targeted correction:

- Baseline Ad=.9048374/Bd=.09516258; correct prediction and samples [0,.09516258,.1812692,.2591818]. T=.2 gives y[1]=.1812692; density 8→16 preserves samples.
- Delayed 5/s² T=.2,m=1 gives y[2]=.1 with expected matrices/TF/recurrence. Integrator pulse [0,.1,.1,.1], physical ramp [0,0,.01,.03]; x1=2 shifts it to [2,2,2.01,2.03]. Backward/trapezoidal matrices match references.
- Fractional delay, empty/unsupported plant and visual e notation produce useful errors. Native amplitude 1e−400 rejects underflow, intentional 0 works, 1e−2 gives y[1]=.0009516258.
- Backward comparison for 1/(s−1),T=1 is singular but exact y[1]=1.718282 remains. Coarse 1/(s+4),T=1,density 2 warns/y[1]=.2454211; density 16 removes warning with identical sample. Delay 3/count 4 reports no full post-arrival interval.
- Continuous/held-input plots and coincident exact-circle/approximation-square markers were visually checked.

Final targeted checks on the corrected production build, completed 2026-10-29:

- Extreme conditioning fixture retains four accurate outputs [0,3.171714e−48,3.622121e−22,41364.89] and final state [41364.89,2481893]. No scalar TF/recurrence is displayed; both the status region and readable explanation announce the limitation. At T=.1, scalar denominator [1,−404.4278,403.0256] and numerator [0,.1101016,.5602778] reappear.
- Real fraction buttons construct the mixed numerator (2½)/(s+1); it is rejected with +/× guidance. Signed mixed notation is also rejected and old answers stay hidden. Explicit addition gives y[1]=.2379065; explicit multiplication gives .09516258. Pasted {2+3}/(s+1) retains its invisible group and receives visible-parenthesis guidance.
- Ordinary nested fraction-button plant (1/2)/(s+1) and outer minus give y[1]=±.04758129. Pasted numeric mathrm{1} fraction works and gives .09516258.
- Native prediction 1e−400 and sample index 1e−400 receive useful errors. Intentional index 0e−400 inspects sample 0. Clearing prediction restores the normal calculation.
- Narrow 390×844 viewport: document client/scroll width 375/375; plot client/scroll 305/560, with internal scrolling. Error feedback wraps, matrices/fractions render, keyboard fits, Escape closes it and Tab from editor reaches fraction tools.
- Reset with keyboard open restores baseline controls, blank prediction, hidden answers and closed keyboard. Re-reveal returns baseline y[1]=.09516258. Leaving with keyboard open removes it; repeated rapid leave/reopen settles into one fresh editor and hidden baseline answers. Final warning/error log is empty.
- Temporary viewport was reset, private tab closed and QA released.

One earlier immediate preset/reveal after automated viewport reset reported an unmounted/empty editor. Fresh reload and ordinary preset/reveal passed; normal reset/navigation did not reproduce it. Final targeted preset/reset/navigation checks pass. Other browser engines and light-theme screenshots were not tested.

## Remaining work and coordination

Focused production-browser validation of the second review correction remains. This stage is in-progress until that evidence is recorded and the exact clean final tree is resubmitted. Independent final coordinator review/integration remains separate. No package, shell, routing, deployment or sibling-module edits are included.

This branch predates main v0.3.3's readNumericInput(input,label). Its tested equivalent local native-number guard is an approved carry-forward under the coordinator's 2026-10-29 instruction. The coordinator owns import adaptation and its checks during integration; no unowned shared file, rebase or merge was added for that rollout. The same PR/branch is preserved for exact clean resubmission and later review.
