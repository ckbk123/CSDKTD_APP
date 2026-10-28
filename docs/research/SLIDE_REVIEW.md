# Course slide review and source coverage

Prepared 28 October 2026 for instructor review. This document records the course evidence behind the proposed application scope. It does not approve features for implementation or certify the original teaching material as error-free.

## Materials and numbering

The review inventory covers **24 PowerPoint files and 882 slides**:

- The 15 reorganized teaching sessions contain 225 slides, 15 slides per session.
- The nine Vietnamese source chapters, using the `Unicode_DayDuCongThuc` variants, contain 657 slides.
- Alternate styling revisions, intermediate builds and duplicate deck variants are excluded from these totals.

The accompanying [slide inventory](SLIDE_INVENTORY.json) records the course-relative path, SHA-256, byte size, slide count and per-slide navigation title for each selected deck. Paths in this review are relative to the **parent course directory**. The course decks remain outside this application repository. No slide bodies, speaker notes, textbook files or slide media are reproduced in the inventory.

All slide numbers are **one-based package order**, including covers and contents. They are not PDF page numbers or printed chapter-page labels. References such as `03:6–11` mean session 03, slides 6 through 11. Session `NN` denotes `Tai_to_chuc_bai_giang/slides/Buoi_NN_CSDKTD.pptx`.

## Review method and limits

1. Inspect the existing course organization in `Tai_to_chuc_bai_giang/03_Ke_hoach_15_buoi.md`, `Tai_to_chuc_bai_giang/slides/README.md`, the source maps and the distilled teaching guides.
2. Read PowerPoint package XML for the selected decks, including ordinary text and Office Math text. Inspect speaker-note XML for the reorganized sessions to establish the source locators and case references. The temporary extraction used during this task is not a repository deliverable.
3. Match candidate interactions to the actual lesson content, worked examples, submission criteria and misconceptions. Use the 15-session decks as the main teaching sequence and the nine source chapters as the broader topic inventory.
4. Keep slide evidence separate from a proposed interaction. A slide that introduces a concept supports its curricular relevance; it does not establish that a particular user interface will improve learning.

This was a **content and requirements review**. It did not include opening all decks in PowerPoint, rendering every slide or visually auditing every chart, drawing and equation. Text extraction cannot establish the topology of an image-only block diagram, the meaning of a crossing wire, a graphical arrow, a superscript or a plotted curve. Math XML can split one expression into many text runs, and some source formulas still appear only as pictures. Those items require visual checking before becoming implementation examples or expected answers.

Original-deck inventory titles come from `knowledge_base/source_maps/cstd_vi_chNN_slide_map.md`. They are inferred navigation hints, not guaranteed title transcriptions. Session titles exclude the repeated course header. The inventory therefore provides a traceable locator without publishing the full extracted corpus.

Numerical values below identify useful **course fixtures stated on the slides**. Each implementation must independently reproduce the governing equation and expected result, using the associated case-bank data where available. Reading an answer from a slide is not an independent numerical check.

## Coverage of the 15-session teaching sequence

