# CS02 implementation status

- **Stage:** in-progress
- **Last assessed:** 2026-10-29
- **Worker chat:** `01a186d2-2175-7122-ad9f-c01694059c6c`
- **Contract / ownership:** [TASK.md](TASK.md), `src/modules/cs02/**` only
- **Branch:** `codex/cs02-routh-2175`
- **Worktree:** `C:/Users/baokh/.codex/worktrees/cs02-routh-2175/CSDKTD APP`
- **Starting main:** `9d923d2f9a3728bdfd6516dd68aa06c93d9e7f86` (v0.3.9)

## Initial requirement audit

Current source inspection confirms metadata plus an empty synchronous mount and no module tests. No working module feature is being replaced. CF01 was reserved by another worker before this worker's claim; the failed specific claim did not mean the queue was empty. CS02 was then atomically reserved and its fresh managed worktree/unique branch recorded. Earlier DS04 PR#13 and CS03 PR#26 remain submitted/frozen for asynchronous coordinator review.

Current primary AGENTS, START_HERE, AUTONOMOUS_WORKERS and COORDINATION were rechecked. Current contributing/development/design conventions are unchanged from the previously read baseline; the EQUATION_INPUT additions for exponent token boundaries, mixed-number/hidden grouping and shared native-number validation were inspected. Shared math/README confirms no installed mathematical backend. Locked Node24 dependencies are installed in this isolated worktree, with no package/lockfile change.

| Accepted requirement | Starting evidence | Missing work |
|---|---|---|
| Editable characteristic polynomial and cell exercise | Default P=s³+7s²+10s+K,K=20 in metadata only | Visual input, optional native K, exact coefficient validation, selected table-cell prediction |
| Ordinary Routh arithmetic and RHP count | Absent | Exact table, cell derivations, first-column signs and independent count fixtures |
| Coefficient-to-cell highlighting | Absent | Select coefficient and reveal corresponding first-row/matrix placements; select constructed cells for their source arithmetic |
| Isolated zero-first-entry submode | TASK/audit proposed quartic | Symbolic positive epsilon, exact one-sided limits/signs, student choice of treatment; no arbitrary numeric epsilon proof |
| All-zero-row submode | TASK/audit proposed fifth-order fixture | Detect full zero row separately, construct preceding-row auxiliary polynomial, differentiate/replace row and classify symmetry/axis roots |
| Hurwitz leading principal minors | Absent | Normalize leading sign/scale, construct matrix, selectable leading submatrix and exact determinant/minor prediction |
| Baseline and changed data | TASK/audit only | Cubic minors7,70−K,K(70−K); proposed special fixtures; independently factored stable/unstable/axis cases |
| Student flow and visual equations | Blank mount | Attempt/check/reveal, intermediate reasoning, visible units/grammar/errors, shared editor/display and readable plots/tables |
| Lifecycle/accessibility/browser | Blank mount | Synchronous loading node, owned child signal and partial-failure cleanup; reset/reopen/fast navigation, keyboard and narrow viewport |
| Validation and delivery | No local tests or PR | Meaningful math/workspace tests, project checks/build, actual private-IAB QA, one attached PR and exact clean submission |

## Intended bounded exercise

Work toward real scalar characteristic polynomials of degree1..6, normalized to leading coefficient1 before Hurwitz positivity. A native real K can be substituted into the editable polynomial; this tool checks selected data, while complete parameter-region proofs remain CS03's separate exercise. State all coefficient order, units and normalization explicitly. Numeric native controls use the existing stateless shared readNumericInput helper. No sibling imports or unowned shared/dependency/shell edits are needed.

Exact rational coefficients and bounded rational functions of symbolic epsilon will carry Routh arithmetic. An all-zero row must be handled before an isolated zero pivot. The displayed auxiliary polynomial will come from the preceding row's actual powers, and its derivative will replace the row. Origin symmetry alone must not be called an imaginary-axis root: independent axis/symmetric-root classification is required, including symmetric real roots. Exact determinants will use the required leading principal submatrices after normalization. Resource and parser limits will be finalized and tested before claiming supported implementation; no generic CAS or floating-epsilon proof is promised.

Visual fractions and powers must preserve MathLive one-token argument meaning. In particular reject ambiguous unbraced multi-token/signed exponents or preserve their visible products, and independently cover braced exponents followed by numbers. Whole-number/fraction adjacency and invisible brace grouping need pre-normalization validation. Student numeric cell/minor answers remain separate bounded visual arithmetic, with useful unsupported/incomplete feedback.

## Provenance and independent expected fixtures

The recorded continuous audit S1–S4 was inspected. Ch4:20–24 anchors the two special treatments; Ch4:25–28 anchors Hurwitz normalization/minors. Original slides are outside Git and were not newly inspected in this run.

