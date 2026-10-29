# CS05 implementation status

- **Stage:** in-progress
- **Last assessed:** 2026-10-29
- **Starting revision:** `9d923d2f9a3728bdfd6516dd68aa06c93d9e7f86` (primary main v0.3.9)
- **Worker chat:** `01a186d1-e192-7e11-a9da-294fb7ec7b78`
- **Branch:** `codex/cs05-stable-gains-7e78`
- **Worktree:** `C:\Users\baokh\.codex\worktrees\cs05-stable-gains-7e78\CSDKTD APP`
- **Ownership:** `src/modules/cs05/**`; [accepted contract](TASK.md)

## Claim audit and bounded implementation plan

Current primary guides, TASK/STATUS/index/workspace, atlas CS05 and the continuous source audit were inspected. This folder has only a blank mount and metadata; no solver/tests exist. No unrelated edits were present. CR01 PR25 is submitted separately at d70a371; DR01 PR1 and DP03 PR14 are frozen after final coordinator reviews. Review returns take priority after checkpointing this new module.

| Accepted requirement | Planned implementation/evidence |
|---|---|
| All stable K intervals | Exact rational Hurwitz inequalities for strictly proper real rational N(s)/D(s), denominator degree1–3, K≥0 and negative unity feedback. Solve every linear/quadratic inequality; return a set, including disjoint intervals/unbounded tails and exact endpoints. |
| Boundary derivation | Display D+KN and Routh/Hurwitz conditions; preserve algebraic boundaries exactly, show s=jω relation and zero-root boundaries where applicable. |
| Full roots and locus | Independently checked numerical roots of the complete characteristic polynomial; sampled branches matched between adjacent gain points, with gain range explicit. No single branch determines the verdict. |
| Interval strip and student attempt | Exact interval answer alongside selected gain, all root coordinates, predictions and changed N/D/gain experiments. |
| Validation/isolation | Bounded local visual parser, shared native-number reader, exact algebra separate from numerical/root-locus limits; guarded synchronous workspace and actual browser tests. |

The supported baseline gives D=s³+7s²+10s, N=1, first Routh column1,7,(70−K)/7,K and strict interval0<K<70. AtK=70, D+KN=(s+7)(s²+10); K=0 retains a zero root. This matches CS03's accepted contract and the recorded continuous source audit. The changed cubic s³+6s²+8s gives0<K<48. These independent identities will be test fixtures; no sibling implementation/import is used. Original source decks were not newly opened.

Bounded design: degree1–3 denominator with lower-degree numerator, exact rational coefficients and K≥0. Keep all poles/modes in D+KN without automatic cancellation. For a monic cubic, require a₂>0,a₁>0,a₀>0,a₂a₁−a₀>0; this creates only one quadratic gain inequality, so rational/surd endpoint comparisons can be exact. Boundary sorting and interval sign tests must not depend on rounded roots or a gain sweep. Near-coincident boundaries, arithmetic/work bounds and numerical failures need explicit feedback. The UI's finite locus range is separate from the complete symbolic gain domain.

No computation or CS05 browser verification is yet claimed. Next: exact gain-region core and independent fixtures, then the complete teaching interface and production-browser checks. No shared/package/deployment changes requested. Private per-chat IAB isolation was established and the current guides permit parallel testing after confirming this chat's inventory identity.

## Exact gain-region core checkpoint — 21:50 local

Module-local exact arithmetic/parser were adapted from this worker's previously submitted polynomial parser, without any sibling import or unrelated source change. This contribution raises its declared rational arithmetic bound to60 digits for exact surd sign tests and bounded interval bisection. `gains.ts` derives the complete rational Routh/Hurwitz conditions for monic degree1–3 characteristic polynomials and solves their nonnegative gain domain exactly. Only the cubic determinant is quadratic, so all irrational cuts share its discriminant. Cut ordering, equality and condition signs use rational arithmetic and squared comparisons, never rounded endpoint numbers. Every interval is tested at an exactly interior rational point; zero inclusion and unbounded tails are retained. Failure to separate cuts within64 bisections or other declared work bounds gives explicit feedback.

Independent fixtures now pass29/29 module tests with type checking. They cover0<K<70 and0<K<48; exact boundary−7,±j sqrt10; included zero/unbounded/no stable regions; negative-leading normalization; two disjoint rational ranges(1/3,1) and(3,infinity); and irrational ranges(1/6,2−sqrt2) and(2+sqrt2,infinity). Exact boundary selections are non-strict independently of their numeric approximation. Analytic numeric roots have per-root residual and complete reconstructed-coefficient checks; the baseline zero root is deflated exactly to avoid a misleading componentwise relative error at the origin. Minimum-displacement matching compares every permutation of the full root list.

The interface and lifecycle are not yet implemented. No CS05 production-browser, full-project or build verification is claimed. Remaining work: expose editable N/D and gain/predictions, exact inequality and interval reasoning, all selected roots, boundary controls retaining algebraic identity, interval strip, sampled matched locus with finite range/limits; then meaningful view/lifecycle tests, complete checks and actual private-browser evidence, one PR and exact clean submission. Stage remains in-progress.

## Teaching interface checkpoint — 21:56 local

The local view now exposes editable visual N/D/K, exact inequality/interval derivation, gain predictions, exact algebraic endpoint buttons, full selected root list and cubic imaginary-axis equations, a clipped gain strip and sampled locus with full-list matching. It distinguishes manual rational gain from computed exact square-root selections, and retains exact classification when boundary root coordinates round. Native plot bounds use the shared number reader. The guarded lazy workspace now covers abort-during-mount late disposers and cleanup exceptions as well as partial-mount failure. The same edge was noticed in frozen CR01 and stated to the coordinator for an authorized return; no frozen branch was edited.

Type checks and34 local math/lifecycle tests pass. Exercise wiring tests, broader project checks/build and actual CS05 browser QA remain open. No full-tool completion or submission is claimed. Next: verify changed gain/model, repeated boundary reveal, malformed/native-underflow inputs and visit state in wiring tests; then full production checks/browser inspection and final PR/submission.
