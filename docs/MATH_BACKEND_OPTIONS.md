# Native mathematical libraries for later modules

**Research date: 29 October 2026.** This is a future implementation recommendation. The entry GUI and blank submodule containers do not need a numerical or symbolic backend, and this research does not add one to the application.

C-callable libraries cover the necessary mathematical building blocks. The application still needs its own small SISO LTI model layer, exercise explanations and plotting logic. No single candidate below is a drop-in replacement for MATLAB plus Control System Toolbox.

## Candidate comparison

| Candidate | Language/interface | Useful coverage | Application work still needed |
|---|---|---|---|
| BLAS + LAPACK, through CBLAS/LAPACKE; OpenBLAS is one implementation | C interfaces over native numerical implementations, often including Fortran | Matrix products, linear solves, eigenvalues, SVD/rank-related decompositions | SISO model objects, polynomial conventions, matrix-exponential/ZOH algorithm, controller design wrappers and teaching steps |
| SLICOT | Fortran library callable through a deliberately tested C/Fortran bridge | Control-oriented state transformations, interconnections, pole assignment, matrix exponential/integral and other control routines | ABI/workspace/error adapter, sign conventions, scalar-model API, simulation and lesson-facing derivations |
| GNU Scientific Library (GSL) | C library | Polynomial roots, complex arithmetic, eigensystems, linear algebra, quadrature and ODE routines | Exact symbolic algebra, SISO transfer/state model operations, complete control-design layer and pedagogical output |
| FLINT, including the formerly separate Arb library | C library | Exact integer/rational polynomials and matrices; real/complex ball arithmetic, root isolation and matrix functions | Mathematical-expression parser/printer, course-specific model operations and explanation steps |
| SymEngine | C++ implementation with a C wrapper | Symbolic expressions, arithmetic, differentiation and expansion through C-callable functions | Verify the exact C-wrapper coverage for each proposed operation; factorization, equivalence and control algorithms must not be assumed from the word “symbolic” |

These are alternative layers or complementary components. The proposal is not to bundle all five.

## What the official interfaces establish

### Matrix foundation