| Session and topic | Exact topic anchors | Opportunities for interaction and checks required |
|---|---|---|
| **01 — Feedback, signals and disturbances** | 4: signal roles; 5: open/closed loop; 6: classifications and ON-OFF; 7–8: normalized example; 9–11: controlled comparison; 13–14: misconception and sensor-bias exercise | Label reference, output, control and disturbance signals; compare declared open-loop and closed-loop control laws; vary gain and disturbance location; predict before simulation. The source example distinguishes tracking gain from disturbance rejection. Feedback alone must not imply zero error or stability. |
| **02 — Physical models, Laplace and transfer functions** | 4: assumptions and units; 5: zero-initial-condition Laplace relation; 6: poles/DC gain; 7–8: mass–spring–damper example; 9–11: coefficient order and model equivalence; 13–14: initial conditions | Move physical parameters and link the ODE, transfer function, polynomial coefficients, poles and response. Contrast zero-state transfer-function response with a trajectory containing initial-condition response. Detect reversed coefficient arrays explicitly. |
| **03 — Block diagrams, source channels and Mason** | 4: connection/reduction rules; 5: one source at a time; 6: Mason definitions; 7–8: nested-loop example; 9–11: two independent representations; 13–14: different source transfers and touching loops | Structured diagram editing, rule-preserving reductions, deterministic SFG conversion, selectable forward paths/loops, non-touching loop tests and stepwise determinant/cofactor construction. Solve equations from the original model independently. In the worked example the two loops touch, so their product is excluded from Mason's determinant. |
| **04 — State models and local linearization** | 4: state choice; 5: transfer-function relation; 6: equilibrium/deviation variables; 7–8: two-state model and nonlinear tank; 9–11: equivalence and small/large perturbations; 13–14: locality of approximation | Matrix/equation editing with dimension checks, linked state trajectories, coordinate interpretation, nonlinear-versus-linear response and a movable operating point/tangent. Compare absolute variables with a correctly translated deviation model. Preserve the nonlinear tank's physical domain. |
| **05 — Time and frequency behavior** | 4: time response and slow modes; 5: sinusoidal gain/phase; 6: elementary factors/delay; 7–8: common reference plant; 9–11: measurement and units; 13–14: Bode interpretation | Linked step/sine response, frequency cursor, Bode/Nyquist representations and factor contributions. Separate transient and sinusoidal steady state. Distinguish linear magnitude/dB and Hz/rad·s⁻¹. Asymptotes and exact curves should both be available. |
| **06 — Continuous stability and Routh/Hurwitz** | 4: BIBO versus internal modes; 5: Routh first column; 6: parameter regions and special cases; 7–8: gain-dependent cubic; 9–11: root checks and boundaries; 13–14: positive-coefficient counterexample | A row-by-row Routh tutor linked to poles and responses, parameter sweeps, auxiliary-polynomial/zero-leading-entry cases and a Hurwitz comparison. Analyze the closed-loop characteristic polynomial. Treat boundary values separately from asymptotic stability. |
| **07 — Steady-state error and transient quality** | 4: comparator error/final-value conditions; 5: overshoot/rise/settling conventions; 6: integral metrics; 7–8: second-order example; 9–11: consistent measurement; 13–14: approximation limits | Reference-shape and system-type exploration, adjustable settling bands, metric overlays, common-window ISE/IAE/ITSE/ITAE and comparisons of ideal second-order formulas with measured responses. A finite simulation's last sample is insufficient evidence of steady-state error. |
| **08 — Root locus and compensation** | 4: locus, angle and magnitude conditions; 5: lead/lag roles; 6: complete-order check; 7–8: compensated third-order example; 9–11: design verification; 13–14: dominant-pole limits | Gain/pole/zero manipulation, geometrical angle contributions, desired-pole targeting and linked full-order response. Display remaining poles and controller zeros. Check steady-state error and control effort after meeting a pole target. |
| **09 — Nyquist, margins and Bode design** | 4: encirclement convention/imaginary-axis poles; 5: gain/phase crossover and margins; 6: compensation tradeoffs; 7–8: before/after lead example; 9–11: common-model cross-check; 13–14: margin misconceptions | Trace a contour and its image with an explicit direction convention; link Nyquist/Bode/closed-loop poles; inspect every relevant crossover, infinite/undefined margins and post-compensation crossover movement. Time–frequency rules remain approximations whose predictions need a response check. |
| **10 — P/PI/PD/PID and practical limits** | 4: action and derivative filtering; 5: tuning process/Ziegler–Nichols; 6: saturation/windup; 7–8: P/PI/filtered-PID comparison; 9–11: consistent tuning and structure; 13–14: added-action misconceptions | Tune gains with a retained experiment log, compare error and control effort, expose the derivative-filter structure, add saturation/noise/anti-windup extensions and distinguish tuning-rule starting points from a verified design. Use the same plant and metric conventions. |
| **11 — Controllability, observability and state design** | 4: rank conditions; 5: feedback/prefilter; 6: observer error dynamics; 7–8: two-state numerical design; 9–11: eigenvalue and estimation checks; 13–14: observer interpretation | Link rank tests to accessible/observable directions, target poles, feedback gain, prefilter, true/estimated states and estimation error. Include initial-state mismatch. Verify eigenvalues of both controller and observer dynamics, rather than only plotting output tracking. |
| **12 — Sampling, ZOH and discrete models** | 4: sampling period/hold; 5: Z-transform and delay notation; 6: discrete state update; 7–8: ZOH examples/first samples; 9–11: independent recurrence; 13–14: discretization misconceptions | Move sample period, animate sampled and held signals, show continuous/discrete model links and step through a recurrence with a visible memory state. Retain the model's sample period. Changing display resolution is a different operation from changing controller updates. |
| **13 — Discrete stability, Jury and performance** | 4: unit circle and exponential mapping; 5: Jury conditions; 6: samples versus seconds; 7–8: parameterized quadratic; 9–11: roots/response checks; 13–14: negative-pole misconception | Move poles between the s and z planes, build Jury inequalities and sweep a parameter through the unit-circle boundary. Show settling in samples and seconds. Distinguish redesigning after a sample-period change from holding an existing controller fixed. |
| **14 — Discrete compensation and PID execution** | 4: plant versus controller discretization; 5: update indexing; 6: direct z design/saturation; 7–8: numerical PID recurrence and Tustin lead example; 9–11: independent representation; 13–14: memory-order and sample-period questions | Compare Euler/Tustin methods, execute controller recurrences one sample at a time and expose old/current memory values. Compare positional/incremental forms with the same initialization. Recompute coefficients when sample period changes. |
| **15 — Discrete state design and synthesis** | 4: feedback and controllability; 5: discrete observer; 6: design evidence; 7–8: numerical gains/target poles; 9–11: reproducible verification; 13–14: defending a design and changing sample period | Reuse the state-design workspace with z-plane targets and real-time units. Verify actual controller/observer eigenvalues and prefilter DC gain. Package an accumulated design with assumptions, model/sample period, metrics and a short student explanation. |

