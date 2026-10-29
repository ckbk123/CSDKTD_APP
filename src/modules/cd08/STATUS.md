# CD08 implementation status

- **Stage:** implemented — scoped coordinator corrections,69 module tests/type and focused production-browser checks pass; independent integration review pending. Final clean revision is recorded by the claim/PR.
- **Assessed:** 29 October 2026; contribution based on primary main `f99cfebb65495d3f4385a61dd1d25800e341ea68` (v0.3.5).
- **Ownership:** `src/modules/cd08/**`; [TASK.md](TASK.md), atlas CD08 and continuous exercise audit controller-design section.
- **Worker chat:** `01a18700-78e9-7a80-af1b-4436e25b10ff`.
- **Branch:** `codex/cd08-state-feedback-01a18700`.
- **Worktree:** `C:\Users\baokh\.codex\worktrees\cd08-state-feedback-01a18700\CSDKTD APP`.
- **PR:** https://github.com/ckbk123/CSDKTD_APP/pull/20 — same PR/branch for integration review and any returned corrections. Exact tested final revision is recorded in the claim and PR.

## Requirement-to-evidence audit

Review return,29 October2026: the coordinator independently checked core mathematics (192 placements,640 analytic traces,55,680 scalar checks;58 tests/type) and requested two localized corrections. The parser now inspects TeX fraction/exponent argument boundaries before deleting explicit spacing atoms, rejecting unbraced spacing arguments while preserving ordinary literal whitespace and braced spacing. Eleven focused regressions pass (69 module tests total). Each plot now has a keyboard-focusable local scroll region and a500px minimum SVG width, preserving14px axis labels on phones. DD07 was checkpointed separately at25624a2 before this priority return; no submitted branch was rebased/merged.

Focused correction evidence: all six unbraced fraction-spacing cases also reject inside a matrix cell; four target-spacing cases reject. Controls retain ordinary `\frac 1 2`, braced `\frac{1\,}{2}` / `\frac{\,1}{\;2}` / `\frac{1}{2\,}` and `s^{\,2}+6s+8` / literal-space exponent. Actual MathLive command entry created a spacing-only power argument with2 visibly outside the power; applying rejects it. Restoring and entering a proper square through the power button recovers K=[6,3],N8 and modes−4,−2. The clipboard paste control reported a target mismatch, so it was abandoned and its temporary test clipboard cleared; no clipboard-injection proof is claimed.

The same verified private per-chat IAB context and own preview8997 were used. At390×844, document client/scroll widths375/375; focused plot viewport285px/content500px/SVG500px, with native ArrowRight scrolling to146.5px and readable14px axis text. Four plots scroll independently and the table retains its local region. Console error/warning log empty. Local Escape capture closes the keyboard; Reset removes plots and closes all four keyboards. Override reset to1280×720; own temporary tab/preview closed. Coordinator-owned upstream Escape adaptation is separate and must be rechecked on integration; this preserved branch was not merged/rebased to acquire it.

Correction screenshots outside Git: `C:\Users\baokh\.codex\visualizations\2026\10\29\01a18700-78e9-7a80-af1b-4436e25b10ff\cd08-spacing-rejection.jpg` and `C:\Users\baokh\.codex\visualizations\2026\10\29\01a18700-78e9-7a80-af1b-4436e25b10ff\cd08-phone-rework.jpg`. Final delivery uses69 module/413 combined tests, `npm run check`, `npm run build` (existing MathLive chunk warning) and clean diff/HEAD checks; the claim and PR name that exact tested revision. No solver change or repeated large-grid claim is included in this correction.

| Accepted requirement | Implemented evidence |
|---|---|
| Editable small SISO model and target poles | Four shared visual inputs for A,B,C and real target polynomial; bounded `parser.ts`. Actual A, B and signed-fraction C edits verified in browser. Native initial states/reference/horizon use shared `readNumericInput`. |
| Column-by-column controllability | B then AB/full controllability matrix; independently normalized column determinant and declared numerical rank threshold. Rank-deficient/near-deficient fixtures and actual zero-B browser failure. |
| Coefficient matching and K | Trace/determinant matching equations, substituted 2×2 solve, K and full A−BK. Actual characteristic coefficients and both eigenvalues are checked, including repeated/conjugate modes. |
| Reference correction | Derives DC gain and N; compares baseline N=8 against N=1 final output gain1/8. Zero/poor DC channel or excessive required gain retains feedback with explicit supported-prefilter feedback. |
| States/output/control effort | Four computed SVG plots for the same original model/history with N=1 and calculated N. Native time inspection, markers and sample table; zero-DC case has only N=1. Coarse sampling warning; no endpoint-settling claim. |
| Attempt/reveal/changed data | Gain/no-supported-prefilter predictions, checked reveal/hide, changed real/conjugate targets and velocity output. Edits invalidate stale results; focus and attempt values survive derivation/time rerenders. |
| Lifecycle/isolation | Metadata unchanged; synchronous lazy wrapper has owned loading host and child abort signal. Abort/dispose/partial failure release resources and show recovery feedback. Reset/reopen/rapid navigation verified in browser; late/disposed imports and partial window-listener failures covered by tests. |
| Keyboard/fonts/narrow layout | Actual matrix-cell selection, signed fraction button, power button and ordinary target keys; Systems keyboard entry, Escape and Reset. Local Escape capture preserves visual math mode. Fonts loaded. At390×844, equations and table scroll locally; page client/scroll widths both375. |

