# DR02 implementation status

- **Stage:** in-progress
- **Last assessed:** 2026-10-29
- **Assessed code baseline:** `c5d1135`; isolated branch `codex/dr02-01a186d2`
- **Goal and acceptance contract:** [TASK.md](TASK.md)
- **Stage definitions and evidence rules:** [Project status](../../../docs/PROJECT_STATUS.md)

## Implemented and inspected

- `index.ts` defines the module metadata, default example and lazy workspace loader.
- `workspace.ts` exports the synchronous mount contract and deliberately adds no controls or calculations.
- The shared shell displays and edits a baseline-equation preview. It is not this module's solver or working input model.

## Remaining acceptance work

## Worker audit (29 October 2026)

The claimed baseline contains metadata and a blank mount, with no local solver or tests. No working module behavior is being replaced. Ownership is limited to this folder; no shared API/package changes are needed.

| Accepted requirement | Baseline evidence | Planned implementation / remaining check |
|---|---|---|
| Convert editable TF in z or inverse powers to recurrence | absent | Bounded rational polynomial parser; normalized coefficients and linked forms |
| Delay diagram, coefficient memory slots and old-value highlight | absent | Computed tapped-delay view and contribution rows sharing selection |
| Arithmetic preview then commit update | absent | Pure preview/commit functions and explicit student controls |
| Specified histories and changed-memory experiment | absent | Editable input/output histories, zero-state comparison with unchanged TF |
| First samples and improper-form causality explanation | absent | Independent baseline/changed-data/error tests and useful model errors |
| Visual equation entry, prediction/reveal and lifecycle | absent | Shared equation input and displays, local draft and abort cleanup |
| Browser and project validation | unperformed | Editing, reset/reopen, rapid navigation, keyboard, fonts and narrow viewport |

Supported design: real scalar rational polynomials, maximum six delays, expanded sums/products and integer powers in z; normalize the denominator's highest power, reject future-input forms. Unilateral zero-state TF; supplied pre-k=0 history contributes separately. Floating-point arithmetic; fixed positive T labels sample times, not an integration step. A finite sample run does not assert stability. Final bounds and evidence will replace this plan after verification. Course-source locators above are inherited audit evidence; original decks and the external MIT exam have not been newly inspected by this worker.

- [ ] Working exercise inputs, declared supported domain and mathematical validation.
- [ ] Input-dependent computation and the full mathematical checks in TASK.md.
- [ ] Intuitive visualization, intermediate reasoning and the required student interactions.
- [ ] Independently checked baseline, changed-data and boundary/failure tests.
- [ ] Real-browser editing, reset, reopen, keyboard, narrow-screen and cleanup checks.

## Evidence and next action

Source inspection found the blank mount and no module-owned mathematical tests at the assessed baseline. No module solver, plots or exercise browser behavior are claimed verified; shared-shell tests do not establish these.

Start with [START_HERE.md](../../../docs/START_HERE.md), then compare TASK.md with current source and rerun relevant checks. Replace the generic remaining list with a requirement-to-evidence assessment as implementation progresses. Record supported limits, exact check results and unresolved dependencies here; do not silently reduce the accepted goal.