[LAPACKE](https://www.netlib.org/lapack/lapacke.html) provides high-level calls that manage work arrays and middle-level calls with caller-owned workspaces. It accepts row-major or column-major matrices. Its return values carry LAPACK status information, including some one-based indices inherited from Fortran. An application wrapper should normalize those conventions instead of exposing them to each lesson.

[OpenBLAS](https://www.openmathlib.org/OpenBLAS/docs/) implements BLAS operations and can include LAPACK/LAPACKE. Its [build options](https://github.com/OpenMathLib/OpenBLAS/blob/develop/docs/build_system.md) allow those interfaces to be omitted, so the selected package must actually contain the functions we use. This layer supplies matrix kernels; it does not by itself supply a transfer-function class, `step`, `bode` or `place` interface matching MATLAB.

### Control-oriented algorithms

The [SLICOT library index](https://www.slicot.org/objects/software/shared/libindex.html) includes SISO controllability forms, continuous/discrete bilinear conversion, state-space cascade/feedback interconnection and matrix functions. Useful candidates include:

- `SB01BD`: continuous/discrete pole assignment for a matrix pair. Its documented closed-loop convention is **A+B·F**. Our course normally uses **A−B·K**, so the adapter must handle the sign explicitly.
- `MB05ND`: matrix exponential and integral, relevant to exact ZOH state conversion.
- `AB04MD`: bilinear conversion. This is a different conversion from exact ZOH.

See the [SB01BD routine documentation](https://www.slicot.org/objects/software/shared/doc/SB01BD.html) for input, workspace and status requirements. SLICOT is written in Fortran and depends on BLAS/LAPACK. A C application can call a selected bridge, but compiler ABI, integer sizes, character arguments and array layout require a tested integration. A Fortran implementation underneath a C interface does not require the student application code to become Fortran.

### General numerical routines

[GSL](https://www.gnu.org/software/gsl/) is a broad numerical library for C/C++. Its [polynomial solver](https://www.gnu.org/software/gsl/doc/html/poly.html) computes complex roots through a balanced companion-matrix QR method. The documentation explicitly notes reduced accuracy for multiple roots. It also provides matrices, eigensystems and ODE tools.

GSL is a convenient numerical candidate if its license and packaging fit the project. It does not provide exact symbolic Mason expressions or a ready-made control-system workbench. Numerical root residuals, conditioning and solver failures still need application-level reporting.

### Exact algebra and high precision

[FLINT](https://flintlib.org/) is a C library with exact polynomial/matrix arithmetic. [Arb was merged into FLINT](https://github.com/flintlib/arb), so a new integration should evaluate current FLINT rather than treat the archived Arb repository as a separate actively developed dependency. The [Arb matrix documentation](https://github.com/flintlib/flint/blob/main/doc/src/arb_mat/index.md) describes ball-arithmetic linear solving, determinants and matrix exponentials.

This is relevant to rational polynomial identities, factor reconstruction and reliable difficult-root checks. It remains a low-level mathematics library. The application must decide how expressions with several named transfer symbols are represented, which exact domains are supported, and how to expose an explanation rather than only a final expression.

[SymEngine](https://github.com/symengine/symengine) has a documented C wrapper. Its [public C header](https://symengine.org/symengine/cwrapper_8h_source.html) exposes expression lifetime management, arithmetic and `basic_expand`, among other operations. That is useful for expression manipulation, but the presence of a C wrapper does not establish that every desired CAS operation is wrapped or available. A small proof-of-capability should precede adoption for exact Mason checking.

## License facts to record before selecting a dependency

| Upstream component | License identified by upstream |
|---|---|
| OpenBLAS | BSD 3-clause, per its [official documentation](https://www.openmathlib.org/OpenBLAS/docs/) |
| Reference LAPACK | BSD-style three-condition redistribution terms, per its [license file](https://github.com/Reference-LAPACK/lapack/blob/master/LICENSE) |
| SLICOT Reference | BSD 3-clause, per the [official repository](https://github.com/SLICOT/SLICOT-Reference) |
| GSL | GNU GPL, per the [official project page](https://www.gnu.org/software/gsl/) |
| Current FLINT | LGPL version 3 or later, per the [official project](https://flintlib.org/) |
| SymEngine | MIT for the principal library, with third-party notices in its [license file](https://github.com/symengine/symengine/blob/main/LICENSE) |

These are source-identification facts, not a complete distribution review. Record the exact pinned revision, bundled components, compiler runtimes and linkage/package choices before shipping. The project has not selected a mathematical dependency or project license in this document.

## Recommended implementation path

1. **Finish the shell without a math dependency.** Every module gets a baseline example, a content container and a lifecycle. There is no need to download or initialize a general numerical stack for empty pages.
2. **Prototype one numerical service for the first implemented module.** Start with a C-facing API for scalar polynomial evaluation/roots, small matrix solves and eigenvalues. Compare an LAPACKE-based route with GSL under the project's licensing/build preferences. Select one initially rather than maintain two interchangeable backends prematurely.
3. **Add model operations above that service.** The application owns coefficient order, transfer/state conventions, continuous/discrete metadata, exact delays, frequency evaluation and simulation. Exact ZOH needs a suitable matrix-exponential method; it cannot depend exclusively on an inverse of A because A may be singular.
4. **Evaluate selected SLICOT routines when state/control design begins.** A tested pole-placement and transformation adapter may be more appropriate than implementing every numerical algorithm from scratch. The observer can use the appropriate dual pole-placement problem, with its sign/timing conventions verified separately.
5. **Choose a separate exact-algebra route when Mason/representation work begins.** Compare a restricted exact rational-polynomial layer using FLINT with a SymEngine-backed expression layer. Include multi-symbol rational identities and reconstruction checks in the trial. Broad symbolic support should not be inferred from a handful of successful expansions.

Numerical algorithms can be shared without sharing lesson state. Each module owns its inputs, temporary matrices, solver workspaces and results. It calls reusable services with explicit arguments and receives results/errors. A backend should not retain a mutable “current system” shared by unrelated modules.

The shell's `mount`/`unmount` contract is also the place to allocate and release module-owned workspaces later. Returning to a module should restore its baseline for the session behavior requested by the instructor. No saved-project requirement follows from using mathematical libraries.

## Independent modules do not imply isolated processes

Separate C static libraries and private per-module state make changes easier to reason about. They do not provide memory isolation: a C out-of-bounds write in one linked module can still corrupt the process. Module boundaries should therefore be reinforced by narrow interfaces, ownership rules, compiler diagnostics and targeted tests as functionality is added. The requested single-window design does not require loading a separate DLL or spawning a process for every lesson.

Use each library's status/error handling through an adapter. In particular, avoid process-wide settings or an error path that terminates the whole application during a recoverable lesson calculation. Shared numerical thread pools/settings must be controlled by the application rather than changed unpredictably by each module.

## Verification and deployment gates

For the first mathematical slice, validate a known polynomial, repeated/near roots, the mechanical state realization, ZOH with singular A, a controllability/observability example, and actual closed-loop/observer eigenvalues. For exact algebra, verify reconstruction and rational equivalence independently. Show exact, approximate and inconclusive results distinctly.

No library above has been built, benchmarked or certified on this project's requested Windows 7/8/10/11, Linux or macOS targets during this research. Their language/interface portability does not establish compatibility of a particular prebuilt package. Check CPU instruction requirements, integer ABI, runtime dependencies, OS imports and thread settings. Measure package size, startup, memory and interaction latency on named machines; native code does not guarantee a tiny distribution.

The existing [platform assessment](PLATFORM_FEASIBILITY.md) remains the baseline for those tests. The new entry shell demonstrates UI/navigation work only; it does not certify the eventual numerical dependencies or all target operating systems.