## Supported domain, conventions and bounds

Real continuous two-state SISO: A2×2, B2×1, C1×2, D=0, x column, u=−Kx+Nr. Both states are assumed available for feedback; C selects the output and does not provide an observer. Time is in seconds; other units belong to the supplied model. Both comparisons use the same initial state and held constant reference. No discrete sample period is inferred.

Matrix entries accept finite decimal literals, unary signs, numeric fractions including signed/nested/compact TeX forms and unambiguous numeric wrappers. General cell arithmetic is unsupported. Matrix row separators remain intact when MathLive adds serialization whitespace. Target q(s) accepts a real monic quadratic in expanded/factored form with visible polynomial arithmetic, numeric fractions, constant division and squares. Its two coefficients must be strictly positive (strict Hurwitz condition). Repeated and conjugate poles are supported through the real polynomial. e/E visual symbols, hidden algebraic grouping, ambiguous mixed-number adjacency and ambiguous unbraced exponents are rejected. Native number controls accept ordinary exponents and intentional zero, while rejecting nonzero browser underflow.

Bounds: equations≤600 characters, target≤120 tokens/nesting12, scalar nesting8, literal decimals≤12 fractional places/8 integer digits; matrix entries≤1000, target coefficients≤10000. Controllability normalizes each column independently, determinant threshold10⁻⁹. Matching independently normalizes each equation row at the same threshold. Gain≤10⁶ and closed-matrix entries≤10⁴. Each actual characteristic coefficient must match its strictly positive target with relative error≤10⁻⁹; there is no absolute tolerance floor concealing tiny-coefficient errors. Actual coefficients must remain strictly Hurwitz.

The prefilter requires |DC gain|>10⁻¹⁰||C||||(A−BK)⁻¹B|| and |N|≤10⁶. Otherwise K remains available with an explanation. A mathematically existing N outside the gain bound is distinguished from zero DC gain. The full two-state realization is retained even when C hides a mode. Prediction checks use relative tolerance10⁻⁷ for nonzero gains, exact equality for zero.

Responses use a numerical augmented3×3 matrix exponential for held input, avoiding subtraction of huge equilibrium terms or division by slow poles. Scaling≤30, Taylor≤24 terms at reduced norm≤.5, term tolerance10⁻¹⁶. Horizon.1–50s; pure API samples2–1001, UI401; |initial/reference|≤100, finite response magnitude≤10⁸. Coarse modal resolution receives a warning. Curves are sampled approximations; DC results concern the stable infinite-time limit. Equations/table use about seven significant digits and retain tiny nonzero values. Axis ticks use three significant digits or compact exponent notation; wider gutters prevent clipping. The sample table has a keyboard-focusable local horizontal scroll area.

## Independent mathematical evidence

Original decks were not reinspected. Source anchors remain TASK/atlas and the continuous exercise audit; these are independent mathematical fixtures, not claimed new slide inspections.

- Baseline A=[[0,1],[−2,−3]], B=[0,1], C=[1,0], targets−2,−4: K=[6,3], N8, closed A=[[0,1],[−8,−6]], raw DC gain1/8. Corrected y=1−2e^(−2t)+e^(−4t), x₂=4e^(−2t)−4e^(−4t), u=2+6e^(−4t).
- Changed targets−1,−5: K=[3,3], N5, y=1−(5/4)e^(−t)+(1/4)e^(−5t). Repeated−3: y=1−(1+3t)e^(−3t). Conjugate−2±3j: y=1−e^(−2t)(cos3t+(2/3)sin3t).
- Independent free response, nonzero initial state and coordinate transformation S=diag(2,3) preserve y/u and transform x/K consistently. Velocity output C=[0,1] retains K but has zero static DC tracking gain.
- Noncanonical unstable A=[[1,2],[3,4]], B=[1,−1], C=[1,2], q=s²+4s+5: matching k₁−k₂=9 and6k₁−4k₂=−7 gives K=[−21.5,−30.5], N2.5. Independent steady x=[−3,2], u=−1 satisfies Ax+Bu=0, Cx=1.
- C=[10⁻⁸,0] gives DC1.25×10⁻⁹ and mathematically N8×10⁸, outside supported10⁶. Feedback remains valid; this is separate from zero DC.
- A tiny-gain double integrator preserves K,N≈10⁻¹⁴ and forced output≈5×10⁻¹⁷ at t=.1 without equilibrium cancellation. Zero predictions fail for these nonzero gains.
- A=diag(10⁻⁶,−2), B=[3,1], desired constant10⁻³⁰ formerly produced actual≈5.05783×10⁻²² under an absolute tolerance floor. The floor was removed; the regression requires explicit accuracy rejection. Small magnitude alone is supported.