- Source cubic: with K=20, normalized first column1,7,50/7,20 has no sign changes; Hurwitz minors are7,50,1000. At variable K the recorded identities are7,70−K,K(70−K), and strict stability is0<K<70.
- Proposed isolated-zero fixture: s⁴+2s³+3s²+6s+5 has row[0,5]. Replacing only the first entry by epsilon>0 gives next first entry6−10/epsilon and two RHP sign changes in the one-sided limit. The audit's approximate RHP pair .300243±1.624811j is a proposed independent check, not a slide transcription.
- Proposed all-zero fixture: (s²+4)(s+1)³ expands to s⁵+3s⁴+7s³+13s²+12s+4. Its zero s¹ row follows A(s)=s²+4; derivative2s replaces it. Known factors give axis pair±2j and−1 with multiplicity3. No strict-stability claim may follow from a continued nonnegative RHP count alone.
- Additional independently derived fixtures will include leading-negative scaling, origin multiplicities, repeated imaginary factors and symmetric real roots so that auxiliary symmetry is not silently equated with axis roots.

## Current evidence and remaining work

Only the audit/ownership setup is delivered at this checkpoint. No algorithm, student interface, mathematical test or browser functionality is yet claimed. All implementation/verification rows above remain open. Use own private in-app browser after verifying this chat's codexSessionId under the updated primary guide; no global lock is required for that isolated path. No browser/preview is currently open or reserved. No Firefox retries, merges, version changes or deployment are authorized here. Keep later checkpoints and this record honest; prior submitted worktrees remain intact for review returns.

## Exact algebra checkpoint

Private algebra.ts now provides immutable rational coefficients, ascending polynomial arithmetic/division/GCD, reduced rational functions of symbolic epsilon, exact one-sided limit signs, Sturm counts and imaginary-axis/symmetric-root multiplicities. No numeric epsilon is substituted. Exact components are currently bounded to4096bits and symbolic polynomial degree32; division/GCD/Sturm/multiplicity loops also enforce decreasing-degree bounds. These private helpers do not import siblings or add a shared backend.

Independent algebra.test.ts checks signed fractions/native exponent values, a separately expanded factor identity, epsilon limit6−10/epsilon→−infinity, positive/negative approaches to zero,27changed factored real-root triples, origin/repeated imaginary factors, symmetric real pairs and complex quartets.8/8module tests and npm run check pass. The fresh unchanged v0.3.9 baseline also passed npm test660/660 across26files after locked installation. Routh table construction, Hurwitz minors, parser/student interface and browser delivery remain open; stage stays in-progress. No CS02 preview or browser tab is open.

## Routh/Hurwitz calculation checkpoint

math.ts now constructs the normalized degree1..6 table, preserves each raw row before treatment, replaces an isolated zero first entry by symbolic epsilon and replaces all-zero rows using the exact derivative of their preceding auxiliary polynomial. Exact one-sided first-column signs count RHP roots. Original-polynomial imaginary-axis multiplicity is independently computed through even/odd common factors and squarefree Sturm counts, including repeated origin/axis roots. LHP count follows the degree identity. Constant-coefficient auxiliary polynomials are separately classified into real pairs, imaginary pairs, origin multiplicity and complex quartets, so symmetry is not equated with the axis. Symbolic auxiliary expressions remain available if epsilon occurs in their coefficients; their student presentation is still open.

The normalized Hurwitz matrix records each source coefficient power and all leading principal minors use exact pivoted determinants. Routh/axis strict classification is checked against positivity of those minors; disagreement or a degree mismatch is a useful failure, not an invented stable result.16/16local tests and type checking pass. Fixtures include the source cubic column/minors across changedK, both proposed special rows, leading-negative scaling, s^n for n1..6, repeated imaginary factors, symmetric real/quartet cases, exact determinants and216independently factored real/quadratic combinations through degree6.

