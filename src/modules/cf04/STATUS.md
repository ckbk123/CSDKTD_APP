# CF04 implementation status

- **Stage:** implemented
- **Coordinator preparation:** source `06c3f904430fdbc03be54e922b89dd883940df05` passed a bounded independent review of G/L/T conventions, cubic Routh determinant, exact positive-frequency isolation, margin equations, resonance derivative and first downward bandwidth crossing.115 direct-complex/closed-form/changed-boundary checks passed. Shared TeX preflight now protects scalar normalization without expanding its intentionally narrow numeric grammar. Native controls already use `readNumericInput`. The deferred view owns its DOM as well as its child signal, with new pending-disposal and reentrant-return regressions.65 module tests plus179 shared-preflight tests pass (244 total), with type checking and diff validation. Mathematical limits and numerical-illustration qualifications remain; coordinator browser acceptance is pending.
- **Worker chat:** `01a18701-1ec8-7073-a23f-e744d40a5355` (local)
- **Worktree:** `C:\Users\baokh\.codex\worktrees\cf04-frequency-specs-01a18701\CSDKTD APP`
- **Branch:** `codex/cf04-frequency-specs-01a18701`
- **Baseline:** `9d923d2f9a3728bdfd6516dd68aa06c93d9e7f86` (primary v0.3.9)
- **Contract:** [TASK.md](TASK.md). Independent coordinator review/integration remains.

## Delivered requirement evidence

The claimed folder had metadata and a blank mount, with no module tests. The manifest/index and TASK remain unchanged. Only this module is changed; the shell's equation preview stays separate from its working inputs.

| Accepted requirement | Implementation and checks |
|---|---|
| Editable data, predictions and checked reveal | Five visual scalar fields for G=g/[s(s+a)] and C=K(1+τz s)/(1+τp s); channel/Kv predictions, reveal, changed data and temporary held comparison |
| Bode/Nyquist cursor and selectable crossings | G/L/T selector; gain/phase Bode and equal-axis Nyquist views; linked numeric/Bode-click cursor; crossing/peak selector and fit-window action; explicit rad/s, degrees and dB |
| All relevant crossings; margin construction; infinite/undefined distinctions | Exact rational positive-root counts for the bounded gain equation; analytic negative-real condition; all isolated L crossings, PM and GM constructions; infinite GM distinguished from DC singularity, numerical failure and unavailable stable performance |
| Closed-loop resonance/bandwidth markers | Full closed-loop polynomial and exact Routh check; stable T stationary candidates/global peak, all −3.0103dB contacts and their up/down/touch direction; first downward exit from the DC passband defines bandwidth |
| Course C0/C1 comparison and Kv | Documented lead preset; held comparison shows PM51.827292→64.471221deg, Kv2 unchanged, T peak1.1547005→1 and bandwidth2.5440393→3.1942249rad/s |
| Validation/lifecycle/project/browser evidence | Bounded parser/math, shared native reader, resource-then-throw child-signal cleanup, result-listener disposal, full test/type/build checks and private production-browser QA below |

## Mathematical domain, limits and conventions

Real SISO negative unity feedback, normalized scalar signals. Plant g,a and controller K are0.001–100; τz,τp are0 or0.001–100 seconds. A positive τz requires positive τp (proper compensation). g has s^-2, a has s^-1, K is dimensionless. Supports the integrating second-order plant and a constant/first-order lead or lag compensator; no arbitrary-order, negative-gain or RHP-zero claim. Exact equal compensator factors reduce to constant gain for the scalar frequency channel; no unspecified physical hidden state is inferred.

Scalar grammar: one number or simple numeric fraction,12 decimal places,24 digits,100 normalized/512 raw characters, at most8 outer groups/signs, reduced denominator≤10^18. Compact/mixed-brace fraction-button notation and signed/parenthesized numeric wrappers work. Mixed numbers, sums/products/powers/functions, e/E symbols, nested fractions, hidden arithmetic groups and explicit spacing tokens are rejected. ASCII TeX whitespace alone may be ignored; blank argument tokens are never discarded to expose new arguments. Delimiter sizing is removed only beside visible parentheses. This conservative local rejection is independent of the coordinator's future shared TeX guard, unavailable at the recorded baseline.

