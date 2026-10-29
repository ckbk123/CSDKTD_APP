# DS04 implementation status

- **Stage:** verified
- **Last assessed:** 2026-10-29
- **Worker chat:** `01a186d2-2175-7122-ad9f-c01694059c6c`
- **Owned folder:** `src/modules/ds04/**`; [TASK](TASK.md)
- **Branch:** `codex/ds04-gain-regions-2175`
- **Worktree:** `C:/Users/baokh/.codex/worktrees/ds04-gain-regions-2175/CSDKTD APP`
- **Starting primary main:** `ae7daf3477c322d980418ec094b35585e43e109c`
- **Independent final review:** pending coordinator review of the submitted SHA; this worker does not claim `verified` status.

## Accepted requirements and evidence

| Requirement | Delivered behavior / evidence |
|---|---|
| Editable loop and feedback characteristic | Shared visual N(z) and D(z) inputs; explicit negative unity feedback; P=D+KN; numeric K/window; bounded independently tested parser |
| All real and complex circle crossings | Exact zeros of P(+1), P(-1), a-c; genuine conjugate crossings verified by cosine condition; angles in rad/degrees; non-crossing equalities distinguished |
| Complete stable gain set, including disconnected components | Exact rational critical-gain ordering and sign partition; every open cell checked; all intervals displayed; no sweep is used as proof |
| Singular/fixed-boundary cases | a=0 identified as ill-posed algebraic feedback; finite roots plus roots at infinity retained; identically-zero characteristic and fixed circle-mode identities explained |
| Locus and gain-interval bar | Own stateless `plots.ts` functions draw both sampled root paths, current-root crosses, in-window crossing circles and stable segments; complete numeric root list accompanies truncated views |
| Boundary equations and Jury/Routh checks | Each critical gain has its equation, exact fraction/decimal, crossing type, full root set and inspect button; normalized quadratic Jury inequalities and transformed Routh first column agree |
| Student attempt/reveal/changed data | Predict zero/one/two stable intervals, reveal derivation and checked set; complex-crossing and disconnected-set experiments; normal equation edits and keyboard/numeric controls |
| Mathematical validation | 32 local parser/math tests cover independent baseline/changed/disconnected fixtures, root residuals, conditioning, all-real/empty/fixed cases, degree loss and invalid/resource-limited input |
| Visit isolation and accessibility | Guarded synchronous mount, caller-owned drafts/state, signal-driven listeners, input disposal; 8 workspace/lifecycle tests and actual browser reset/reopen/rapid-navigation/keyboard checks |
| Responsive integration | Scoped CSS, bounded equation/table scrolling, readable root/interval graphics; actual 375px content-width phone check without page-wide overflow; project checks pass |

## Supported domain and limits

- Real proper or biproper N(z)/D(z), degree N<=2 and monic quadratic D. Coefficients are stored in ascending order internally; visual fields accept expanded/factored polynomials, optional N(z)=/D(z)= prefixes, sums/products/parentheses, powers 0/1/2 and fractions of signed numeric literals. Compact/mixed-brace fraction arguments preserve TeX's one-token rule; outer minus/grouping preserves meaning. Nested fraction notation, other variables/functions and e/E scientific-literal interpretation are explicitly unsupported. Students use ordinary decimals or numeric fractions instead.
- Each polynomial: <=300 characters, <=160 tokens, <=12 nested groups; <=6 decimal places and 9 digits per numeric literal. Final nonzero coefficient magnitudes: 1e-8..100. Reduced fraction numerator/denominator magnitudes <=10^12; exact-arithmetic intermediates capped at 2048 bits with controlled precision feedback.
- K is real with negative unity feedback, P(z,K)=D(z)+KN(z). Selected K and locus-window endpoints are finite in [-100,100], with minimum<maximum. HTML numeric controls retain their separate exponent grammar. Their browser Number is interpreted through its decimal serialization for exact coefficient arithmetic. The complete symbolic/rational result covers all real gains, beyond the plotted window.
- z and K are dimensionless; no sample period, physical frequency, initial-history simulation or additional feedback topology is inferred. No cancellation is performed: the entered uncancelled characteristic roots are retained, including common factors and K=0 modes. A claim about a unique hidden physical realization is not made from a TF alone.
- Exact gain partition: a, P(+1), P(-1), a-c are affine. Their signs are fixed between consecutive exact rational zeros. Strict stability requires a!=0 and the other three signs equal to sign(a). This permits negative leading coefficients and disconnected sets. At a=0, the biproper feedback interconnection is algebraically singular and is excluded even if its reduced polynomial has stable finite roots.
- Root coordinates are numerical, using a cancellation-resistant quadratic formula with the discriminant formed exactly before conversion. Radius tolerance is 1e-8; relative near-leading-zero warning is 1e-10. Tiny crossing angles use exact half-angle quantities rather than a rounded acos argument. Decimal results use up to eight significant digits; interval endpoints remain exact fractions. No iterative convergence claim is involved.
- The locus uses 401 samples (helper bounded to 3..1001), nearest-pair branch continuation and breaks at/across a=0. It is an illustration, not the stability proof. Its view follows selected roots, capped at extent 10; clipped samples/current roots are disclosed and all current roots remain listed numerically. Crossing markers are restricted to the sampled gain window; global crossing equations remain listed separately.

