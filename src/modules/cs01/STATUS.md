# CS01 implementation status

- **Stage:** in-progress
- **Last assessed:** 2026-10-29
- **Starting revision:** `c5d1135ba8b595215dfc7007824d5bd206908152`
- **Ownership:** `src/modules/cs01/**`; claim `worker-cs01-01a18701`.
- **Contract:** [TASK.md](TASK.md), atlas CS01 and continuous source audit S7.

## Requirement audit before implementation

The current `workspace.ts` is empty and there are no local tests. Metadata and the shared equation preview work; preserve both.

| Accepted requirement | Current evidence / next action |
| --- | --- |
| Editable exercise, predictions and reveal | Missing; add visual state-space matrices and classification prediction |
| Asymptotic/internal versus reduced-channel BIBO | Missing; derive characteristic polynomial and exact scalar transfer cancellation for bounded two-state SISO realizations |
| Select eigenvalue/pole and view its mode | Missing; add computed pole plane, selectable mode and time trace |
| Original versus reduced transfer | Missing; retain original matrices and all eigenvalues while toggling view |
| Imaginary-axis multiplicity and Jordan qualifications | Missing; distinguish semisimple repeated zero eigenvalues from defective Jordan growth |
| Hidden unstable mode fixture and changed data | Missing; support the TASK's diagonal fixture and independently test it, oscillator and Jordan cases |
| Validation, units, resource bounds | Missing; state continuous time, 2-state real matrices, exact bounded rational entries, finite trace limits |
| Lifecycle, reset/reopen, scoped design | Preserve mount contract; add signal-bound controls and destroy visual inputs |
| Tests, checks, real browser | Not performed yet |

## Supported domain planned

Continuous-time SISO realizations x'=Ax+Bu, y=Cx+Du with A 2x2, B 2x1, C 1x2, D scalar, real bounded rational entries. This includes the default transfer, the accepted hidden-state variation, simple imaginary pairs and repeated zero Jordan cases. Exact rational polynomial algebra will distinguish exact from near cancellation. Roots and plotted exponentials are numerical; no general high-order solver is claimed.

## Evidence and remaining work

Read TASK, current source, shared equation API, contribution/development/design/equation guides, atlas CS01 and source audit S7. Course slides remain outside Git; the hidden-mode, oscillator and Jordan examples are proposed verification fixtures, not newly inspected slide transcriptions. All implementation and checks remain pending. No shared dependency request is needed.

## Implementation checkpoint (2026-10-29)

- `math.ts`: bounded exact-rational matrix parsing; characteristic/numerator derivation; exact polynomial GCD reduction; numerical roots; exact-sign state and BIBO classification; semisimplicity/Jordan check; analytic state, modal and reduced impulse traces.
- `workspace.ts`/`workspace.css`: four visual matrix/scalar inputs, numeric initial state and horizon, prediction/reveal, all-root table, pole plane, original/reduced view, selectable modal component, generalized Jordan mode and free/impulse plots. Per-result listeners are aborted when results are replaced; async equation loading is guarded after abort/cleanup.
- `math.test.ts`: 33 independent cases including baseline, TASK hidden fixture and audit B variant, exact/near cancellation, simple imaginary pair, semisimple/defective zero, stable Jordan, direct channel, coordinate permutation, IVPs, impulse response and invalid/bounded data.
- `workspace.test.ts`: 5 mocked-editor flow/lifecycle checks. These do not establish actual MathLive browser behavior.
- Node 24.22.1: `npm run check` passed; `npm test` passed 80 tests in 8 files; `npm run build` passed. Existing MathLive chunk-size advisory remains. npm was invoked with the bundled Node executable and the installed npm CLI; no dependency changes.
- One first test run found the Node-side MathLive export cannot initialize the interactive editor during catalogue imports. Fixed locally by loading the editor inside synchronous mount with an abort/disposal guard; all global tests now pass without shared changes.
- **Still pending:** real-browser production checks, visual-font/keyboard validation, final mathematical review and final delivery. Stage remains in-progress.

### Numerical review checkpoint

A review of mixed growing/decaying modes found that forming hyperbolic terms before recombining could erase a tiny decaying state. The transition now keeps separated real exponentials separate away from a repeated root, and uses a small-argument expression near repetition. Added the independent diag(1,-2), x(0)=[1,1], t=30 check (exp(30), exp(-60)). Reduced-channel impulse evaluation uses the exactly reduced denominator, so a canceled unstable eigenvalue cannot contaminate that trace. The 38 module tests pass after this correction; browser QA is reserved by DR01 at this checkpoint, so no browser controls have been used.