Polynomial coefficients are ascending internally and displayed descending. Exact rational algebra forms gain/phase, stability and |T|² equations. Root isolation supports degree≤3: remove repeated factors, count distinct positive roots by an exact Sturm sequence, then isolate within relative10^-12 (floor10^-24 in x=ω²),220 steps/depth and1500 work items. Marker separations≤relative10^-10, insufficient isolation or scaled residual>10^-8 produce explicit precision feedback. Transfer crossing residual tolerance10^-7. DC roots and contacts are separate. No sampled frequency sweep is used as a completeness proof.

Frequency evaluation is DC or10^-12–10^6rad/s; visual cursor/window uses DC or10^-9–10^6rad/s. Computed markers must be evaluable within those declared numerical bounds; otherwise feedback rejects the calculation or withholds the affected performance markers. Nyquist half-width0.25–1000. The curves join241 logarithmic samples plus computed specification/cursor points. They are finite-range illustrations, clipped locally, with gaps at supported singularities and principal-phase wrapping; no contour winding count is asserted. Large-loop T uses1−1/(1+L), while small-loop evaluation avoids cancellation of a tiny T.

Positive coefficients plus the exact quadratic/cubic Routh determinant classify the complete supported closed-loop polynomial. Stable resonance/bandwidth are withheld for boundary/unstable cases or near-pole numerical conditioning (denominator threshold10^-12 relative to loop scale). Kv=gK/a is an algebraic limit; steady ramp-error interpretation requires a stable closed loop. PM=180° plus L's continuous positive-frequency phase. Infinite GM means the supported family has no finite negative-real crossing; G/L DC remain undefined. Bandwidth is the first downward crossing of |T|=1/sqrt2 relative to T(0)=1; all touches and additional crossings remain visible.

## Independent fixtures and exact checks

- C0: q4,a2 gives unity ω=sqrt(−2+2sqrt5)=1.5723028rad/s, PM51.82729237deg, infinite GM; T=4/(s²+2s+4), ωr=sqrt2, Mr=2/sqrt3, ωB=sqrt(2+2sqrt5).
- Recorded C1: K4,τz=.7071067812,τp=.3535533906 gives unity ω≈2 and PM64.47122063deg, same Kv2. These are the atlas's rounded course values, not claimed exact irrational parameters.
- Independent changed g2,a3,K5 second-order formulas; fraction g1/2 gives Kv1, DC maximum1 and bandwidthsqrt2. Proposed lag g=a=1,τz0,τp1 has negative-real crossingω1 and GM2/K: K1 stable, K2 boundary and K3 unstable. Exact fractions immediately above/below2 preserve the Routh sign; near-singular stable performance is withheld.
- Exact-root fixtures include( x−1)(x−2)(x−3), repeated( x−1)^2(x−2), negative scaling, rational/small/close roots, zero roots and continua. Independently expanded bandwidth equations distinguish a touch followed by a downward exit and a down/up/down sequence.
- Extreme-scale fixtures preserve T's nonzero tiny phase for large L and tiny T for small L. Parser regressions reject blank-spacing fraction arguments (for example frac followed by a spacing token), mixed numbers, ambiguous powers and unsupported symbols.

Commands run in the isolated worktree using bundled Node24:

- `node node_modules/vitest/vitest.mjs run src/modules/cf04`:58 passing tests (44 math/root/parser,8 exercise-flow,6 lifecycle).
- `npm test`:718 tests/30 files pass, final run16:22UTC29 October2026.
- `npm run check`:pass. `npm run build`:pass, including its type check; final build16:22UTC. Existing MathLive chunk-size advisory only.
- `git diff --check`:pass. No shared files, dependencies, metadata, package version, deployment or other modules changed.

Lifecycle tests verify synchronous loading, no late mount, already-aborted visits, recovery feedback, disposal without parent abort and exactly-once cleanup. A view registers a child-signal document listener then throws while its parent stays active: the child immediately aborts, the listener is released and failed DOM is replaced. Result controls release obsolete listeners before rerender. Mock-editor flow tests are separate from browser evidence.

