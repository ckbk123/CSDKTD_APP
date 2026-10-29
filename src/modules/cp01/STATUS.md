# CP01 implementation status

- **Stage:** implemented
- **Coordinator integration:** source `cfaccb5be0e7477a423b34d3d98d41c17094b78e` is prepared with the shared TeX argument preflight and once-only deferred cleanup. Native controls already use `readNumericInput`; numerical algorithms and bounds are preserved. The added regressions cover significant Unicode blanks, malformed nested sizing commands, valid braced spacing, standalone disposal, pending disposal and a disposer returned after reentrant abort. CP01 has209 passing tests; with the179 shared-preflight tests,388 pass. Type checking and the scoped diff check pass. This integration has not received coordinator browser acceptance; the worker's earlier browser evidence remains scoped to its submitted source.
- **Current checkpoint:** numerical-conditioning correction independently regressed and checked in the actual browser; exact same-PR resubmission prepared for coordinator review.
- **Last assessed:** 2026-10-29
- **Base:** primary-main `f99cfebb65495d3f4385a61dd1d25800e341ea68` (v0.3.5), retained without merge/rebase.
- **Worker:** chat `01a186d1-f1f0-7393-88e7-377fbac7299a`, local.
- **Branch/worktree:** `codex/cp01-time-response-7393`; `C:/Users/baokh/.codex/worktrees/cp01-time-response-7393/CSDKTD APP`.
- **PR:** [#24](https://github.com/ckbk123/CSDKTD_APP/pull/24), this module's single contribution. Prior DS01 PR #10 accepted v0.3.6; CF02 PR #18 corrected/resubmitted at `c7ab0f85a0dcb2eb074fe87826b6116145d214bd`, preserved for asynchronous review.
- **Contract:** [TASK.md](TASK.md); [stage definitions](../../../docs/PROJECT_STATUS.md).

## Scope and source provenance

The claimed baseline had a blank synchronous workspace and no local mathematics/tests. The shell's editable example is a notation preview, not a solver input channel. `index.ts` remains metadata-only. All implementation changes are confined to this module.

Read current primary AGENTS, START_HERE, AUTONOMOUS_WORKERS, COORDINATION, PROJECT_STATUS, CONTRIBUTING, DEVELOPMENT, DESIGN and EQUATION_INPUT, the matching atlas and continuous audit R2/P1. Original decks have **not** been newly inspected. Source anchors remain Ch3 time-response, S05:3–11 and S02/S04 initial-condition exercises. The baseline inverse-Laplace oracle is independently derived; nonzero-initial-state fixture below remains a **proposed verification fixture** in audit R2, not a newly transcribed slide example.

## Requirement-to-evidence assessment

| Accepted requirement | Implemented evidence | Acceptance evidence |
|---|---|---|
| Predict step/ramp/impulse/free response | Editable proper real order-1/2 N/D plus parallel direct path; five source shapes; optional checked numerical prediction before reveal; eleven computed experiment presets | All eleven actual presets and changed-value prediction pass |
| Input/output/initial-condition controls | `model.ts` normalizes full coefficients and extracts biproper direct gain; explicit phase state convention and units; numerator controls the output map | Actual equation/native edits, fraction and power buttons pass |
| Preserve initial conditions across representations | Exact phase/centered mapping, displayed realization and initial vector; coordinate change leaves inputs/results/paths intact | Actual centered switch preserves all path strings and cursor values |
| Free/forced/total overlays | Separate zero-input and zero-state trajectories and states, superposition residual, distinct line patterns; input has separate scale | Actual desktop/narrow screenshots; keyboard plot scrolling |
| Analytic terms | `analytic.ts` computes exact rational polynomial and real exponential/trigonometric terms for distinct/repeated/oscillatory/integrator modes; initial-condition and input transforms displayed | Independent 31 analytic tests and actual baseline/damped formula inspection |
| Time cursor | Direct matrix-transition evaluation with numeric field, keyboard range and side selector; no interpolation across jumps | Actual numeric/arrow-key cursor and one-sided jumps pass |
| Impulse and finite pulse | Signed ideal input/output delta **areas**, regular output curve separately; pulse width/height/area and delayed full-step identity; exact one-sided pulse endpoint | Actual signed-area symbols and pulse end values pass |
| Integrator/direct/differentiation caveats | Exact retained-mode category; stable asymptotic polynomial and endpoint horizon heuristic; no general settlement claim for integrators/oscillators/unstable modes; improper transfer rejected | Independent improper-form tests; actual integrator/unstable/horizon cases |
| Bounded mathematical errors | Exact grammar/coefficient checks, native nonzero-underflow rejection, finite state-transition/trace caps, truncation/sample-budget/pulse-horizon feedback | Actual invalid notation/native drafts remove stale results |
| Visit/lifecycle isolation | Synchronous owned loading node, child abort signal, late-load guard, partial-failure resource abort, explicit editor cleanup; old result listeners aborted when inputs change/recompute | Actual reset/reopen/rapid routes pass; deferred partial-failure resource regression |
| Independent project/browser evidence | 198 module tests; all 542 local application tests; type/build pass | Private chat-isolated production IAB QA, including returned modal-conditioning fixtures; single attached PR; exact submission via current helper |

## Supported model and timing

Continuous real SISO LTI, no feedback loop or sample period assumed. Proper numerator degree at most denominator degree, denominator order 1–2. Visible coefficients use descending powers; polynomial arrays are internal ascending powers. Leading denominator coefficient can be any supported nonzero sign and is normalized exactly. A biproper numerator is divided into a strict remainder plus direct term. The full phase realization is retained through pole cancellations.

- Order 1: w′ + a0 w = u; x=[w], y=b0 w+d u.
- Order 2: w″+a1 w′+a0 w=u; x=[w,w′], y=b0 w+b1 w′+d u.
- Initial phase state x(0−) is caller-owned and **not** silently reinterpreted as external y/y′. Centered z=[w,w′+αw], α=a1/2, preserves the same physical state.
- Time is seconds; signals use normalized units. w has input-units·s^m for denominator order m, and w′ has input-units·s^(m−1). Step A has input units; ramp A has input-units/s; impulse/pulse A is signed input-units·s area.
- Causal step/ramp begin at 0. Ideal impulse jumps the last forced phase state by A at 0+, with direct output area d A δ(t); it has no finite pointwise peak. Pulse height A/W acts on [0,W). Cursor left/right refers to ordinary limits at 0/W; the ideal delta remains separate.
- Improper transfers/ideal differentiation are rejected with distribution-aware feedback, rather than plotted as finite peaks.

Bounds: expression 400 characters, 160 primaries, nesting 12; polynomial degree≤2, intermediate coefficient magnitude≤10^9. Exact reduced fractions at most 4096 bits. Visual decimal/group/product/numeric-fraction/power-0–2 grammar is independently bounded; ambiguous mixed numbers, joined digits, hidden braces, e/E literals and bare multi-character/signed powers are rejected with guidance. True MathLive compact fraction arguments and atomic numeric style wrappers preserve their meaning.

Normalized |a0|≤100, |a1|≤20 (quadratic linear coefficient), strict-remainder |b_i|≤50, parallel/effective |d|≤10; normalized rational coefficient denominators≤10^9. Phase ICs and amplitude/area −10–10. Pulse width .001–10 s; horizon .1–60 s. Native controls use shared `readNumericInput`, including intentional zero versus nonzero underflow.

Free states/output use prepared analytic modal coefficients at absolute time, rather than repeated floating transition steps. Exact rational coefficients are resolved before exponential amplification; small genuine modes are retained, with explicit rescaling feedback if an exact nonzero modal coefficient cannot be represented. Near-coincident modes use a regular real basis. The forced numerical engine has at most four augmented states, 24 scalings / 32 Taylor terms, 600–20,000 base intervals plus pulse/event points (at most 20,024), a cache capped at 128 transitions and a 10^10 state/component cap. It reports truncation, a reached sampling budget and pulse end outside the horizon. These are floating-point traces, not exact curves or stability proofs. Analytic identities remain exact rational/radical terms; no rounded root decides an identity. Pulse propagation advances the postpulse state rather than subtracting large nearly equal step states.

For a strictly stable retained denominator, the computed nondecaying polynomial is shown; a nonzero slope means no finite final value. Endpoint agreement uses a declared 1% normalized-scale horizon heuristic and is explicitly not a settling-time certificate. Other retained-mode categories receive no blanket settling claim, since input/output/initial-state cancellations can remove a particular mode.

## Mathematical and lifecycle verification

Independent closed-form oracles include:

- Baseline step: 1/2−e^(−t)+(1/2)e^(−2t), y(1)=0.199788200446864; impulse e^(−t)−e^(−2t); ramp t/2−3/4+e^(−t)−e^(−2t)/4.
- Proposed R2 fixture x(0)=[1,0]: free 2e^(−t)−e^(−2t), unit-step total 1/2+e^(−t)−e^(−2t)/2.
- Changed gain/poles 2/[(s+1)(s+3)], linear numerator s+4, biproper numerator 2s²+7s+6 retaining the original phase state, repeated pole (s+1)², damped/undamped oscillators, first/double integrators and unstable 1/(s−1).
- Exact IC coordinate/output equivalence, initial Laplace numerator, direct ordinary jumps and output delta area, finite-pulse endpoint continuity/jump and convergence away from 0, plus diagonal/rotation/nilpotent matrix-exponential oracles.
- Pinned MathLive SSR MathML independently confirms mixed-number invisible-plus semantics and one-token exponent scope. This is parser semantic evidence, **not** real-browser editor certification.

Module tests (198): 86 parser, 21 model, 22 response/transition, 5 rational, 31 analytic, 20 workspace-flow, 4 deferred-lifecycle and 9 conditioning regressions. Workspace-flow uses explicit mock equation fields only for caller draft/ownership behavior; no actual MathLive functionality is inferred. Partial mount failure test registers a child-signal window resource then throws while parent remains active, and confirms immediate abort/recovery. Result replacement and visit cleanup tests prevent old listeners updating new results.

Checks under bundled Node v24.22.1 at this workspace checkpoint:

- `node node_modules/vitest/vitest.mjs run src/modules/cp01`: **198 tests / 8 files pass**.
- `npm run check`: passes.
- `npm test`: **542 tests / 25 files pass**.
- `npm run build`: passes, 152 modules transformed; existing MathLive large-chunk advisory only.
- `git diff --check`: passes.

## Actual browser verification — 29 October 2026

The integration coordinator supplied controlled evidence that IAB inventories and viewport overrides are private per chat, then authorized parallel QA after checking session identity. This chat's inventory reports browser 2 with `codexSessionId=01a186d1-f1f0-7393-88e7-377fbac7299a` and initially no tabs. Canceled obsolete global waiter session 92585 before testing; CD08's reservation was never released or altered. Used only this chat's created tab 4 and the isolated **production build** on `http://127.0.0.1:8799/#/module/CP01`. No Firefox launch/native input, primary8787 access or other worker tab use. Browser name is ChatGPT in-app browser; its engine/version was not exposed by the available inventory/read-only page surface.

Passed in the actual browser:

- All eleven experiment presets render two plots and computed cursor values. Baseline y(1)=0.1997882; changed poles/gain 0.3153829; free proposed fixture 0.6004236; repeated-pole step 0.2642411; damped 0.1971672; undamped 1.416147; first-integrator step 1; double-integrator ramp 0.1666667; regular ideal impulse 0.3678794; finite pulse 0.3869022; unstable step 1.718282.
- Baseline with x(0)=[1,0] and a step checks a prediction 0.8002118. Switching phase→centered shows z(0)=[1,3/2] while all SVG path data and cursor output remain identical. Actual desktop screenshot distinguishes free, forced and total lines.
- Real fraction button filled with 1, Tab, 2 copies as actual `application/x-latex` `\frac12`; numerator 1/2 produces y(1)=0.0998941. Real denominator power button builds s² and produces 0.25 with that numerator. Math keyboard toggle changes pressed state true→false on Escape.
- Actual pasted visual inputs `s2\frac12`, `(s+1)2\frac12`, styled `s\mathrm{2}\frac12`, `1e-2`, bare `s^12`, grouped `s^{12}` and hidden `{s+1}2` receive explicit feedback and leave zero plots. Valid `2s\frac12+1` computes 0.4323324.
- Native amplitude ±1e-999, empty and 11 reject with no old plots. Intentional 0e-999 gives zero; 1e-2 computes 0.001997882. Cursor underflow clears its numeric tables, keeps the checked model/plots and reports the error locally.
- For 1/(s+1)+2, unit ideal input area 1 and output delta area 2 are separate symbols; ordinary output at 0−=0 and 0+=1. Unit-area W=.1 pulse has y(W−)=20.95163, y(W+)=.9516258 and continuous dynamic state; arrow-key range moves time .1→.15 and recomputes .9052145.
- Unstable horizon 60 reports truncation at retained time 23, restricts cursor range and makes no settling claim. Pulse W=10 beyond horizon 5 reports the missing turn-off. Stable horizon .1 with prediction time .1 gives the insufficient-horizon heuristic.
- Desktop 1280×720 and narrow 390×844 dark mode: readable local math glyphs, `document.fonts.status='loaded'`, zero module MathLive display-error nodes. On narrow screen page scroll width equals client width 375; field widths 277; plots have 650 px scrollable content within 275 px regions. ArrowRight moves only the focused output plot scrollLeft 0→40. No page overflow.
- Leave while math keyboard is open removes all CP01 fields, curves and root; reopen, shell Reset example and repeated rapid catalogue↔CP01 route sequences return exactly two fresh fields, no old plots/loading/scaffold, and baseline 0.1997882 after reveal. These are actual rapid navigations, without a forced network delay; deterministic pending-import and partial-failure cases also have unit coverage.
- Actual typesetting caught unsupported legacy `\rm` labels; replaced them with `\mathrm{...}`, rebuilt/reloaded and visually rechecked. Independent formula review also corrected the outer minus separating sine/sinh terms, with a semantic sign regression. Axis labels use four significant digits to fit, cursor tables seven. Both baseline and damped computed terms now render without error.
- Console warning/error log is empty. Viewport override reset and verified 1280×720; owned tab closed and tab inventory empty; private preview stopped; no global QA reservation or waiter held.

Screenshots are local evidence outside Git:

- `C:/Users/baokh/.codex/visualizations/2026/10/29/01a186d1-f1f0-7393-88e7-377fbac7299a/cp01-baseline-terms.png`
- Same directory: `cp01-free-forced-desktop.png`, `cp01-baseline-cursor.png`, `cp01-damped-terms.png`, `cp01-mobile-controls.png`, `cp01-mobile-plot.png`.

## Checkpoints and disposition

Setup `449c98d` recorded the full audit and private claim/worktree. Parser prototype `422b053` was preserved before prioritizing CF02's returned correction. Mathematical-core checkpoint `21eac440af88ff072c08589fef21e8d3ba7eb037` passed 134 local module tests / 478 full tests, before the UI existed. CF02 correction completed and resubmitted before CP01 resumed.

Full analytic/UI checkpoint `a5df141` passed 186/530 tests before the final sign/typesetting/axis corrections. PR #24 was created as a draft and attached, with its pending browser work disclosed. Earlier exact-head CI `fb38653879233fb3834c050538236ec30d85e466` passed at [run 40890513979](https://github.com/ckbk123/CSDKTD_APP/actions/runs/40890513979/job/123505833004); that is historical checkpoint evidence, not final-head acceptance.

The full accepted bounded exercise now has mathematical, project and actual-browser evidence. Independent coordinator review/integration remains; no release/version/deployment is claimed. Preserve this worktree, branch and exact submitted revision for corrections on the same PR. Prior contributions remain recoverable. No shared-helper request or unowned change remains. Global application checks reflect this isolated v0.3.5-based branch; the coordinator owns current-main combined integration checks.

## Returned numerical-conditioning defect — correction verified

Independent review of frozen `87034c7` reproduced free-response failure in supported models. For G=1/[(s−2)(s+3)], x(0−)=[1,−3], the actual w=y=e^(−3t) became −128 at cursor20, trace20 ended near−171.434 and trace30 falsely truncated. For G=1/[(s−.1)(s−10)], x=[1,.1], the actual e^(.1t) became16384 at cursor5 and the trace also invented a fast mode. The displayed exact modal formulas were correct, but both transition multiplication/iteration and the previous cosh/sinh numerical evaluator suffered cancellation after exponential amplification. The source187-test suite did not cover these conditioned eigenvector fixtures; the earlier implemented label is superseded until correction verification finishes.

DS05 was checkpointed/pushed at `3550f6bd93969c709388c3b5127e413759b363f1` before returning to this preserved worktree/same PR24. Current primary guides were reread. The coordinator owns any CF02 integration-only wrapper adaptation; no action or unowned edit is taken there.

Implemented correction:

- `compileTerms` resolves real modal coefficients before exponentiation. Perfect-square rational discriminants use exact coefficients/rates, so a genuinely zero component stays absent. Irrational-root small coefficients come from their exact rational modal product divided by the well-conditioned larger coefficient, avoiding subtraction of rounded nearly equal values. No tolerance trims a small growing mode. Near-coincident modes use the regular basis for |sqrt(delta)t|<.5; large exponential products can use a logarithmic magnitude. An exact nonzero coefficient outside floating range raises explicit rescaling feedback.
- `response.ts` evaluates each free phase state and free output from those prepared expressions at absolute time, independently of the plotting steps. It no longer iterates a rounded free state through an unstable transition or recomputes its output by subtracting large state contributions. The forced matrix engine and its bounds are retained.
- The cursor now also typesets its ordinary output with multiplication/power-of-ten notation for small or large values. Compact numeric tables remain available.

New independent checks: all six originally added direct/analytic/trace regressions failed before repair. Nine conditioning tests now cover both reported examples at20/30 and5, every retained trace sample, genuine fast components down to2×10^-21, near-coincident rational roots, an irrational near-eigenvector and explicit nonrepresentable-coefficient failure. The irrational oracle uses Python Decimal at85digits: G=1/(s²−2), x=[1,−1.414213562373095], y(30)=45.9667975612399498165191…; this small genuine unstable component is retained. Two workspace-flow regressions check the repaired fixtures and typeset scientific output.

Final correction checks: **198 tests / 8 files pass**, **542 full tests / 25 files pass**, `npm run check` and `npm run build` pass (same existing MathLive chunk advisory); `git diff --check` passes. No unchanged large random grid was repeated; the independent review's earlier moderate-time/parser checks remain its separate evidence.

Actual production correction QA used only newly created IAB tab5 and this worktree preview8799, after again confirming this chat's `codexSessionId` and an empty inventory. At1280×720, both reported models now compute the correct cursor/state/trace endpoint without false truncation: decaying fixture20→8.756511×10^-27 and30→8.194013×10^-40; slow mode5→1.648721. Genuine perturbed initial derivatives −2.999999999999 at20, −2.99999999999999999999 at30 and .10000000000001 at5 give47077.05,228401.5 and5237078 respectively; all retain the requested trace horizon. The irrational near-eigenvector gives45.9668 at30, agreeing with the85-digit independent oracle. An exact nonzero derived coefficient below numerical range gives explicit rescaling feedback with no stale plots, rather than being trimmed to zero.

New cursor scientific output typesets correctly. At390×844 the page scroll width equals client width375, fonts report loaded and there are zero MathLive display-error nodes; long expressions/tables use their existing local horizontal scrolling. Reset returns baseline y(1)=.1997882 with two fresh fields; leave/reopen has no old result/scaffold. Console warning/error log is empty. Viewport reset and verified1280×720, owned tab closed/inventory empty and own preview stopped. No global QA/native resource held and no primary8787 access.

Correction screenshots outside Git: `C:/Users/baokh/.codex/visualizations/2026/10/29/01a186d1-f1f0-7393-88e7-377fbac7299a/cp01-modal-repair-decaying.png` and `cp01-modal-repair-mobile.png` in that directory. Core correction checkpoint `6510d51c56276ead2f34e993c0d69d0615ff5fbb` preserves implementation and tests before this final evidence record. The same PR24/branch will carry the exact clean final corrected source; independent coordinator acceptance remains pending.