Across all sessions, slides 9–11 prescribe comparison/verification activities and slides 13–14 target misconceptions or a changed individual example. They support a shared predict–experiment–explain workflow, a stepwise reveal option and saved reproducible cases. They do not require a separate applet for every slide.

## Coverage of the nine source chapters

Each source below is `Tài liệu/ChuongN_CSTD_Unicode_DayDuCongThuc.pptx`. The source IDs match the existing course knowledge base. Ranges follow the course's 15-session allocation plan and include introductory/contents slides when part of that range.

| Source ID | Slides | Allocation and broader content retained for consideration |
|---|---:|---|
| `cstd_vi_ch01` | 1–99 | Session 01: feedback and loop roles. Retain ON-OFF, instrumentation, relay/timer/counter/PLC and application examples as optional guided recognition/logic scenarios. A complete PLC development environment is beyond what this source establishes as necessary. |
| `cstd_vi_ch02` | 1–36; 37–74; 75–124 | Sessions 02, 03 and 04 respectively: physical models/Laplace/transfer functions; diagram algebra/SFG/Mason; state models/equilibrium/linearization. The complete chapter has 124 slides. |
| `cstd_vi_ch03` | 1–54 | Session 05: impulse/step/sinusoidal behavior, elementary dynamic factors, delay, Bode construction and inverse interpretation. Include analytical and graphical views while preserving factor assumptions. |
| `cstd_vi_ch04` | 1–28; 29–54; 55–71 | Sessions 06, 08 and 09 respectively: algebraic stability; root-locus geometry/design; Nyquist and frequency stability. The complete chapter has 71 slides. |
| `cstd_vi_ch05` | 1–32; 33–42 | Session 07: error/transient/integral criteria. Session 09: approximate relationships between frequency and time behavior. Avoid presenting these relationships as universal equalities. |
| `cstd_vi_ch06` | 1–20 and 64–73; 21–45; 46–63; 74–93 | Session 10: controller actions/tuning; session 08: locus-based lead/lag/lead-lag; session 09: Bode compensation; session 11: controllability, feedback and observers. Source tuning tables require the discrepancy check below. |
| `cstd_vi_ch07` | 1–51 | Session 12: sampling/ZOH, Z-transform, pulse transfer function, difference equations and discrete state models. Transform tables and repeated canonical-form examples can become references rather than standalone simulators. |
| `cstd_vi_ch08` | 1–62 | Session 13: unit-circle stability, Jury and quality. Extended Routh, discrete root locus, bilinear mapping and discrete Bode are eligible extension lessons with explicit tasks. |
| `cstd_vi_ch09` | 1–32; 33–61 | Sessions 14 and 15 respectively: discrete controller/compensation/PID algorithms; discrete controllability/feedback/observation and verification. Preserve the difference between the controller realization used here and the filtered continuous PID of session 10. |

The six `FundCtrlSys` chapter guides provide a second navigation path: chapter 1 supports session 01; chapter 2 sessions 02–04; chapter 3 sessions 05–06 and 08–09; chapter 4 sessions 07 and 09; chapter 5 sessions 08–11; chapter 6 sessions 12–15. These PDF guides were contextual references, not additional PowerPoint decks in the 882-slide inventory.

## Worked examples that can anchor implementation checks

These are mathematical summaries of course examples, not copied slide pages. Expected results need an independent calculation before entering a test suite.

