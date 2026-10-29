# DP01 implementation status

- **Stage:** in-progress
- **Last assessed:** 2026-10-29
- **Starting revision:** `c5d1135ba8b595215dfc7007824d5bd206908152`
- **Ownership:** `src/modules/dp01/**`; branch `codex/dp01-sequences-f802`
- **Goal and acceptance contract:** [TASK.md](TASK.md)
- **Stage definitions and evidence rules:** [Project status](../../../docs/PROJECT_STATUS.md)

## Implemented and inspected

- `index.ts` defines the module metadata, default example and lazy workspace loader.
- `workspace.ts` exports the synchronous mount contract and deliberately adds no controls or calculations.
- The shared shell displays and edits a baseline-equation preview. It is not this module's solver or working input model.

## Requirement audit before implementation

The current workspace is a blank mount with no local helpers/tests. Metadata and lazy loading already work and will be preserved.

| Accepted requirement | Planned implementation | Missing at checkpoint |
|---|---|---|
| Editable model and bounded validation | Shared equation input; local real rational-polynomial parser, proper denominator degree 1–2 | Parser, limits and errors |
| Step, impulse, physical ramp and free sequences | Normalized recurrence; causal samples with explicit prehistory | All calculations |
| Stems, sample/time axes, selectable history | Actual samples, optional labeled held guide, numeric sample inspector | All controls/plots |
| Modal decomposition and pole interpretation | Quadratic roots; homogeneous modal basis, free/forced superposition, equal-radius angle comparison | All modal reasoning |
| Attempt, reveal and changed-data experiment | Prediction; presets for ±0.8, conjugates and repeated poles | All interactions |
| Independent math fixtures | Baseline y[k]=1−0.8^k; analytic impulse/ramp/free and second-order fixtures | Tests |
| Lifecycle and browser checks | Synchronous mount and abort signal exist | Edit/reset/reopen/rapid navigation/keyboard/fonts/narrow checks |

## Planned bounds and provenance

Real proper rational models with denominator degree 1–2 and polynomial expressions in z. Zero pre-input history, editable y[−1]/y[−2], T in seconds. No continuous plant or intersample peak is inferred. Denominator modes are retained even when the selected zero-state channel cancels one. No shared API/dependency change is needed.

TASK/atlas cites Ch8:41–44,46–62 and S13. `docs/research/DISCRETE_EXERCISE_AUDIT.md` DP1 records the negative-pole worksheet and modal reasoning. Original slides have not been newly inspected by this worker. ±0.8 and equal-radius comparisons remain proposed teaching fixtures; expected values will be derived independently.

## Implementation checkpoint

- `math.ts`: bounded visual rational parser; normalized first/second-order recurrence; causal step/impulse/physical-ramp/free calculation; original poles, free modal decomposition and mode comparisons.
- `workspace.ts`, `plot.ts`, `workspace.css`: equation entry/results, prediction/reveal, history and fixtures, stems with sample/time axes, optional labeled held guide, sample arithmetic, full accessible table and equal-radius angle comparison. All state is mount-local, listeners use the abort signal and the equation input is destroyed on cleanup.
- `math.test.ts`: 40 passing tests. Independent baseline is y[k]=1−0.8^k; impulse 0.2·0.8^(k−1) for k≥1; physical ramp T[k−5+5·0.8^k]; nonzero-history mode c·0.8^(k+1). Changed sign, conjugates, repeated poles, delays, feedthrough, cancelled hidden mode, time scaling and invalid/bounded work are covered.
- `npm test -- src/modules/dp01/math.test.ts`: 40/40 pass. `npm run check`: pass (bundled Node v24.22.1; npm 10.8.2; locked dependencies installed inside this worktree).
- Full suite/build and real-browser checks are still pending. Stage remains in-progress.

Second checkpoint: browser-only view is imported after synchronous mount, with abort/disposal guards and lifecycle tests. `view.test.ts` exercises reveal, changed amplitude/history, negative/conjugate/repeated modes, errors, comparison and reopen using a public equation API stub; it is not browser-editor evidence. Added analytic impulse modal tails (including feedthrough, delay and repeated roots), scientific notation in typeset output, and readable horizontally scrollable narrow plots. `npm test -- src/modules/dp01`: 48/48 pass; `npm run check` passes. Full suite previously passed 84/84 after the import fix; rerun final suite/build after the latest edits. Browser reservation is currently held by another worker; no browser controls have been used.

## Remaining acceptance work (at initial audit)

- [ ] Working exercise inputs, declared supported domain and mathematical validation.
- [ ] Input-dependent computation and the full mathematical checks in TASK.md.
- [ ] Intuitive visualization, intermediate reasoning and the required student interactions.
- [ ] Independently checked baseline, changed-data and boundary/failure tests.
- [ ] Real-browser editing, reset, reopen, keyboard, narrow-screen and cleanup checks.

## Evidence and next action

Source inspection found the blank mount and no module-owned mathematical tests at the assessed baseline. No module solver, plots or exercise browser behavior are claimed verified; shared-shell tests do not establish these.

Start with [START_HERE.md](../../../docs/START_HERE.md), then compare TASK.md with current source and rerun relevant checks. Replace the generic remaining list with a requirement-to-evidence assessment as implementation progresses. Record supported limits, exact check results and unresolved dependencies here; do not silently reduce the accepted goal.