## Independent fixtures and provenance

Original course slides were not inspected in this run. Recorded course/audit anchors retain their existing provenance; no new transcription claim is made. The disconnected biproper example is an independently derived proposed variation.

- Baseline N=z+1/5, D=z(z-1): P=z²+(K-1)z+K/5. P(+1)=6K/5, P(-1)=2-4K/5, a-c=1-K/5 yield **0<K<5/2**. At K=0 roots are +1 and 0; at K=5/2 roots are -1 and -1/2. K=5 is an a=c candidate with real roots, not a complex circle crossing.
- N=z+1/2, same D: strict set **0<K<2**; at K=2 the roots are -1/2±sqrt(3)j/2, theta=±120 degrees. The .1 variation independently gives upper endpoint 20/9.
- N=-z²+z/2, D=z²: roots are 0 and -K/[2(1-K)]. Their strict-disk set is **K<2/3 or K>2**. K=1 is singular feedback, not an ordinary stable first-order system.
- Negative N=-1/2, D=z(z-1): **-2<K<0**. Actual fraction-button entry with an outer minus reproduced this result in the browser.
- Changed-family root residuals and exact sign partitions are compared independently; fixed unit roots use a justified 1e-10 margin in floating residual checks. Conditioning fixtures preserve `(z-1)(z-(1-1e-8))` modes and a roughly 1e-8-radian conjugate crossing at a far critical gain.

## Verification

Run in this worktree with bundled Node **24.22.1** and the installed npm CLI, avoiding the system Node 20 wrapper:

- `npm test -- src/modules/ds04`: **40/40 passed** (32 math/parser, 8 workspace/lifecycle).
- `npm run check`: **passed**.
- `npm test`: **82/82 passed across 8 files** on this contribution's recorded primary baseline.
- `npm run build`: **passed**; existing MathLive large-chunk warning remains. No dependency/configuration change.
- `git diff --check`: **passed**.

Actual production browser checks used an exclusive DS04 reservation, own in-app Chromium tab and preview **8824**, system dark preference. Default content width 1265px; phone override 390x844 produced content width 375px.

- Baseline prediction and 0<K<5/2; every displayed root; critical gains/types; complex preset with theta=±120 degrees; disconnected union with two components; K=1 singular root at infinity.
- Ordinary keys plus visual fraction/power buttons entered N=z+1/2 and D=z²-z and produced 0<K<2. An outer-minus fraction entered as -1/2 produced -2<K<0. Compact fraction output was accepted. Typed `z+1e-2` remained a displayed algebraic expression and was rejected rather than read as 0.01.
- Empty/incomplete polynomials, empty numeric K and reversed plotting window showed distinct useful feedback and cleared stale graphs. Numeric input then recovered the computed view.
- Systems keyboard rendered, inserted a z key, closed on Escape; opening it from the second equation and resetting dismissed it and restored both fields, K=1, plot window and unrevealed result. Tab from the complete D field reached its fraction button; Enter activated checking without shell navigation.
- Reset and leave/reopen restored the actual baseline. Rapid DS04->CR01->DS04->CR01 navigation with the keyboard open left **zero DS04 containers and zero math fields** on CR01 and no stale keyboard.
- Full phone result view measured **scrollWidth=clientWidth=375**. Tables/equations scroll internally; both root/interval graphics and numeric controls remain available. Default desktop measured **scrollWidth=clientWidth=1265**. Equations, signed fractions/powers and local math fonts rendered visibly. Browser error/warning log was empty.
- Final rebuilt production page was reloaded and baseline/disconnected results rechecked. Temporary viewport was reset, tab closed, QA released and this worker's preview stopped. Port8787 was untouched. Light preference and other engines were not separately exercised.

Local evidence artifacts (not committed):

- `C:/Users/baokh/.codex/visualizations/2026/10/29/01a186d2-2175-7122-ad9f-c01694059c6c/ds04-browser.png`
- `C:/Users/baokh/.codex/visualizations/2026/10/29/01a186d2-2175-7122-ad9f-c01694059c6c/ds04-phone.png`

## Delivery / remaining work