| Course anchor | Candidate fixture |
|---|---|
| 01:7–8 | For the normalized first-order plant with proportional gain 2, the reference and input-disturbance channels have numerators 2 and 1 over the same denominator `s+3`. This is a useful fixture against confusing reference tracking with disturbance rejection. |
| 02:7–8; 04:7–8; 05:7–8 | The shared plant `1/((s+1)(s+2))` connects physical modeling, ODE, state-space, poles, DC gain, step response and sinusoidal frequency response. It permits many lessons to share a single verified model. |
| 03:7–11 | The nested-loop example reduces to `1/(s^2+5s+5)`, DC gain 0.2. The two loops touch. This catches both a sign/topology error and a spurious non-touching-loop product. |
| 04:7–11 | The normalized nonlinear tank has an equilibrium at unit height/input and local deviation slope `-0.5`. Small and large excitation cases expose the limit of local linearization. |
| 06:7–9,14 | The cubic `s^3+7s^2+10s+K` has the stated asymptotic-stability interval `0<K<70`; inspect boundaries independently. The individual variant replaces 7 and 10 by 6 and 8. |
| 07:7–11 | The stated second-order example has damping ratio 0.5, natural frequency 2 rad/s, overshoot about 16.303%, unit-ramp error 0.5 and measured 2% settling about 4.039 s versus the common 4 s approximation. |
| 08:7–11 | The lead-compensated example includes a third pole as well as the desired conjugate pair. It is a useful counterexample to treating a two-pole approximation as the full response. |
| 09:7–11 | The lead example increases phase margin while leaving the ramp-error constant unchanged. This supports separate reporting of margins and steady-state performance. |
| 10:7–11 | P, PI and filtered PID share one plant and a common settling convention. The selected PI/PID settings reduce final error while taking longer to settle than the selected P case. The label of a controller does not establish superiority. |
| 11:7–11 | The two-state design supplies feedback gain, observer gain and a prefilter. Verify each matrix's eigenvalues and estimation-error trajectory independently of output tracking. |
| 12:7–11 | The first-order ZOH recurrence at `T=0.1 s` has coefficients approximately `0.90483742` and `0.09516258`. Hand-check the first several samples. |
| 13:7–11 | The Jury example has the stated interval `0<K<2.5`; the upper boundary places one pole at -1. The sign of a real discrete pole is insufficient for a stability verdict. |
| 14:7–11,14 | The incremental PID example supplies three numerical coefficients and a corresponding transfer function. A short error sequence detects updating stored errors too early. |
| 15:7–11 | The discrete state design has controller targets 0.7/0.8 and observer targets 0.3/0.4. Actual eigenvalues and sample-period metadata must accompany reported gains. |

## Source discrepancy and implementation cautions

`Tai_to_chuc_bai_giang/technical/source_discrepancies.md` records a **PI Ziegler–Nichols response-curve discrepancy**. The source `hth_ch05`, PDF page 75, prints an integral time corresponding to `0.3*T1`, while the commonly documented response-curve PI rule uses approximately `3.33*T1`. Page 74 identifies the delay convention used in that source. The course discrepancy note also distinguishes integral time from integral gain. Its source-check images remain in the course material, outside this repository.

The application must state the chosen PID structure, parameter convention and tuning-rule source. Do not copy an ambiguous table into executable rules or silently rewrite the original deck. Use a separately verified rule and retain the discrepancy as provenance until the instructor resolves it.

Other recurring requirements come directly from the slides:

- Compute each transfer channel with other independent sources set to zero and preserve the comparator's definition of error.
- Show exact cancellations explicitly. Input–output simplification does not establish the internal stability of every underlying realization.
- Handle zero-leading-entry/all-zero-row Routh cases, imaginary-axis poles and unit-circle boundaries as cases with their own conditions.
- State settling-band, rise-time, phase, frequency and integration-window conventions with results. An undefined, divergent or not-yet-measured quantity must not appear as a valid zero.
- Keep exact algebra, numerical approximations and educational asymptotes visibly distinct. Repeated roots, rank decisions and nearly canceling factors require numerical care.
- Preserve model/sample period, initial state, discretization method and recurrence update order when comparing continuous and discrete designs.
- Image recognition, hand-drawn diagram recovery, unrestricted symbolic manipulation and automatic general model identification are additional proposals, not capabilities justified as already solved by reviewing slides.

## Source locations retained for review

- `Tai_to_chuc_bai_giang/03_Ke_hoach_15_buoi.md`
- `Tai_to_chuc_bai_giang/slides/README.md`
- `Tai_to_chuc_bai_giang/technical/case_bank.json`
- `Tai_to_chuc_bai_giang/technical/source_discrepancies.md`
- `knowledge_base/source_maps/cstd_vi_ch01_slide_map.md` through `cstd_vi_ch09_slide_map.md`
- `knowledge_base/distilled/course_topic_index.md`
- `knowledge_base/distilled/chapter_01_teaching_guide.md` through `chapter_06_teaching_guide.md`

The repository stores this requirements summary and source locators. The instructor retains control over which examples, explanations and proposed interactions enter the application.
