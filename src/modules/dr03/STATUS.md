# DR03 — discrete state models and scalar delay storage

- **Stage:** implemented (bounded exercise complete; independent integration review pending).
- **Assessed:** 29 October 2026. Fresh claim base 9d923d2f9a3728bdfd6516dd68aa06c93d9e7f86, primary main v0.3.9.
- **Worker chat:** 01a18700-cc48-7482-ba96-f9aab107f802.
- **Branch/worktree:** codex/dr03-delay-states-f802; C:\Users\baokh\.codex\worktrees\dr03-delay-states-f802\CSDKTD APP.
- **Contract/ownership:** [TASK.md](TASK.md); only src/modules/dr03/** changed. index.ts remains immutable metadata with its lazy loader.
- **Pull request:** [PR #34](https://github.com/ckbk123/CSDKTD_APP/pull/34), open for independent integration review and attached to this chat.
- **Preview:** private production preview on port 8894 stopped. Browser tab 8 closed and temporary viewport reset after verification; no global browser-QA claim/waiter owned.

## Requirement-to-evidence audit

| Accepted requirement | Implemented behavior and evidence |
|---|---|
| Difference/TF/state conversion | Shared visual G(z) editor and signed recurrence-weight alternative; rational-polynomial normalization, history realization and controller/observer companions. Actual base matrices recover C adj(zI-A)B / det(zI-A)+D; explicit delay factors follow from the shift equations. Parser/math/input tests and browser changed-input checks pass. |
| Delay outputs become states | Input-dependent two-lane scalar register; one z⁻¹ per stored sample, direct feedthrough separate. Numeric row/output selector and keyboard-activatable diagram cells highlight their arithmetic and maintain focus. n past outputs and n+m past inputs give2n+m history states, generally nonminimal; canonical storage is n+m. Browser checked zero storage, four pure input delays and maximum eight history states. |
| Simultaneous update and attempt | Old x[k], u[k], y[k], selected row arithmetic and the complete x[k+1] are shown before advancing. Prediction tolerance is explicit; editing the target/index/guess clears prior assessment. Keyboard Next updates all cells from the same old vector. Exact fixture y[0]=7.75 with next state [7.75,1,1,3] guards against early in-place shifts. |
| Identical-history comparison | Separate scalar recurrence indexes y/u prehistory directly. A checked observability solve maps history into controller base coordinates after subtracting the same delayed-prehistory forced response. A checked similarity map carries those coordinates to the observer form. Both keep the same extra input-delay cells. Exact nonzero-history fixtures and independent120-case checks pass. Singular/nonminimal/ill-conditioned maps report unavailable while preserving valid history/recurrence output. |
| Mechanical ZOH baseline | Fixed declared Ac=[[0,1],[-2,-3]], Bc=[0,1]ᵀ, Cc=[1,0], Dc=0 is computed with stable closed-form modal expressions. T=.1 initializes every mount. T alone relabels discrete sample time; explicit regeneration recomputes Ad/Bd/TF and resets delay/history. Six independent period fixtures, including .0001 and10, pass. Browser confirmed changed T and regeneration have distinct declared effects. |
| Editable experiment and failures | Proper gain/order1/order2 models, feedthrough, nonzero prehistory, m0–4 and step/pulse/ramp/alternating sequences are computed from inputs. Malformed/improper/unsupported notation, size/range/conditioning, empty/nonfinite/underflow, fractional delay/count and response work limits are checked. Optional native badInput and raw inspection underflow cannot become silent zero. |
| Visual entry, access and lifecycle | Actual MathLive fraction/power controls, ordinary keyboard entry, math keyboard, typeset matrices/results, native alternatives and scoped token styles. Synchronous lazy mount owns a child signal/host and handles partial failure, aborted imports and late disposers. Actual browser reset/leave/reopen/rapid navigation and narrow checks pass; mocked equation API tests are kept separate. |

## Mathematical domain, conventions and limits

Real proper SISO discrete G(z)=b(z)/a(z), unreduced denominator order n=0–2, descending monic coefficients [1,a1,a2] and equally padded [b0,b1,b2]. The declared scalar equation is

y[k] = −Σ(j=1…n) aj y[k−j] + Σ(j=0…n) bj u[k−m−j].

m is an additional integer input delay0–4, entered separately; no fractional-delay rounding. Past arrays are newest first: y[−1]…y[−n], u[−1]…u[−(n+m)]. The current output reads old memory and current input; all storage shifts once together. Each delay is one scalar sample. Direct feedthrough stores nothing. No feedback connection is implied. T is in seconds; signal units must be consistent.

History state size2n+m≤8; companion base size n plus m explicit input cells≤6. Pure gain has no base state; pure delayed gain has exactly m cells. History characteristic polynomial is a(z)z^(n+m); its unreduced channel numerator is z^n b(z), so redundant history zeros can cancel from the zero-state TF. Arbitrary declared memory is retained and is not silently replaced by zero-state assumptions. An unavailable invertible canonical map does not claim that no transfer realization exists.

Bounds:4–120 sample instants including k=0; .0001≤T≤10 s; |input/history samples|≤10^4; |normalized coefficient|≤10^6; nonzero final coefficient magnitude≥10^-300; generated state/map entries≤10^12; |output|≤10^10. Generated ramp samples and the final next-state preview obey these bounds. A pulse is amplitude A at k=0 only; ramp is A kT, alternating is A(−1)^k.

Visual grammar: optional G(z)=, ordinary decimals, real numeric fractions, z, visible parentheses, explicit/ordinary polynomial products and powers0,1,2. Proper original order≤2 is retained without pole/zero cancellation. Compact/mixed-argument/nested/signed/numeric-font fractions preserve their TeX boundaries. Ambiguous mixed numbers, hidden algebraic grouping, visual e/E, functions, negative/higher/ambiguous powers and future-input/improper models receive explicit feedback. Native number fields accept exponent notation through the shared numeric reader; coefficient alternatives expand it into visible ordinary decimals.

Resource limits:512 source characters,20 nested groups, intermediate polynomial degree≤6/coefficient magnitude≤10^12, leading denominator magnitude≥10^-8 and rational numerators/denominators≤8192 bits before reduction. A native alternative must fit that same editable visual domain and preserve every coefficient on round-trip.

Entered decimal identities normalize with exact rational coefficients before conversion to browser numbers. Numerical small sums accumulate exact binary-value products and round the significand once with ties-to-even, including subnormal cases. Nonzero arithmetic underflow is reported. Displays round to seven significant digits; computations retain full parsed values. State matrices, trajectories and coordinate solves remain numerical approximations.

Coordinate solves require estimated infinity-norm condition≤10^10; coefficient/similarity residual≤10^-9. Scaled finite-horizon history residual≤10^-10 and canonical output residual≤10^-8, scaling by max(1,|reference|). These sampled checks are not global equivalence/stability proofs or universal minimality claims. Numerical bounds can suppress a canonical comparison while leaving the valid history experiment available.

## Independent fixtures and tests

- Local tests140 across5 files: parser/rational56, state/math54, native coefficient input11, view13 and lazy lifecycle6. View tests use a public equation API stub, not the real editor.
- Independent modal baseline y(kT)=.5−exp(−kT)+.5exp(−2kT), plus independent Ad/Bd formulas at T=.0001,.1,.2,ln2,1,10. The small-period O(T²) input integral remains nonzero.
- Exact Fraction-derived changed model [a1,a2]=[−.5,.125], b=[2,3,4], past y=[1,−2], past u=[3,−1]: outputs31/4,83/4,589/32,999/64,… . With m=2 and past u=[3,−1,2,−2]: outputs−13/4,37/4,385/32,1399/64,… . Companion coordinates are mapped rather than copied.
- G=1/(z−.5), y[−1]=4,u[−1]=3 and future input0 gives5,2.5,1.25,…; controller/observer initial base coordinates are5, not the copied past output4.
- Hidden recurrence modes, singular zero/cancelled channels, direct gain/feedthrough, simultaneous storage, pure delays, sequence meaning, numerical limits, exact halfway/subnormal rounding and coefficient-relative residual checks are covered.
- Separate private Python evidence: dr03-state-probes.json and dr03-reference-check.json in this chat's artifact folder. Fraction-indexed recurrence, NumPy complex resolvents/eigenvalue characteristic coefficients and SciPy dlsim agree for120 proposed fixtures over all supported orders/delays.1050 complex channel checks; maximum scaled output/SciPy error2.22e−16, complex channel error4.11e−16, characteristic coefficient error1.12e−16. Five zero-channel cases correctly suppress singular canonical maps. Repeated after the significand-rounding correction.
- One hand-computed expected arbitrary-state numerator constant was corrected from−3 to−9 by expanding C adj(zI−A)B=z+5 and7 det(zI−A)=7z²−35z−14. The implementation was unchanged for that correction.

## Real-browser evidence

Production build in this chat's verified private in-app Chromium context (inventory codexSessionId matched this worker; own empty inventory before tab8). Current primary guidance permits isolated IAB testing without the global reservation. Only private port8894/tab8/viewport were used. System dark theme was inspected; light-theme shared tokens were not separately emulated. No Firefox verification is claimed.

- Baseline table at k10,t1: all four outputs .1997882. Native T edit .2 alone keeps .1997882 at t2; explicit regeneration gives .3738225 at t2.
- Real fraction button plus ordinary typing1/Tab/2 serialized compact fraction1/2 and computed .5. Explicit2+1/2 gives2.5;2×1/2 gives1; ambiguous mixed2 fraction1/2 is rejected. Visual e, both power12 forms and invisible grouping receive the declared feedback.
- Real fraction/power tools built1/(z²+.5z+.125) without raw syntax; pulse outputs0,0,1,−.5,.125,… . An extra Right moved later terms outside the fraction and produced an improper expression, which was rejected according to its displayed meaning; omitting that extra movement completed the intended denominator.
- Ordinary typed1/(z−.5) with nonzero past values gives5,2.5,1.25,… and mapped initial5. Native recurrence β1=1e−2 visibly becomes .01 and pulse outputs0,.01,.005,… .
- Changed second-order m2 fixture shows−3.25,9.25,12.03125,21.85938,… in all four output columns, with6 history cells/4 canonical cells and checked prediction. Cancellation fixture preserves2,−2,2,… with canonical unavailable. Gain3 with m4/past u=[5,−2,7,3] gives9,21,−6,15,6,… with exactly4 cells.
- Actual native1e−999 input/history rejected;0e−999 accepted as zero;1e−2 gives baseline y10=.001997882. Actually typed prediction1e309 produced badInput=true/empty raw and was rejected. Empty field and unfilled fraction boxes receive completion feedback.
- Invalid inspection1e−999 remains visible through Reveal with new amplitude2 table y10=.3995764 and no stale inspection equation. Intentional zero works; valid999 clamps to the final sample, then to3 after count4. Counts3,4.5,121 and delay.5 reject; maximum120 instants succeeds, ending at k119,t11.9,y=.4999932.
- Enter selects a delay cell, updates the row selector/selected arithmetic and retains focus on the replacement cell; keyboard Next advances the common old vector. Tab from the equation's collapsed end reaches Insert fraction. The actual math keyboard fits375 px; Escape, reset and leaving hide it.
- At390×844, document width375/scrollWidth375, field275/275; maximum8-state diagram viewport277/scrollWidth920, plot277/570 and table277/607 scroll internally. Tall matrix equations have no vertical overflow after owned padding adjustment. Actual fonts, fractions, matrices, highlighted cells and stems were visually inspected.
- Reset while the keyboard is open restores fresh T.1/m0/count21, one editor and hidden results. Leaving removes all editors; rapid DR03→catalogue→DR03 ends with one root/one editor, baseline values, hidden results and keyboard closed. Browser warning/error log is empty. Viewport reset and tab8 closed.

Browser findings corrected locally: SVG image grouping initially hid its interactive descendants from accessibility; the register is now a labelled group exposing each scalar button, with focus preserved after redraw. Tall matrix inline content initially produced a small vertical scrollbar; scoped bottom padding removed it, including the maximum eight-state case. Both corrections were rebuilt and rechecked.

## Checks, provenance and delivery

- npm ci:109 locked packages, zero audit vulnerabilities.
- npm test -- src/modules/dr03:140 passed in5 files.
- npm test:800 passed in31 files.
- npm run check:passed; npm run build:passed including type check. Existing bundled-MathLive large-chunk advisory only.
- git diff --check:passed. No dependency, shared API, shell, routing, package/version, deployment or sibling-module change. No source deck, generated dist or node_modules is committed.
- Current primary AGENTS, START_HERE, AUTONOMOUS_WORKERS and COORDINATION were read at selection; CONTRIBUTING, DEVELOPMENT, DESIGN, EQUATION_INPUT, atlas and functional scope also read. Discrete audit DR5 cites CH7:30–42,50–51; S12:6–11; S15:7–8. Audit DR3 supplies the mechanical ZOH bridge. Original external decks were not newly inspected. Independent fixtures are not presented as inspected course diagrams.
- Recovery history: early audit 08d6859, parser e49b41c, pure mathematics 7489d32 and interactive a595b2f checkpoints were pushed and recorded before final browser corrections 2af2e33. This delivery record includes PR #34; the claim records the exact clean final tested HEAD. Earlier DP01 is integrated; DR05 PR #11 and CR06 PR #17 remain preserved/frozen for coordinator review.
- Remaining module implementation work: none within the declared accepted bounded domain. Independent integration review and coordinator-owned release/versioning remain pending; this worker does not merge, deploy, rebase a submitted branch or claim review acceptance.
