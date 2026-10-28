# Scope changes and migration from the first draft

**28 October 2026.** The instructor requested a curriculum-first organization. Revision 2 adopts SISO LTI exclusively, with Continuous and Discrete each containing Representation, Plots, Stability, Performance and Controller Design. This file explains where earlier ideas went; it is not another feature backlog.

## Scope decisions

- Remove the SISO/MIMO choice. SISO state-space models still allow multiple internal states, scalar input/output matrices and observers.
- Remove nonlinear-model and local-linearization lessons, ON/OFF/hysteresis, actuator saturation, windup/anti-windup, switching, PLC and hardware control from the active app scope.
- Retain known linear physical models, arbitrary initial conditions, filtered LTI controllers, reference/disturbance channel selection and linear observer error dynamics.
- Keep explicit continuous and discrete delays where course exercises require them. An exact continuous-delay realization is not generally a finite-dimensional ordinary ODE/state model.
- Remove the general symbolic/trigonometric workspace and automatic diagram-image interpretation. Retain targeted polynomial/rational/Laplace/Z operations needed by the representation exercises and the structured diagram editor.
- Treat sampling/hold conversion as a declared bridge to a fixed-period discrete LTI model; do not claim a continuously viewed sampler/hold arrangement is itself a continuous LTI operator.
- Move saving, export, presets, teaching/reveal modes, accessibility and localization to shared application services rather than subject-menu entries.

The ten blocks implement the instructor's requested structure. The exercise atlas fills them with identifiable task families. Shared graphics/equation services prevent duplicated tools when root locus or frequency response serves several blocks.

## Former feature disposition

| Old ID / idea | Revision 2 home | Disposition |
|---|---|---|
| F01 shared case | Shared services and representation workspaces | Retained as foundation, not a subject feature |
| F02 algebra/poles | CR01, CP02; discrete counterparts | Retained and contextualized |
| F03 general transforms/trigonometry | CR02/CR03, DR01 | Course transforms retained; broad CAS/trig removed |
| F04 feedback/disturbance sandbox | CR04, CF02, controller exercises | Retained as scalar LTI channels |
| F05 ON/OFF/control roles | LTI signal roles within diagrams | Nonlinear/relay/PLC behavior removed |
| F06 physical-model laboratory | CR02 | Verified linear models retained |
| F07 block editor/reduction | CR04, DR04 | Retained |
| F08 automatic SFG conversion | CR05, DR04 | Retained for structured models |
| F09 Mason tutor | CR05, DR04 | Retained; independent equation check |
| F10 local linearization | None | Removed from app scope |
| F11 states/coordinates | CR03, CR06, DR03 | LTI realization/coordinate lessons retained |
| F12 response blocks | CP01–CP04, DP01/DP03 | Split by actual construction exercises |
| F13 damping/transient | CP02, CF01, DF01 | Separated plot intuition from measurement |
| F14 errors/indices | CF02/CF03, DF02/DF04 | Retained with input/time conventions |
| F15 Bode/sinusoids | CP03/CP04, DP03 | Retained; normalized factor exercises added |
| F16 Routh/Hurwitz | CS02/CS03 | Distinct regular, epsilon, zero-row and determinant tasks |
| F17 root locus | CP06, CS05 | Construction separated from stable gain conclusion |
| F18 root-locus lead/lag | CD02–CD04 | Separate lead, lag and combined design contracts |
| F19 Nyquist | CP05, CS04 | Construction separated from criterion |
| F20 margins/Bode design | CF04/CF05, CD05/CD06 | Measurement separated from synthesis |
| F21 PID/nonlinear limits | CD01, DD04 | LTI PID/filter retained; nonlinear saturation/anti-windup removed |
| F22 tuning rules | CD07 | Retained under stated linear-model assumptions; source-table discrepancy recorded |
| F23 controllability/observability | CD08/CD09, DD06/DD07 | Prerequisites within SISO state-design exercises |
| F24 state feedback | CD08, DD06 | Retained |
| F25 observer | CD09, DD07 | Retained and explicitly SISO |
| F26 sampling/aliasing/s-z | DR05, DP02 | Timing/mapping retained; broad signal-reconstruction lab removed |
| F27 sampled/ZOH conversion | DR01/DR03/DR05 | Split into transform, state and bridge exercises |
| F28 recurrence | DR02, DD04 | Retained as shared delay-memory stepper |
| F29 Jury | DS02/DS03/DS04 | Jury, bilinear Routh and gain-crossing tasks separated |
| F30 discrete response/frequency | DP01/DP03/DP04, DF01–DF04 | Organized as construction versus performance |
| F31 digital controller | DD01–DD05 | Emulation, direct design, PID execution and analytical synthesis separated |
| F32 digital state design | DD06/DD07 | Retained |
| F33 lesson/attempt modes | Shared exercise framework | Retained across workspaces |
| F34 saving/export/portfolio | Shared workspace services | Retained as supporting capability |
| F35 image recognition | None | Removed from active plan; structured diagrams remain |

## New depth added by exercise review

The deeper audit adds source-backed distinctions the first draft concealed: input derivatives when choosing states; integrator-output state construction; nonunique realizations; Routh epsilon versus all-zero row; low-order Hurwitz conditions; varying a controller coefficient rather than a pre-normalized gain; discrete sampled-cascade topology; explicit delayed plants; transformed Routh; exact versus W-plane frequency construction; physical-time ramp normalization; and analytical digital PID synthesis.

The exercise atlas includes proposed teaching variations and a few companion modes beyond a fully worked local example. Discrete Nyquist's full contour tutor and a complete discrete frequency-design sequence are explicitly marked for instructor review, rather than attributed to nonexistent worked slides. External sources provide exercise patterns, not automatically trusted numerical fixtures.