No accepted bounded-exercise requirement remains open. Higher-order or non-rational coefficient families remain outside this declared tool. Final independent review/integration belongs to the coordinator. Only this module's folder changed. The branch and exact tested submission will be preserved for review; no version bump, merge or deployment is performed here. Pull request: [DS04 #13](https://github.com/ckbk123/CSDKTD_APP/pull/13), base main, attached to the worker chat. The claim records the final exact tested SHA including this delivery record. The connector lacks PR-write access (403 observed for the prior contribution), so the existing authenticated Git credential created this PR through the GitHub API; no new credential was provisioned. The continuous worker goal proceeds to another eligible module after submission and prioritizes any coordinator rework.

## Coordinator review return: exact singular selection

At the submitted revision the root list used exact K=10/3 for N=-3z²/10,D=z², but the locus recomputed rounded K=3.3333333333333335 and drew two spurious current roots at zero. The plot now accepts the same exact rational selection as the list; only window/sweep sampling stays numeric. A workspace regression checks no current-root crosses at the exact identically-zero characteristic and restores two crosses at K=3. Original source SHA and review evidence remain preserved in PR #13.

Correction checks: npm test -- src/modules/ds04 passes 41/41 (32 math,9 workspace); npm run check passes; npm test passes 83/83 across8files; npm run build passes (existing MathLive chunk warning only); git diff --check passes. The targeted production-browser recheck is pending while DS01 finishes and the coordinator takes its explicitly reserved next slot. Earlier full browser evidence above still applies to the otherwise unchanged module. This is a recoverable review checkpoint, not a resubmission yet.


The review pass also reproduced native numeric underflow (nonzero raw 1e-999 became Number zero) in this branch's own controls. A local input guard now routes that case to existing visible numeric feedback, with a workspace regression; intentional zero and ordinary finite exponent values remain valid. This old-baseline branch does not import an unmerged shared helper. The production build and41modulechecks pass after this guard. Coordinator QA has resumed normal availability; DP02 currently holds it, so DS04 is waiting through an event-driven helper request without altering another reservation.


### Correction browser evidence and resubmission

The targeted corrected production build passed actual Chromium checks under the DS04 reservation on preview8824. Ordinary keys and power buttons entered N=-.3z²,D=z². Exact Inspect K=10/3 displayed an identically-zero polynomial with undetermined roots and ZERO current-root crosses in the locus; nearby native K=3 restored TWO current crosses. Native1e-999 showed visible finite-K feedback and removed stale plots, while intentional0 and ordinary1e-7 computed normally. Reset/reveal restored0<K<5/2 and both baseline roots. Browser error/warning log was empty. No viewport override was introduced; the own tab was closed and QA released. Screenshot: C:/Users/baokh/.codex/visualizations/2026/10/29/01a186d2-2175-7122-ad9f-c01694059c6c/ds04-singular-correction.png (not tracked).

The same PR#13 will receive the exact corrected final SHA and retain original review history. The coordinator explicitly approved an equivalent local numeric guard for branches predating the shared helper, to be adapted at integration; this branch is preserved without rebase or unowned shared-file edits. The final correction tree contains41module/83full tests; final type/full-suite/build checks are rerun after this evidence-only commit. No returned defect remains open; independent final review/integration is pending.

## Second coordinator return: mixed-number displayed meaning

The exact-gain correction at6be898d passed coordinator review, but a new displayed-meaning probe found2\frac12z+1 rendered as the mixed coefficient2+1/2 while the normalized parser multiplied2*(1/2). Signed and parenthesized/nested mixed forms had the same risk. CS03 was checkpointed at7467873 and its pending QA watcher explicitly stopped before returning here. The same PR#13 and original source history are preserved.

Before fraction normalization the module now inspects the existing pinned MathLive public MathML conversion for its invisible-plus marker (U+2064). A mixed number is rejected with “Insert + or × between the whole number and fraction.” This notation-only guard uses the renderer's actual mixed-number decision through signs/groups rather than flattening them or treating every adjacent fraction as ambiguous. It does not compute any coefficients, roots or gain sets; the separately bounded polynomial parser and exact rational math still perform all calculation. No dependency/shared file/API change was introduced. Explicit(2+1/2)z+1 computes coefficient5/2; explicit2×(1/2)z+1 computes1. Clear parenthesized products, brace-grouped products, adjacent ordinary fractions and outer signed ratios retain their previous meaning. Numeric literals and mixed content remain subject to the preexisting300-character limit.

The pinned Node renderer probe confirmed invisible plus for direct, signed, grouped and nested mixed forms; it is diagnostic source evidence, not interactive browser evidence. Seven mixed-form rejection fixtures and explicit+/×/grouped-product coefficient oracles were added, plus a workspace stale-graph/recovery regression. npm test -- src/modules/ds04 passes50/50 (40math/parser,10workspace); npm run check passes. Stage is in-progress until targeted real fraction-button adjacency and corrected final checks/submission complete. Current QA order is CR02→CP03→coordinator; no new acquisition is attempted during that order, and this worker holds no reservation.

