# DR03 implementation status

- **Stage:** in-progress
- **Assessed:** 2026-10-29, claimed base 9d923d2f9a3728bdfd6516dd68aa06c93d9e7f86 (primary main v0.3.9).
- **Worker chat:** 01a18700-cc48-7482-ba96-f9aab107f802.
- **Branch/worktree:** codex/dr03-delay-states-f802; C:\Users\baokh\.codex\worktrees\dr03-delay-states-f802\CSDKTD APP.
- **Ownership/contract:** src/modules/dr03/** only; [TASK.md](TASK.md).
- **Pull request/preview:** not created/started yet.

## Initial evidence and requirement audit

At claim, index.ts contained immutable metadata and its lazy workspace loader; workspace.ts was blank and no local tests existed. The default banner is only a notation preview. The parser foundation below is now implemented; the state exercise and interface remain pending.

| Accepted requirement | Missing work and planned verification |
|---|---|
| Difference/TF/state conversion | Editable proper G(z) plus labelled recurrence-coefficient alternatives; construct a history-register realization and controllable/observable companion forms. Recover the zero-state channel from the constructed state equations and check its coefficient residuals. All pending. |
| Delay outputs as states | Draw scalar unit-delay cells for prior output/input values and each explicit integer input delay. Distinguish direct feedthrough from storage, state the count and identify redundant history storage. Select a cell to highlight its matrix row and scalar output equation. All pending. |
| Simultaneous sample update | Show old state, input, output and all next-state arithmetic before advancing the sample. Include a next-component prediction with explicit tolerance; no in-place early memory update. All pending. |
| Canonical comparison and initial history | Map declared past input/output history to canonical initial state, then map it consistently through a checked similarity transform. Compare both canonical simulations and the history realization to an independently stepped recurrence. Report singular/nonminimal/ill-conditioned mapping separately rather than asserting arbitrary initial vectors are equivalent. All pending. |
| Default ZOH mechanical chain | Compute the declared A/B/C source's Ad/Bd at T=.1; show the hold convention and source matrices. A period control plus explicit ZOH regeneration changes the baseline conversion; an arbitrary entered discrete G(z) keeps T as its physical-time label. Independent modal formulas will check the source conversion. Pending. |
| Changed data and failures | Changed poles/numerator/feedthrough, nonzero past input/output values, integer delay and source period; malformed notation, dimensions, improper models, singular maps, underflow, excessive response/work and insufficient data. All pending. |
| Visual input/access/lifecycle | Shared equation input/display, scoped Indigo/slate styles, native numeric alternatives, keyboard cell/row selection, synchronous owned-host/child-signal lazy mount, abort/failure/late-disposer cleanup and fresh reset/reopen. All pending. |
| Delivery evidence | Mathematical/view/lifecycle tests, check/full test/build, actual editor/keyboard/reset/rapid-navigation/narrow browser checks, owned final commit/push/one PR and exact clean claim submission. All pending. |

## Planned bounded domain and conventions

Real proper scalar discrete transfer functions with unreduced denominator order 0–2, normalized into y[k]+a1 y[k-1]+...=b0 u[k-m]+b1 u[k-m-1]+..., explicit integer input delay m=0–4 and declared T in seconds. Positive powers of z in the visual rational field; delays have their own control, avoiding ambiguous negative-power entry. Use bounded constant/fraction arithmetic and powers 0–2, preserving actual MathLive fraction/exponent token boundaries; reject unsupported e/E, mixed-number adjacency and invisible grouping.

The direct history realization stores n previous outputs and n+m previous input samples (at most eight scalar delay states); some history cells can be redundant. The canonical base has n states plus m input-delay states (at most six). Each displayed delay stores one scalar sample. For order zero, direct feedthrough and pure input delay need explicit no-state/shift-register handling.

Past arrays are ordered newest to oldest: y[-1],y[-2] and u[-1]...u[-(n+m)]. Current output is computed from old memory and u[k], then every memory cell updates simultaneously. The zero-state TF assumes all initial storage is zero; arbitrary selected history has a separate response. No feedback connection is implied.

A checked observability solve will map the first n zero-future recurrence outputs, after subtracting the canonical forced contribution from the same delayed prehistory, to the controllable initial state. The observable form uses the transposed companion with input/output transposed; a checked map preserves state/output equivalence. Singular/nonminimal or poorly conditioned maps must produce explicit unavailable feedback while preserving the valid history realization; do not invent an inverse or silently reset history.

Planned work bounds: 4–120 samples, input/history magnitudes at most 10^4, bounded polynomial degree/characters/nesting, finite normalized coefficients, state/output range guards and checked small linear solves. Final exact bounds and residual tolerances will be recorded with the implementation and tests; they are not yet delivered.

## Sources and setup

Read current primary AGENTS, START_HERE, AUTONOMOUS_WORKERS and COORDINATION at selection, plus CONTRIBUTING, DEVELOPMENT, DESIGN, EQUATION_INPUT, the DR03 atlas entry and functional scope. Discrete source audit DR5 cites CH7:30–42,50–51, S12:6–11 and S15:7–8. Its explicit distinction between recurrence right-hand sides with/without delayed input is retained; a single naive output-state recipe is insufficient. Audit DR3 supplies the fixed-period ZOH bridge. Original external decks were not newly inspected. Proposed fixtures and independent mathematical checks must remain distinguished from inspected original diagrams.

A fresh managed worktree was created at the exact new claim base, then its unique branch was created and recorded. npm ci passes (109 packages, zero audit vulnerabilities). No shared mathematical backend is installed; no dependency or shared-file change is requested. Only this module is active. Earlier DP01 is integrated; DR05 PR11 and CR06 PR17 are submitted and preserved for independent review.

## Next implementation work

Implement pure bounded parsing, polynomial/state/history/canonical algebra and independent fixtures first, then the full input/derivation/delay-selection/sample-step interface. Keep exact identities, numerical realization residuals and finite sampled comparisons distinct. Checkpoint mathematical milestones and report unsupported mapping forms explicitly.

Use shared readNumericInput for every native read, including optional badInput and sample index. Keep invalid raw drafts visible on Reveal; never coerce underflow with Number(value)||0. Preserve the owned child signal on lazy mount, release partial allocations immediately, and execute a cleanup returned after disposal. No complete exercise or browser pass is claimed by this audit.

## Parser foundation checkpoint

rational.ts provides bounded immutable rational arithmetic (numerators/denominators at most8192 bits), with separate exact-decimal and IEEE-754 constructors. parser.ts normalizes the entered decimal rational-polynomial expression exactly before converting its final descending coefficients to browser numbers. It retains the original denominator without pole/zero cancellation and supports proper unreduced order0–2, including gain/zero channels. No sibling-module import, dynamic evaluation or dependency is used.

Current limits:512 source characters,20 nested groups, intermediate degree6/coefficient magnitude10^12, entered/normalized coefficient magnitude10^6, leading denominator magnitude at least10^-8 and nonzero final coefficient magnitude at least10^-300. Explicit delay remains separate. Compact/mixed-argument/nested/signed/numeric-font fractions preserve TeX boundaries. Ambiguous mixed numbers, hidden algebraic grouping, visual e/E, unsupported font commands/functions, improper forms and invalid exponent tokenization are rejected.

The55 local tests include independent polynomial identities, changed normalized coefficients, direct feedthrough, retained zero-channel denominator, exact decimal versus binary0.1, and (100000+.000001)^2-100000^2-.2=10^-12. Resource/underflow/zero-denominator and actual TeX fraction/power boundary cases pass. An unknown font command initially received grouping guidance; it is now rejected before group normalization as unsupported notation. A case-sensitive feedback assertion was corrected. npm test -- src/modules/dr03/parser.test.ts:55 passed; npm run check:passed. State construction, ZOH generation, canonical/history mapping, independent stepped comparisons, UI and browser verification remain unimplemented.

Full branch npm test:715 passed across27 files. npm run build:passed, including its type check; existing MathLive large-chunk advisory only. These checks cover the parser foundation and existing main tools, not delivery of DR03's still-blank workspace.