## Real production-browser checks

**ChatGPT in-app browser**, private inventory codexSessionId matching this worker; own port8845,1280×900 and390×844 settings, system dark theme, approximately16:08–16:24UTC29 October2026. Engine/version was not exposed; no Firefox/all-browser claim. Light-theme token inheritance was not separately tested. No global QA lock was needed for this verified private context.

- Initial5 MathLive fields, no curves before Reveal. Correct channel/Kv predictions check; baseline tables, rational equations, margin construction, peak/bandwidth and all3 plots render. Course held comparison reproduces the values above. Original and new curves use different styles; unit circle/−1 reference and linked point are visible.
- Specification selection picks L unity, T resonance and T bandwidth, updates the channel and linked cursor. The baseline resonance readout is T=.66666667−j.94280904, magnitude1.1547005; bandwidth reads.70710678/−3.0103dB. Actual desktop Bode click at the inspected geometry selects approximately10.0365rad/s and updates the linked readout. Fit-window expands around computed specifications. G/L DC report a pole; T DC is1 at0deg.
- Actual fraction-button/keys g1/2 parses and changes Kv to1/DC maximum/bandwidthsqrt2. Actual long fraction1000000000000000001/1000000000000000000 parses/reveals and typesets its exact Kv without widening the phone page. Both were rechecked after the final spacing-token hardening. Empty field and incomplete fraction receive completion feedback; typed1e−2 and keyboard-constructed2½ are rejected without stale results.
- Proposed stable lag gives PM21.38639deg, phase crossing1rad/s, GM2/6.0205999dB. Boundary lag withholds stable performance and T atω1 reports singularity; unstable lag likewise has no stable resonance/bandwidth claim.
- Native1e−999 cursor rejects nonzero underflow and clears curves;0e−999 works as genuine DC, and1e−2 readsω=.01. Inverted/equal windows and radius.1 receive useful range errors. Cursor and window bounds remain independent of the exact specification calculation.
- Real Systems math keyboard is readable; Escape closes it and stays CF04. Tab from the frequency cursor reaches window minimum. Reset while keyboard open restores5 fields/no curves/courseC0; leaving while keyboard open removes all5 fields and old root. Three fast CF04/CF05 pairs ending CF05 leave0 fields/0 old roots; reopen fresh5/no curves. Final reset also removes held state.
- Phone client=scroll=375px. Plots281/720 and tables281/380 scroll locally; focused plot ArrowRight keys pan (observed scrollLeft80 of439). Long equations remain local; final desktop has no formula vertical overflow, no NaN/Infinity path data, and document1265/1265. Fractions/superscripts/formulas and local stylesheet assets render correctly. Console warn/error logs are empty. All own tabs closed, viewport reset, own preview stopped; primary8787 untouched.

Proof images outside Git:

- `C:\Users\baokh\.codex\visualizations\2026\10\29\01a18701-1ec8-7073-a23f-e744d40a5355\cf04-browser-evidence.jpg`
- `C:\Users\baokh\.codex\visualizations\2026\10\29\01a18701-1ec8-7073-a23f-e744d40a5355\cf04-narrow-evidence.jpg`

## Provenance and delivery

TASK, atlas, continuous/discrete exercise audits and recorded S09/Ch5 anchors were inspected; original decks outside Git were not. C1's explicit coefficients are recorded in the atlas CD05 check and agree independently with CF04's stated margin. Lag/threshold/root-count fixtures are proposed mathematical checks. No unseen course diagram or external solver is claimed inspected.

Tested application-source revision: `09d1125c78cfde2c0f67a982a2fcce3b01e9083a`. Later delivery changes are STATUS only. Pull request: [PR43](https://github.com/ckbk123/CSDKTD_APP/pull/43), attached to this worker chat. The shared claim records the exact clean full submitted commit, equal to this worktree's HEAD including this delivery record. Full accepted exercise is implemented within the declared domain; independent review/integration remains. No shared helper/package request is required for this contribution. Preserve this branch/worktree and reuse PR43 for any corrections; primary main/version/deployment are coordinator-owned.