Algorithm references were checked against primary documentation: [SymPy Routh-Hurwitz documentation](https://docs.sympy.org/dev/modules/physics/control/routh_table.html) distinguishes the two treatments and auxiliary origin symmetry; [FLINT Sturm algorithm documentation](https://fredrikj.net/fdoc/html/algorithms/polynomials/real-roots-integers.html#sturm-sequences) gives sign-variation counting with positive rescaling. These are research references, not runtime dependencies or solver calls. This module computes privately in TypeScript; no external service is used by the exercise.

Parser/visual student input, coefficient/cell highlighting, selectable minors, answer grading/reveal, lifecycle/UI/browser evidence and final submission remain open. This is a recoverable in-progress math checkpoint, not completion of the tool.

## Bounded visual parser checkpoint

parser.ts now reads actual TeX fraction/power argument boundaries directly, preserving compact one-token fractions, signed outer/grouped fractions and nested supported fraction expressions. General invisible braces are rejected rather than converted into visible grouping. Numeric/fraction adjacency is checked lexically before expansion, including nested, signed and thin-spaced forms. Power boxes allow nonnegative integers0..12 while the resulting characteristic degree remains1..6; ambiguous unbraced multi-digit/signed powers and immediate numeric tails after an exponent are rejected with explicit-box/product guidance.2^{12} remains4096 while2^12 rejects; s^{0}2 cannot fuse into degree2. Visual e notation is unsupported.

Current parser bounds:600characters,256expanded symbols,16nested fraction/group levels; model literals12digits/8decimal places; exact student-answer literals60digits/40decimal places. Fractional polynomial numerators and constant denominators are supported; nonconstant/zero division is rejected. Selected nativeK must be finite in[−1000,1000] and resulting input coefficients must meet the separately tested parts/magnitude caps. Numeric answers use separate variable-free exact arithmetic.28/28local tests across3files and npm run check pass. Student UI/answer presentation, final project/build/browser checks and PR/submission remain open.

## Mixed axis/epsilon and student-arithmetic checkpoint

A bounded grid investigation exposed a genuine combined case: P=(s²+1)(s⁴−s³−1) has2axis roots, but the full-table epsilon perturbation produces5sign changes by migrating the axis pair. The original quartic factor has independent sign column+,-,+,-,-, hence3RHP roots; the original P therefore has3RHP,2axis,1LHP. math.ts now detects axis+epsilon coexistence, separates exact A=gcd(P(s),P(−s)), classifies A's real/imaginary/origin/quartet modes and applies epsilon to the axis-free quotient. Returned data preserves both the formal full-table changes and the original-polynomial count, with the exact factor/quotient/reduced table for honest UI explanation. The interface must expose this distinction, not label5as the original RHP count.

The counterexample and changed axis frequencies are regression fixtures. An exploratory finite grid of19,530monic polynomials of degree1..6 with coefficients−2..2 now gives no exception or internal Routh/Hurwitz/degree disagreement, including1,426axis+epsilon separations and188multiple-epsilon tables. This grid is bounded exploration/internal consistency, not an independent root oracle or proof for all inputs; the216factored families remain the independent count fixtures. No epsilon-dependent auxiliary coefficients were encountered in that finite grid, but such symbolic data is retained rather than silently converted to numbers.

Exact determinant work now records row swaps/eliminations, pivots and the final triangular matrix for student inspection. Pure grade.ts checks root counts/treatment choices and exact finite/infinite entry limits, retaining the one-sided positive sign of epsilon even when its limit is zero. Independent worked-minor checks verify Δ2=50 from row operation R2−(1/7)R1 and the resulting diagonal7,50/7, plus swap/singular cases.33/33local tests and type checking pass. UI/lifecycle/browser and final delivery remain open; no preview/tab/resource is held.

## Student workspace draft and review-return checkpoint

view.ts and scoped workspace.css now provide the visual characteristic input, native K through the shared numeric helper, count/treatment prediction, ordinary/epsilon/all-zero presets, coefficient-source highlighting, selectable Routh cells and Hurwitz leading minors, exact finite/infinite entry grading and worked row/determinant arithmetic. The mixed axis/epsilon section explicitly distinguishes full perturbed-table changes from exact original counts and shows the separated factor/quotient signs. Auxiliaries with epsilon-dependent coefficients now have a bounded ordered-rational-function Sturm classification for sufficiently small positive epsilon, separately labeled before the zero limit; an independent binomial/repeated-factor fixture checks this path.

The owned synchronous wrapper appends loading feedback immediately and owns a child AbortSignal/container, aborting partial-mount resources and late returns. Exact result displays use the shared equation display; two input editors belong to the mount. Source/selected/leading cells have distinct borders; matrix/table scroll areas and hidden controls are scoped. No working shared feature is changed.

Actual current checks:34/34math/parser/grade tests across4files, npm run check and npm run build pass, with the existing MathLive large-chunk warning. These are not yet workspace/lifecycle or browser evidence. All student-flow/lifecycle tests and actual editor/keyboard/reset/reopen/phone checks remain pending; stage stays in-progress. No CS02 preview/tab/QA resource has been started.

CS02 is checkpointed while this worker addresses coordinator-returned CS03 PR#26 spacing-token argument semantics on that preserved branch. Resume this exact worktree afterward. The returned CS03 claim is reopened; CS02 reservation and all draft work remain preserved. No module is being silently marked complete.
