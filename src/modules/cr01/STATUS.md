# CR01 implementation status

- **Stage:** in-progress
- **Last assessed:** 2026-10-29
- **Starting revision:** `4d8064fa03de2ae62ff7b5f505fa725168b522d8` (primary main v0.3.8)
- **Worker chat:** `01a186d1-e192-7e11-a9da-294fb7ec7b78`
- **Branch:** `codex/cr01-polynomials-7e78`
- **Worktree:** `C:\Users\baokh\.codex\worktrees\cr01-polynomials-7e78\CSDKTD APP`
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
