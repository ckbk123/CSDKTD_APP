# Instructor feature review

All 35 entries are proposals. **No feature has been approved by this sheet.** Edit the decision and customization columns after reading the linked specification.

Decision vocabulary: **Keep**, **Revise**, **Defer**, **Omit**, or **Pending**. A Core recommendation means the author considers it foundational; it is not mandatory approval. Effort labels are relative judgments, not estimates.

For a revision, describe the interaction you want, what the student must do before seeing an answer, the required mathematical conventions and a representative example. You can accept one part of a feature and defer another.

## Review table

| ID | Proposed functionality | Recommendation | Decision | Instructor customization / acceptance example |
|---|---|---|---|---|
| [F01](FUNCTIONAL_SPECIFICATION.md#f01) | Shared case, parameter and representation workspace | Core | Pending | |
| [F02](FUNCTIONAL_SPECIFICATION.md#f02) | Polynomial, rational-expression and pole/zero workbench | Core and an explicit discussion requirement | Pending | |
| [F03](FUNCTIONAL_SPECIFICATION.md#f03) | Targeted transforms, partial fractions and trigonometric forms | Extension, with selected Laplace operations useful earlier | Pending | |
| [F04](FUNCTIONAL_SPECIFICATION.md#f04) | Feedback, tracking and disturbance sandbox | Core | Pending | |
| [F05](FUNCTIONAL_SPECIFICATION.md#f05) | Control roles, ON/OFF and hysteresis demonstrations | Course; richer relay/PLC examples are extensions | Pending | |
| [F06](FUNCTIONAL_SPECIFICATION.md#f06) | Physical model and ODE laboratory | Core | Pending | |
| [F07](FUNCTIONAL_SPECIFICATION.md#f07) | Structured block-diagram editor and algebra trainer | Core flagship foundation | Pending | |
| [F08](FUNCTIONAL_SPECIFICATION.md#f08) | Automatic block-diagram to signal-flow conversion | Core flagship | Pending | |
| [F09](FUNCTIONAL_SPECIFICATION.md#f09) | Mason rule tutor and independent answer checker | Core flagship | Pending | |
| [F10](FUNCTIONAL_SPECIFICATION.md#f10) | Equilibrium and local linearization laboratory | Course | Pending | |
| [F11](FUNCTIONAL_SPECIFICATION.md#f11) | State equations, coordinates and phase portrait | Course; coordinate animation and general phase portraits are extensions | Pending | |
| [F12](FUNCTIONAL_SPECIFICATION.md#f12) | Canonical dynamic blocks and linked responses | Core | Pending | |
| [F13](FUNCTIONAL_SPECIFICATION.md#f13) | Second-order poles, damping and transient specifications | Core and a good first UI prototype | Pending | |
| [F14](FUNCTIONAL_SPECIFICATION.md#f14) | System type, steady-state error and performance comparison | Course | Pending | |
| [F15](FUNCTIONAL_SPECIFICATION.md#f15) | Sinusoidal response and construction of Bode plots | Core | Pending | |
| [F16](FUNCTIONAL_SPECIFICATION.md#f16) | Routh, Hurwitz and stability parameter regions | Course with high explanatory value | Pending | |
| [F17](FUNCTIONAL_SPECIFICATION.md#f17) | Root-locus construction and gain selection | Course | Pending | |
| [F18](FUNCTIONAL_SPECIFICATION.md#f18) | Lead, lag and lead–lag design in the pole plane | Course | Pending | |
| [F19](FUNCTIONAL_SPECIFICATION.md#f19) | Nyquist contour, mapping and stability argument | Course; full contour special cases can follow a basic version | Pending | |
| [F20](FUNCTIONAL_SPECIFICATION.md#f20) | Bode margins and frequency-domain compensator design | Course | Pending | |
| [F21](FUNCTIONAL_SPECIFICATION.md#f21) | PID tuning, filtering, noise and actuator limits | Course with high interactive value | Pending | |
| [F22](FUNCTIONAL_SPECIFICATION.md#f22) | Guided tuning rules and identification from a response curve | Extension | Pending | |
| [F23](FUNCTIONAL_SPECIFICATION.md#f23) | Controllability and observability laboratory | Course | Pending | |
| [F24](FUNCTIONAL_SPECIFICATION.md#f24) | State feedback, pole placement and reference prefilter | Course | Pending | |
| [F25](FUNCTIONAL_SPECIFICATION.md#f25) | Continuous Luenberger observer | Course | Pending | |
| [F26](FUNCTIONAL_SPECIFICATION.md#f26) | Sampling, aliasing and linked s/z pole planes | Course for sampling and mapping; aliasing is an extension of the condensed session | Pending | |
| [F27](FUNCTIONAL_SPECIFICATION.md#f27) | ZOH, Z transform and discrete model conversion | Course | Pending | |
| [F28](FUNCTIONAL_SPECIFICATION.md#f28) | Difference-equation and memory stepper | Course | Pending | |
| [F29](FUNCTIONAL_SPECIFICATION.md#f29) | Jury table, unit-circle stability and gain regions | Course | Pending | |
| [F30](FUNCTIONAL_SPECIFICATION.md#f30) | Discrete response, frequency response and quality | Course; full discrete root locus/Bode design is an extension | Pending | |
| [F31](FUNCTIONAL_SPECIFICATION.md#f31) | Digital PID and compensator implementation | Course | Pending | |
| [F32](FUNCTIONAL_SPECIFICATION.md#f32) | Discrete state feedback and observer | Course after F23–F27 | Pending | |
| [F33](FUNCTIONAL_SPECIFICATION.md#f33) | Guided activities, student attempts and instructor presets | Core teaching framework | Pending | |
| [F34](FUNCTIONAL_SPECIFICATION.md#f34) | Comparison, export and accumulated design portfolio | Core for saving; richer reports are Course | Pending | |
| [F35](FUNCTIONAL_SPECIFICATION.md#f35) | Assisted import of existing diagram images | Extension; valuable but a separate recognition problem | Pending | |

## Product decisions

| Decision | Proposed starting point | Instructor decision / notes |
|---|---|---|
| Course structure | Shared model workspace with guided session presets | |
| First prototype | A small pole/response slice to test UI and mathematics | |
| Distinctive first teaching workflow | Structured block diagram, SFG conversion and Mason checking | |
| Windows coverage | Investigate 7 SP1, 8, 8.1, 10 and 11 on named hardware early | |
| Legacy graphics | Decide whether a real fallback renderer is necessary | |
| Linux/macOS | Named Linux baseline; separate Intel/Apple Silicon feasibility milestones | |
| Mathematics | Exact rational/polynomial subset plus numerical roots and selected matrix methods | |
| Language | Vietnamese student labels, English option and editable terminology | |
| Answer reveal | Explore and attempt-first guided modes | |
| Local data | Offline core, portable local cases; no required account | |
| Measurement conventions | Explicit 2%/5% settling bands, chosen rise-time and frequency units | |
| PID conventions | Agree parallel/standard form, filtering, discretization and anti-windup | |
| Diagram imports | Structured input first; manual tracing before automatic recognition | |
| Export | Project file, CSV and images first; choose readable report format | |
| Licensing | Select project license and evaluate dependencies before incorporating code | |

## Review notes

- Features required for the first usable version:
- Features useful in class but optional for self-study:
- Features students should attempt manually before asking the app to check:
- Slide examples or naming conventions that must be followed:
- Features to remove from the proposal:
- Additional examples and constraints:

## What happens after review

The next plan should translate accepted features into a small buildable release, including only their mathematical, UI and platform prerequisites. Unreviewed ideas stay in this catalog rather than becoming implicit commitments.