## Actual production-browser verification

ChatGPT in-app browser, own tab2/private preview8997. The browser control does not expose its engine version; none is inferred. Actual checks:

- Cold load shows the exercise without scaffold/loading residue. Baseline rank determinant−.3162278, K=[6,3], N8, actual poles−4,−2 and correct gain prediction. At t5: raw y=.1249887, corrected y=.9999092. At t1: corrected y=.7476451, x₂=.4680786, u=2.109894; table and plot markers agree.
- Real target variation K=[3,3],N5; conjugate actual poles−2±3j,N13. Velocity output shows DC0, valid full feedback and a single N1 table row.
- Actual C first-entry keyboard selection and fraction-button entry C=[−1/2,0] gives DC−.0625,N−16. Ordinary s/power-button2/+4s+13 gives actual−2±3j,N13. Actual A(1,2)=2 gives K=[2,3],N4. Actual B=[0;0] now gives rank-loss feedback after the serialization repair.
- Empty target and ordinary-key1e−2 show useful feedback with results hidden. Native1e−999 rejects underflow;0e−999 yields zero response;1e−2 gives initial effort.01/.08. Horizon0 rejects.
- Systems keyboard opens and its s key invalidates prior results. Escape closes it while retaining visual math mode; Restore then succeeds. With x₁(0)=1,r0, both initial rows show x₁=y=1,u=−6. Reset restores zero initial state,r1,horizon5, blank attempts, hidden results and closed keyboard.
- Leave for CD09 while keyboard is open: no old feedback DOM or math fields remain. Rapid sequential CD08/CD09 transitions leave no late old exercise; reopening is fresh and returns baseline N8. Unit tests separately exercise unresolved/disposed imports and partial mount failure.
- Keyboard Enter on reveal/time actions retains focus after rerender. Native time inspector works at390×844. Equations scroll locally, table scrolls horizontally by arrow key (observed scrollLeft74.5), page client/scroll widths remain375/375. Negative axis ticks remain visible after gutter repair. Viewport restored to1280×720. Own tab closed. Final console warning/error log is empty; fonts loaded and KaTeX_Main available. System dark appearance inspected; light appearance was not separately emulated.

Local proof (outside Git):
- `C:\Users\baokh\.codex\visualizations\2026\10\29\01a18700-78e9-7a80-af1b-4436e25b10ff\cd08-browser.jpg`
- `C:\Users\baokh\.codex\visualizations\2026\10\29\01a18700-78e9-7a80-af1b-4436e25b10ff\cd08-narrow.jpg`

## Project checks and delivery

Bundled Node24.22.1 with compatible npm CLI/PATH; locked dependencies installed with `npm ci` (109 packages,0 vulnerabilities). Final implementation checks in this isolated baseline branch:

- `npm run check` — pass.
- `node node_modules/vitest/vitest.mjs run src/modules/cd08` — 58 tests in3 files pass (49 math/parser,5 UI,4 loader).
- `npm test` — 402 tests in20 files pass.
- `npm run build` — pass, including type check; existing MathLive large-chunk warning only.
- `git diff --check` — pass.

These checks are rerun at the final committed HEAD before exact claim submission. Current-main integration, independent technical review and any release version remain coordinator-owned. No package, dependency, shared helper, shell, routing or deployment changes are included. No required exercise work or shared API request remains open.

## Coordination history and limits

Early real-browser acquisition was delayed by the shared global queue, and checkpoint35053ca was preserved as an honest blocked partial handoff. The human resumed the same worktree/claim/PR. An authorized Firefox159.0 launch was followed by a tool refusal before page inspection because Windows Firefox URL-policy enforcement is unsupported. No Firefox evidence or further native inputs are claimed; the returned window was left intact.

CD08 later acquired the supported IAB reservation after DP03 released. In a coordinator-requested controlled probe, inventories were disjoint: CD08 session01a18700-78e9-7a80-af1b-4436e25b10ff saw only its own8997 tab, not the coordinator's8787 user tab. CD08 stayed1280×720 (client1265×720) while only the coordinator changed to613×817. The coordinator restored its probe and authorized parallel QA in verified private contexts. CD08 released its obsolete global reservation and completed only its own tests. Primary8787 and other chats' tabs were preserved.
