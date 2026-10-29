# CS04 implementation status

- **Stage:** scaffold; reserved for implementation
- **Last assessed:** 2026-10-30
- **Assessed baseline:** `a43989def918052cc969cbee8691ce79d8824ec9`
- **Goal:** [TASK.md](TASK.md), unchanged.
- **Owner:** external contributor `ckbk456`, branch `codex/cs04-nyquist-pole-count-20261030`.

## Reservation and requirement audit

Current upstream main contains the metadata and blank synchronous workspace. All open PR bodies and open issues were checked before reserving CS04; none claimed it. The private-clone claim is active. This checkpoint contains no solver or browser verification.

The implementation will teach selection of `L=CGH`, a checked open-loop RHP pole-count attempt before revealing the criterion, signed encirclements around −1, and independently checked closed-loop roots. The source contour will be clockwise around the RHP; positive image winding will mean counterclockwise, so `Z=P−N_CCW`.

The initial mathematical scope is proper real rational plants of denominator degree 1–3, scalar controller/sensor gains, and negative feedback `e=r−Hy`. The existing CP05 pure contour contract is a reference for a private, stateless compatible implementation. No sibling imports or shared/package changes are reserved here. A coordinated extraction into `src/shared/math` remains an integration-owner decision; it is not required to run either module independently.

## Required evidence before delivery

- [ ] Input-dependent curve, `P,N,Z`, explicit orientation, and complete closed-loop roots.
- [ ] Wrong-P feedback before the answer, unstable-open-loop and nonunit-H experiments.
- [ ] Imaginary-axis indentation procedure, critical-point boundary status, finite-contour and numerical-resolution guards.
- [ ] Independent baseline, changed-data, repeated/axis-pole and failure checks.
- [ ] Relevant tests, type/integration check, full tests and production build.
- [ ] Actual desktop/phone editing, math keyboard, invalid/recovery, reset/reopen and late-load cleanup checks.

The original Ch4/S09/E05 materials are outside Git and have not been inspected. Metadata is the starting fixture, not an independently verified source answer. Final evidence will distinguish the original anchor, separately inspected mathematical references and authored variations. Independent maintainer review and upstream CI remain pending.
