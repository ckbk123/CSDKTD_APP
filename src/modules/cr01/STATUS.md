# CR01 implementation status

- **Stage:** verified

## Independent coordinator acceptance — 0.3.12

Accepted [PR #25](https://github.com/ckbk123/CSDKTD_APP/pull/25), source `de30d8db22261fb315533a3053e099e935e0fa7d`. Independent algebra review checks 67 fixtures and 220 known roots/scalings (maximum scaled residual 2.23e-16); final spacing correction passes 36 additional rejection/positive controls. The supported degree-four rational factorization and numerical root limits remain unchanged.

Integration adds the shared TeX preflight before normalization, with nine Unicode/nested-delimiter/valid-box regressions, and two resource tests for standalone and reentrant-abort disposal. All **85 module tests / 1,261 application tests**, type checking, production build and diff checks pass. Existing actionable fraction/power-button feedback is retained.

Actual coordinator production-browser checks at desktop and 390×844 confirm baseline coefficients [26,47,27,7,1], factors (s+1)(s+2)(s²+4s+13), roots −1/−2/−2±3j, actual fraction-button entry giving the constant 1/2 with no roots, repeated ±j roots with multiplicity two, Escape→preset recovery, shell reset and navigation cleanup. The phone document is 375 pixels wide with no page overflow; the focusable root region scrolls using ArrowRight. Warning/error logs are empty. Temporary tabs were closed and viewport reset. Local proofs `release-0.3.12-desktop.png` and `release-0.3.12-phone.png` are outside Git; this supplements the worker's broader UI evidence without claiming another engine/light-theme pass.
- **Last assessed:** 2026-10-29
- **Starting revision:** `4d8064fa03de2ae62ff7b5f505fa725168b522d8` (primary main v0.3.8)
- **Worker chat:** `01a186d1-e192-7e11-a9da-294fb7ec7b78`
- **Branch:** `codex/cr01-polynomials-7e78`
- **Worktree:** `C:\Users\baokh\.codex\worktrees\cr01-polynomials-7e78\CSDKTD APP`
- **PR:** https://github.com/ckbk123/CSDKTD_APP/pull/25
- **Ownership:** `src/modules/cr01/**`; [accepted contract](TASK.md)

## Audit and bounded design

The claimed folder has metadata and a blank synchronous mount, with no local solver/tests. Current primary coordination guides and shared equation/native-number APIs were inspected. No unrelated edits were present. DR01 PR1 and DP03 PR14 remain separate submitted contributions and take priority on review return.

| Accepted requirement | Current gap / planned evidence |
|---|---|
| Expand products, recover coefficients | Exact rational polynomial arithmetic; selectable coefficient contributions and multiplication stages. |
| Factor denominator over declared domain | Bounded exact Q[s] factorization through degree four; re-expansion identity before any exact label. |
| Editable factor/coefficient/pole views | Shared visual expression input, coefficient controls, real/conjugate pole builder with declared decimal interpretation. |
| Numerical roots and multiplicity | Analytic linear/quadratic roots, bounded iterative residual-checked cubic/quartic roots; multiplicity from exact factors. Explicit nonconvergence. |
| Quadratic discriminant | Exact discriminant/sign and real versus conjugate explanation for quadratic factors. |
| Compare rational expressions | Separate numerator/denominator polynomial inputs, exact cross-product comparison and original excluded roots; no near-root cancellation. |
| Predict/reveal and changed data | Coefficient prediction, changed coefficient/pole experiments and useful errors. |
| Verification and isolation | Independent quartic expansion/roots, changed irreducible/repeated/rational fixtures; project and actual production-browser checks pending. |

The baseline is a **proposed** quartic, not a newly inspected source-deck example: (s+1)(s+2)(s²+4s+13) expands independently to [26,47,27,7,1] in ascending coefficient order, with roots −1, −2 and −2±3j. Preserve the source/proposed distinction from TASK/atlas. Original course decks were not newly opened.

Plan: real rational coefficients, degree≤4, explicit bounds on literal/expression size and primitive integer coefficient height. Exact algebra is separate from numerical root plotting/reconstruction; the rational equality comparison retains original denominator domains. The optional Bairstow display is not required and will not replace exact re-expansion or residual evidence. No shared/package/deployment dependency changes are requested.

No computation or browser verification is yet claimed. Next: exact arithmetic/parser and independent fixtures, then the full teaching interface, lifecycle checks and actual browser verification.

## Working exercise checkpoint — 21:28 local

`exact.ts` supplies bounded BigInt rational/polynomial arithmetic; `expression.ts` preserves real editor fraction, exponent and grouping semantics. `algebra.ts` uses exhaustive rational-root and primitive integer quadratic searches through degree4, verifies exact re-expansion, groups exact factors for multiplicity, and computes separately residual-checked numerical roots. Cubic/quartic nonconvergence is explicit; the interface retains valid exact algebra when numerical roots fail. Original rational-expression denominator domains are compared by exact factor sets and shown separately from common-domain equality.

`view.ts` now supplies the main visual expanded/factored expression, a coefficient prediction with contributing products, expansion stages, exact editable coefficient drafts, bounded real/conjugate root controls, quadratic discriminants, a computed root plane/table and rational comparison. Native root controls use the current shared reader. The owned MathLive field uses the public smartSuperscript=false option and signal-owned Escape cancellation already approved/tested in the earlier contributions. `workspace.ts` owns an immediate loading node and child AbortSignal, including partial-failure recovery. Metadata/shared/package files are unchanged.

Independent fixtures include the proposed baseline; nonmonic quadratic factors[2,0,5,-1,6]; the degenerate factor-search case(s²+s+2)(s²−s+2); repeated real/conjugate/zero roots; s⁴+1 with roots(±1±j)/sqrt2; s³−2 with cube-root oracles; changed constant27; exact rational scales; coefficient contributions13+8+4+2=27; and rational common-domain equality with different excluded points. The nonmonic fixture above is [2,0,5,-1,6] in ascending order, from(2s²+s+1)(3s²−2s+2).

At21:26, local module tests passed59/59, full application tests700/700 and production/type build passed under Node24.22.1 (unchanged shared MathLive chunk warning). An unnecessary rounded-root draft-copy control was removed afterward; manual pole editing and exact comparison remain, avoiding a suggestion that rounded reconstruction is exact. Final checks follow actual browser inspection. No actual CR01 browser editing/font/keyboard/phone/lifecycle behavior is yet claimed. Stage remains in-progress.

## Delivery assessment — 21:37 local, 29 October 2026

The accepted bounded CR01 exercise is implemented and checked. The audit/checkpoint sections above preserve history; their pending items are superseded here. `index.ts` stays metadata-only. There are no shared, sibling, package, global or deployment changes.

| Accepted requirement | Delivered evidence |
|---|---|
| Expand products/recover coefficients | Exact rational operations and re-expansion identity; selectable coefficient contributions and multiplication stages. Baseline s² contributions2+4+8+13=27. |
| Factor with an exact domain | Q[s] factorization through degree4, including rational linear factors and exhaustive integer quadratic pairs; primitive height/work bounds are explicit. Remaining irreducible factors are not replaced by rounded linear factors. |
| Editable factor/coefficient/pole views | Main visual expression accepts sums/products; five exact visual coefficient drafts; four bounded native real/conjugate root rows with multiplicity and leading scale. Applying roots checks exact equality with the prior expression. |
| Numerical roots/multiplicity | Analytic degree1–2 or bounded degree3–4 iteration; per-root normalized residual≤10⁻¹⁰ and complete monic-coefficient reconstruction within relative/absolute10⁻⁸. Multiplicity comes from exact factors. Root failure preserves the valid exact algebra. |
| Quadratic discriminant | Exact discriminants for the entered quadratic or quadratic factors, with negative/positive/zero explanations; actual browser checks for all three signs. |
| Rational comparison | Exact cross-products and exact original-domain factor sets, with approximate excluded-root coordinates. No near-pair cancellation. |
| Predict/reveal/change | Optional exact coefficient prediction, selected contributing power, four presets, coefficient/pole experiments and invalid-input feedback. |
| Isolation and validation | Independent math, view and lazy-lifecycle tests; actual production editing, keyboard/fonts, reset/reopen/fast navigation and phone layout evidence below. |

Final local validation after the complete-root guard: module tests60/60; `npm test -- --reporter dot`701/701; `npm run build -- --logLevel warn` passed, including `npm run check`. Node24.22.1, Vite8.3.5. The unchanged shared MathLive chunk-size warning remains. Final exact clean-HEAD checks and pushed PR submission follow this delivery record. No independent integration review is claimed; stage is implemented, not verified.

## Actual production-browser evidence

A fresh own in-app Chromium tab used only this worktree's production preview at13519. Browser inventory confirmed codexSessionId01a186d1-e192-7e11-a9da-294fb7ec7b78, matching this worker. The coordinator had independently verified per-chat IAB tab/viewport isolation and authorized parallel private QA; no foreign reservation or browser state was touched. No Firefox/native-focus controls were used.

- Baseline factors(s+1)(s+2)(s²+4s+13), ascending coefficients26,47,27,7,1, coefficient contributions2+4+8+13=27 and the entered prediction27 all matched. Roots−1,−2,−2±3j, multiplicity1 and discriminant−36 were inspected with the computed plot/table and axes.
- Changing constant26→27 gave a rationally irreducible quartic and four separately approximate roots:−2.0057341±2.9831523j,−1.8729448,−1.115587. Residuals were below5×10⁻¹⁷. Coefficient-copy/edit/apply restored26. Baseline root-row application exactly matched; changing the first root to−.01 produced exact changed coefficients and the expected−.01 root. Selecting one extra root gave the degree-four error and hidden results.
- Native1e-999 was rejected as nonzero underflow; valid−1e-2 and intentional0e-999 worked. Rational comparison(s²−1)/(s−1) versus s+1 had zero cross-product but different original domains, retaining exclusion1. Comparing1/(s+1) with1/(s+1.001) gave exact cross-difference1/1000 and separate exclusions−1 and−1.001.
- Actual fraction-button entry1/2 returned exact1/2; displayed2½ was rejected with +/× guidance. Actual power-button2^{12} returned4096,2^{−2} returned1/4, and an exponent1 followed by an outside-box2 was rejected with power-box guidance. Visual1e-2, empty input and an incomplete exponent had useful feedback with hidden results.
- The real Systems keyboard rendered. Clicking its actual s key entered P(s)=s and yielded the zero root. Escape hid the keyboard and a subsequent baseline preset remained usable. Five observed WOFF2 assets were same-origin /assets/ URLs; no console warning/error was recorded.
- The repeated conjugate preset gave±j with exact multiplicity2. The rebuilt/reloaded final code passed the changed-quartic complete-root gate, s²−2 gave discriminant8 and roots±1.4142136, and typed(s−1)² gave discriminant0 and root1 of multiplicity2. The final baseline was rechecked after a full production reload, avoiding stale imported code.
- Reset restored baseline, blank prediction and hidden output. Leaving with the keyboard open removed the old module and keyboard; reopening restored baseline. Rapid CR01→catalogue→CR01→CR02 navigation left zero CR01 roots on CR02.
- At390×844, document client/scroll widths were both375px before/after reveal and with the coefficient drafts open. The computed root plane had a283px local region and320px content; ArrowRight scrolled it37.5px. Plane labels, exact equations, tables and coefficient controls were visually inspected. No page-wide overflow. The private viewport override was reset, the owned tab closed and the owned preview stopped.

The original course decks were not newly inspected; TASK/atlas source anchors remain provenance and the quartic remains explicitly proposed. The optional Bairstow display is not implemented; exact expansion, factoring, discriminants and checked numerical roots cover the required exercise. No unresolved worker-owned requirement or shared dependency remains. Independent integration review is pending.

## Coordinator spacing-argument review return — 22:25 local

The coordinator reopened this preserved claim/PR after independently passing the unchanged60 tests/type and67 algebra fixtures with220 known roots/scale changes. The returned defect was spacing commands erased before TeX argument boundaries: raw\frac1\;2 and\frac\,12 became1/2, and2^\;2 became4 despite the pinned editor placing the spacing atom in the argument and the following digit outside.

`expression.ts` now expands fraction arguments before removing structural wrappers, retains spacing/presentation commands as tokens, and ignores them only in complete arithmetic or braced argument contexts. Unbraced spacing fraction/power arguments reject with completion/power-box guidance. Proper\frac1{\;2} and2^{\;2}, compact fractions, explicit signed/grouped expressions and ordinary powers remain checked. Numeric tokens separated by spacing are not merged, and the mixed-number guard remains active. Independent pinned MathLive MathML regressions confirm the actual outside-digit structure rather than restating the parser.74 module tests and type checking pass.

The coordinator explicitly owns the tiny reentrant late-disposer guard at integration, like DP03; no wrapper/shared/rebase edits are needed in this correction. That replaces the earlier worker self-review draft notice as its disposition. CP05 is checkpointed at65d2c9e with only a recovery plan; it remains suspended here. CS05 PR29 shares this grammar and was reported for its own coordinator return; its frozen branch has not been edited.

Stage is in-progress until focused actual editor/error/recovery evidence, full project checks and exact new-head commit/push/ready/resubmission are complete. The unchanged large independent root grid is not being repeated.

## Spacing-argument correction completed — 22:32 local

The returned parser issue is corrected within this module.74 module tests,715 full application tests, `npm run check` and `npm run build -- --logLevel warn` pass, with the unchanged shared MathLive chunk warning. `git diff --check` passes. The coordinator's unchanged67-fixture/220-root algebra grid was not repeated; only the targeted semantic regressions, normal project checks and affected actual editor/recovery checks were added.

A fresh own Chromium tab used the rebuilt/reloaded private production preview at13519, after verifying the browser inventory matched this worker chat. Clipboard paste was unavailable because its target binding failed; it was not retried blindly or replaced with hidden editor mutations. Actual MathLive command-entry keystrokes followed by Enter inserted the affected notation. Both raw\frac1\;2 and\frac\,12 displayed a spacing argument with the digit outside and received explicit complete-fraction-box feedback. A malformed spacing power (entered with a display-style prefix to commit the whole notation together) received the complete-power-box feedback; its rendered empty exponent and outside digit were inspected. The correctly boxed\frac1{\;2} returned1/2, and the correctly boxed spacing exponent2^{\;2} returned4.

After a valid result, a malformed spacing fraction hid old output. The ordinary visual fraction button recovered1/2, and the ordinary power button still entered2^{12}→4096. Reset/reveal restored the proposed quartic, exact factors(s+1)(s+2)(s²+4s+13), discriminant−36 and roots−1,−2,−2±3j. Console warning/error inventory was empty. No viewport override was changed in this focused pass; the owned tab was closed and owned preview stopped. Prior full mobile/font/keyboard/lifecycle evidence remains applicable to the unchanged view.

The coordinator explicitly owns the tiny reentrant late-disposer guard in this existing child-signal wrapper during integration; no worker wrapper/shared/rebase change is requested. This disposition supersedes the earlier self-review draft notice. The accepted bounded exercise is implemented, with that assigned integration hardening recorded transparently. Same PR25/original branch is used, and final clean exact-head submission follows this record. CP05 remains checkpointed/suspended until priority returns are resolved; CS05's inherited grammar issue remains on its separate frozen PR pending its own coordinator transition.
