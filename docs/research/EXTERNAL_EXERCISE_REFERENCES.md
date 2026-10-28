# External exercise patterns for the SISO LTI course

Research checked 28 October 2026. This document supports the revised **Continuous / Discrete**, then **System Representation / Plots / Stability / Performance / Controller Design** organization. It records actual tasks found in university or author materials, then proposes how our application could make their reasoning visible. It does not add every topic found externally to the course.

The cited pages and PDFs were read as source material. Their software was not executed, their answers were not adopted as implementation fixtures, and complete problem statements are not reproduced here. The proposed interactions are design suggestions. Course matches below refer to the already reviewed CSDKTD session topics; the continuous/discrete course audits provide the exact local exercise anchors.

## Exercise patterns

### E01 — Compare responses with identical poles and different zeros

**Verified source:** MIT 16.06, **Recitation 2, problems 1–3**, [problem-solving notes](https://ocw.mit.edu/courses/16-06-principles-of-automatic-control-fall-2012/82a3a9b474b86097dda269af65cd26a4_MIT16_06F12_Recitation_2.pdf).

The notes compare a second-order step response with variants containing a left-half-plane or right-half-plane zero. They connect the extra numerator term to a derivative contribution.

**Course location:** Continuous → Plots and Performance. Matches CSDKTD sessions 05 and 07 and the full-order checks in session 08.

**Tool adaptation:** lock the denominator, move the zero, and ask the student to predict rise direction, overshoot and relative smoothness before revealing curves. Show the base response and derivative contribution separately, with pole markers unchanged. The checker should reject “same poles means identical transient response.” Distinguish a standard second-order formula from the actual response with the zero.

### E02 — Derive the full stable gain interval, not one successful gain

**Verified source:** MIT 16.06, **Recitation 3, Part 1**, [Routh notes](https://ocw.mit.edu/courses/16-06-principles-of-automatic-control-fall-2012/9fad6707ac033c1fd154bef9ba24e854_MIT16_06F12_Recitation_3.pdf).

Students classify gain regions and count right-half-plane roots through first-column signs.

**Course location:** Continuous → Stability. Matches session 06 and gain selection in session 08.

**Tool adaptation:** each Routh inequality marks a boundary on a common gain axis. Students intersect the intervals, then test roots on either side. A swept plot illustrates the answer; inequality derivation establishes the complete interval. Endpoint handling remains separate.

### E03 — Diagnose special Routh rows

**Verified source:** the same MIT **Recitation 3, Parts 2–3**.

These parts distinguish a zero leading entry from an entirely zero row.

**Course location:** Continuous → Stability.

**Tool adaptation:** the student chooses the epsilon or auxiliary-polynomial treatment. Highlight why the other treatment does not apply, then show sign limits and roots. Include repeated roots and imaginary-axis roots as distinct outcomes. These deserve dedicated modes inside the Routh tool, rather than a generic error message.

### E04 — Construct a Bode diagram from factors

**Verified source:** MIT 16.06, **Recitation 6**, [Bode diagram notes](https://ocw.mit.edu/courses/16-06-principles-of-automatic-control-fall-2012/4bdc391d26febf38f24ea8c0d8376c69_MIT16_06F12_Recitation_6.pdf).

The worked task normalizes a rational expression, locates corners and builds magnitude/phase sketches from pole/zero contributions.

**Course location:** Continuous → System Representation and Plots. Matches session 05 and the original frequency-response chapter.

**Tool adaptation:** the learner first rewrites factors into normalized form, places corner markers and supplies slopes. Reveal individual contributions before their sum and finally the exact curve. Use one cursor to compare approximation error at a chosen frequency. Preserve the normalization gain so a correct shape with the wrong vertical offset receives a precise diagnosis.

### E05 — Infer Nyquist behavior from Bode data and count unstable poles

**Verified source:** MIT 16.06, **Recitation 7**, [Nyquist notes](https://ocw.mit.edu/courses/16-06-principles-of-automatic-control-fall-2012/e2197ab14e787caa2978d18cbd813bea_MIT16_06F12_Recitation_7.pdf).

The notes connect Bode sketches to Nyquist curves, then use encirclements and the open-loop unstable-pole count to classify closed-loop stability.

**Course location:** Continuous → Plots and Stability. Matches session 09.

**Tool adaptation:** synchronize a selected frequency across Bode magnitude, phase and the complex curve. Ask students to predict the mapped point and winding count. Display the chosen sign convention and independently computed closed-loop poles. Avoid treating a positive-frequency sketch as the full contour. Source sketches explicitly need not be to scale; a teaching fixture should be generated from verified equations rather than copied from sketch pixels.

### E06 — Repair steady-state error without overlooking the extra slow pole

**Verified source:** CTMS, [DC Motor Speed: Root Locus Controller Design](https://ctms.engin.umich.edu/CTMS/?example=MotorSpeed&section=ControlRootLocus), sections **Adding a lag controller** and **Finding the loop gain with a lag controller**. The search-accessible page text was reviewed; a subsequent direct open returned 403.

The example adds lag compensation for an error requirement, then shows why meeting a desired conjugate-pole region can still miss the settling requirement when another pole dominates.

**Course location:** Continuous → Controller Design, using Stability and Performance tools. Matches sessions 07–08.

**Tool adaptation:** show all poles, the controller zero and full-order response. Let students compare their dominant-pair prediction with measured settling. Require an explanation of the slow mode before retuning gain or moving the lag pair. This supports an iterative design exercise rather than a single “calculate controller” action.

### E07 — Combine frequency-domain transient and steady-state requirements

**Verified source:** MIT 16.06, **Recitation 9**, [lead/lag design notes](https://ocw.mit.edu/courses/16-06-principles-of-automatic-control-fall-2012/dafc6b8f9a3f3c16b8775ab56573f4de_MIT16_06F12_Recitation_9.pdf).

The worked design places lead corners around a crossover, sets gain from the magnitude condition, then adds lag for a low-frequency error requirement and revisits phase allowance.

**Course location:** Continuous → Controller Design and Performance. Matches session 09.

**Tool adaptation:** maintain a requirement checklist beside the Bode plot. Students change one compensator term and see which requirements improve or worsen. Recompute crossover and final margins after each change. The PDF's first-page target text is inconsistent between its opening and subsequent calculation, so do not copy its numerical target as an approved fixture without reconciliation. The exercise pattern remains useful.

### E08 — Recover unmeasured states from a scalar measurement

**Verified source:** Xu Chen, University of Washington, [Continuous-Time Luenberger Observer Design](https://faculty.washington.edu/chx/teaching/python/continuous-time-observer-design/), **Steps 1–5**.

The tutorial uses a three-state DC motor with one voltage input and one position output. It checks observability, places observer poles and compares state estimates with actual trajectories.

**Course location:** Continuous → Controller Design, with representation/rank prerequisites. Matches session 11.

**Tool adaptation:** reveal the measured output separately from internal simulated truth. Let students change the estimated initial state, place estimator poles, and inspect innovation and estimation error. Check the actual eigenvalues of `A-LC`. This remains SISO despite its state vector: one actuator/input and one measured output do not restrict the model to one state. Do not infer a new physical measurement from an observer estimate.

### E09 — Derive a difference equation and explain a frequency-response zero

**Verified source:** MIT 2.171, **Final Exam, Problem 1(a–d)**, [exam PDF](https://ocw.mit.edu/courses/2-171-analysis-and-design-of-digital-control-systems-fall-2006/f26f36f1d5cdec9836e2c680a0eb4cb0_final.pdf).

The problem starts from a finite impulse sequence and asks for its transfer expression, recurrence and frequency behavior.

**Course location:** Discrete → System Representation and Plots. Matches sessions 12–13.

**Tool adaptation:** animate delayed input contributions and their sum. At a frequency-response zero, show sample terms canceling. Make DC normalization explicit: a moving sum and a normalized moving average have different gain.

### E10 — Follow one sampled plant through representation, stability and design

**Verified source:** the same MIT **Final Exam, Problem 2(a–g)**.

Its tasks connect a ZOH equivalent, pole mapping, discrete Bode/root-locus/Nyquist analysis and lead design.

**Course location:** all five Discrete blocks, chiefly sessions 12–14.

**Tool adaptation:** retain one model across stages, requiring each stability conclusion to agree with the full pole set. Treat the provided fixed LTI model as the subject; a nonlinear magnetic-suspension simulator is outside scope. Add a frequency/crossover requirement only after stability has been established.

### E11 — Test a controller designed by continuous emulation

**Verified source:** MIT 16.06, **Recitation 12**, [discrete-controller emulation notes](https://ocw.mit.edu/courses/16-06-principles-of-automatic-control-fall-2012/5e824afd8ad84569e270baf48ce45f8f_MIT16_06F12_Recitation_12.pdf).

The design accounts for sampling/hold phase and then revises its initial compensator after checking the response.

**Course location:** Discrete → Controller Design and Performance, bridged from Continuous design. Matches sessions 12–14.

**Tool adaptation:** place the continuous design, chosen conversion method and actual sampled closed-loop result side by side. Ask students to explain why an estimated phase-margin/overshoot relationship did not settle the complete design. Changing `T` must declare whether the controller stays fixed or is redesigned. Continuous emulation and direct `z`-plane design should be named separate methods.

### E12 — Derive sampled ramp error with the sample period included

**Verified source:** MIT 16.06, **Recitation 13**, [discrete steady-state-error notes](https://ocw.mit.edu/courses/16-06-principles-of-automatic-control-fall-2012/b1c883836955c2d9740607a9a74a827b_MIT16_06F12_Recitation_13.pdf).

The notes derive discrete step/ramp error and include the sample period in the ramp-error constant, then discuss a bilinear transformation.

**Course location:** Discrete → Performance, with Representation support. Matches session 13 and the original discrete-quality sections.

**Tool adaptation:** compare `r[k]=k` with a unit-slope physical ramp `r[k]=kT`. Highlight the different sequence scaling and units while taking the limit at `z=1`. The checker should catch a missing `T` factor, and should check final-value conditions before reporting a finite error. A curve drawn against sample index must not silently be interpreted against seconds.

## Implications for the application hierarchy

These sources support **exercise modes inside a small set of concept tools**, rather than a separate application for every problem. For example, the Routh tool needs gain-region, epsilon-entry and auxiliary-polynomial modes; the time-response tool needs canonical-response and zero/dominant-pole comparison modes. Root-locus visualization belongs in Plots, while using it to establish a stable gain range belongs in Stability, and adding a compensator belongs in Controller Design. These contexts should share the same model and plot engine.

The external patterns identify missing explanatory affordances: contribution decomposition, student-placed corners, complete gain intervals, wrong-method diagnoses, sample-memory stepping, actual versus predicted requirements, and pole estimates checked against the resulting dynamics. A generic slider and a final answer do not cover those tasks.

## Sources deliberately not treated as validated exercises

- [MIT 16.06 Recitation 1](https://ocw.mit.edu/courses/16-06-principles-of-automatic-control-fall-2012/73db4620a30a8f23e28a4e5cc3fa3d03_MIT16_06F12_Recitation_1.pdf) was inspected but uses dead-zone/piecewise nonlinear behavior. It is excluded from the revised SISO LTI feature scope.
- [UW's discrete observer page](https://faculty.washington.edu/chx/teaching/python/discrete-time-observer-design/) currently contains only “TBA.” Its title is not evidence of a worked discrete observer exercise. Local session 15 examples should supply that tool's exercise basis.
- Some CTMS introduction/frequency/state-space URLs returned 403. This review does not claim their unavailable bodies were read. The motor-speed lag entry above is explicitly identified as search-accessible page text.
- Broad state-space material can contain MIMO, optimal control, nonlinear models or stochastic estimators. Those topics are not imported into this plan merely because they appear beside an appropriate SISO example.

External work provides comparison and exercise patterns. App lesson statements should be authored for this course using verified equations and instructor-approved fixtures, with attribution and any reuse terms addressed before incorporating source assets or code.
