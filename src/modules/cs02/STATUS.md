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