### Final preflight policy refinement

The renderer-only prototype above was insufficient: thin spaces and invisible brace groups can visually suggest mixed notation without MathML's invisible-plus marker. The final implementation has NO MathLive dependency in math.ts. Its bounded lexical preflight treats each supported numeric fraction and power as an opaque token before checking numeric/fraction adjacency. It preserves TeX one-token fraction arguments and does not mistake a fraction denominator or power exponent for a preceding whole number. Thin spaces are checked consistently; direct/signed/grouped/nested adjacency is rejected with +/× guidance. Ordinary grouping must use VISIBLE parentheses; leftover invisible TeX brace groups are rejected instead of being silently changed into mathematical parentheses. Numeric fraction/power argument braces remain fully supported. This also rejects cases such as2{-1/2} whose invisible group could conceal multiplication/subtraction differences. Explicit+/× and visible parenthesized products, consecutive fractions and powers followed by fractions retain correct independently tested coefficients.

This supersedes the historical MathML runtime-guard description and its brace-product statement. The pinned Node MathML probes remain diagnostic evidence only.57/57module tests (47math/parser,10workspace) and type checks pass. The coordinator has completed/released the ordered slot; normal supported QA acquisition is allowed again. Final production browser and clean exact-HEAD submission are still pending.

The native-input regression now explicitly covers current-primary guidance for intentional0e-999 (K remains0), representable1e-2 (K remains0.01), and nonzero1e-999 (error/stale-plot removal).57/57module tests pass. This test-only checkpoint leaves the browser implementation unchanged; QA remains deferred for DP03→DP04→coordinatorDP02, with no watcher/reservation active.


### Final mixed-number correction browser evidence

Actual production Chromium on this worker's preview8824 passed under a DS04 reservation. Ordinary keys plus the real fraction button built `2\frac12z+1`; UI Copy confirmed that canonical serialization, and the tool showed the specific +/× guidance. The actual parentheses button and an outside minus produced `-\left(2\frac12\right)z+1`, also correctly rejected. No computed graph remained for invalid input. Explicit `(2+1/2)z+1` built with the fraction button computed numerator coefficient5/2; at K=.5 its roots were -.125+/- .69597055j. The Systems keyboard × key plus a completed button-entered fraction produced `2\times\frac12z+1`, coefficient1; the same K=.5 gave .25+/- .66143783j. These differing coefficient/root oracles verify meaning, rather than relying on the coincident0<K<1 interval. Signed simple -1/2 remained accepted and gave -2<K<0. Incomplete fraction boxes displayed separate completion feedback.

Native nonzero1e-999 showed finite-K feedback and ZERO SVG plots inside the computed-result region (equation toolbars have unrelated SVG icons). Intentional0e-999 selected K=0, and native1e-2 selected K=.01 normally. Reset/reveal restored0<K<5/2. Math fractions/parentheses/fonts and the Systems keyboard rendered visibly; Escape closed the keyboard. Phone390x844 measured scrollWidth=clientWidth=375 with the full baseline result, including the updated grammar note. The focused proof screenshot used1280x1000 to show the entered mixed expression and its feedback together. Browser error/warning log was empty. Viewport override was reset, own tab closed, QA released, and preview1042 stopped; primary8787 was untouched.

Evidence artifact (outside Git): C:/Users/baokh/.codex/visualizations/2026/10/29/01a186d2-2175-7122-ad9f-c01694059c6c/ds04-mixed-fraction.png. This focused browser pass supplements the original full reset/reopen/rapid-navigation/keyboard/phone evidence and the exact-singular selection pass above. No accepted bounded requirement or returned defect remains open; final independent review/integration is still the coordinator's responsibility. The implemented policy is the PURE lexical/visible-parentheses preflight above, not the earlier historical renderer prototype. The same PR#13 is retained. Final submission will record this clean HEAD after re-running57owned/99full tests, type/build and diff checks; source code is unchanged by this evidence-only commit.

## Combined coordinator acceptance — 0.3.13

Accepted source `a0d37046499fd44a5bbc5a96244d39301486a315`, [PR #13](https://github.com/ckbk123/CSDKTD_APP/pull/13), with its independent mathematical/source review and returned-correction evidence retained. Coordinator preparation applies the recorded shared native-number/TeX-argument and owned-lifecycle adaptations with focused regressions. All 2,605 combined application tests, type checking and production build pass.

Actual production-browser smoke checks exercised this tool's default reveal and navigation at desktop and 390×844. Phone client/scroll widths were 375/375; no alert or warning/error log was observed. This supplements separately attributed worker changed-data, actual input/font/keyboard and detailed lifecycle evidence. It is not a new exhaustive mathematical or all-browser certificate. See docs/INTEGRATION_BATCHES.md for targeted checks and the complete batch.
