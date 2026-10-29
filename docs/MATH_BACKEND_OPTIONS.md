# Mathematical backend options for browser modules

**Architecture revision 4, 29 October 2026. Library research date: 29 October 2026.** The active application is a static Vite/TypeScript browser application without a UI framework. Its first release supplies 56 independent lazy workspace scaffolds; their educational mathematics remains pending. Every future student calculation runs on the client. No numerical or symbolic dependency is selected by this document.

The recommended starting point is a small, stateless TypeScript mathematics layer under `src/shared/math/` when an implemented exercise needs it. It must specify coefficient order, model conventions, numerical errors and exact-algebra boundaries. Module state stays local to its synchronous mount; there is no shared mutable current system or persistent project model.

The native-interface facts below are retained from the earlier research because selected algorithms may later be useful through a **math-only WebAssembly build**. A native C/Fortran/C++ library, a C wrapper or a successful desktop build does not establish browser compatibility. WebAssembly build feasibility, binary size, initialization, lifetime handling, license terms and numerical coverage all require evaluation. There are no Raven types or native-window APIs in the browser module interface, and none of these candidates currently runs in the app.

## Candidate comparison

| Candidate | Language/interface | Useful coverage | Application work still needed |
|---|---|---|---|
| BLAS + LAPACK, through CBLAS/LAPACKE; OpenBLAS is one implementation | C interfaces over native numerical implementations, often including Fortran | Matrix products, linear solves, eigenvalues, SVD/rank-related decompositions | SISO model objects, polynomial conventions, matrix-exponential/ZOH algorithm, controller design wrappers and teaching steps |
| SLICOT | Fortran library callable through a deliberately tested C/Fortran bridge | Control-oriented state transformations, interconnections, pole assignment, matrix exponential/integral and other control routines | ABI/workspace/error adapter, sign conventions, scalar-model API, simulation and lesson-facing derivations |
| GNU Scientific Library (GSL) | C library | Polynomial roots, complex arithmetic, eigensystems, linear algebra, quadrature and ODE routines | Exact symbolic algebra, SISO transfer/state model operations, complete control-design layer and pedagogical output |
| FLINT, including the formerly separate Arb library | C library | Exact integer/rational polynomials and matrices; real/complex ball arithmetic, root isolation and matrix functions | Mathematical-expression parser/printer, course-specific model operations and explanation steps |
| SymEngine | C++ implementation with a C wrapper | Symbolic expressions, arithmetic, differentiation and expansion through C-callable functions | Verify the exact C-wrapper coverage for each proposed operation; factorization, equivalence and control algorithms must not be assumed from the word “symbolic” |

These are potential future algorithm sources, not approved browser dependencies. The proposal is not to bundle all five. The table describes native upstream capabilities; WebAssembly availability is not assumed.

## Retained research: what the upstream interfaces establish

### Matrix foundation

[LAPACKE](https://www.netlib.org/lapack/lapacke.html) provides high-level calls that manage work arrays and middle-level calls with caller-owned workspaces. It accepts row-major or column-major matrices. Its return values carry LAPACK status information, including some one-based indices inherited from Fortran. An application wrapper should normalize those conventions instead of exposing them to each lesson.

[OpenBLAS](https://www.openmathlib.org/OpenBLAS/docs/) implements BLAS operations and can include LAPACK/LAPACKE. Its [build options](https://github.com/OpenMathLib/OpenBLAS/blob/develop/docs/build_system.md) allow those interfaces to be omitted, so the selected package must actually contain the functions we use. This layer supplies matrix kernels; it does not by itself supply a transfer-function class, `step`, `bode` or `place` interface matching MATLAB.

### Control-oriented algorithms

The [SLICOT library index](https://www.slicot.org/objects/software/shared/libindex.html) includes SISO controllability forms, continuous/discrete bilinear conversion, state-space cascade/feedback interconnection and matrix functions. Useful candidates include:

- `SB01BD`: continuous/discrete pole assignment for a matrix pair. Its documented closed-loop convention is **A+B·F**. Our course normally uses **A−B·K**, so the adapter must handle the sign explicitly.
- `MB05ND`: matrix exponential and integral, relevant to exact ZOH state conversion.
- `AB04MD`: bilinear conversion. This is a different conversion from exact ZOH.

See the [SB01BD routine documentation](https://www.slicot.org/objects/software/shared/doc/SB01BD.html) for input, workspace and status requirements. SLICOT is written in Fortran and depends on BLAS/LAPACK. A native C application can call a selected bridge, but compiler ABI, integer sizes, character arguments and array layout require tested integration. A browser integration would additionally need a proven WebAssembly toolchain and a narrow TypeScript adapter. No working SLICOT/WebAssembly bridge is established here.

### General numerical routines

[GSL](https://www.gnu.org/software/gsl/) is a broad numerical library for C/C++. Its [polynomial solver](https://www.gnu.org/software/gsl/doc/html/poly.html) computes complex roots through a balanced companion-matrix QR method. The documentation explicitly notes reduced accuracy for multiple roots. It also provides matrices, eigensystems and ODE tools.

GSL is a numerical algorithm candidate if a future browser build, license and packaging fit the project. It does not provide exact symbolic Mason expressions or a ready-made control-system workbench. Numerical root residuals, conditioning and solver failures still need application-level reporting.

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

## Browser-first implementation path

1. **Keep the shell mathematical-dependency free.** Eagerly load immutable catalogue metadata only. Import a workspace implementation when selected, then synchronously mount it into the current page. The 56 scaffolds do not demonstrate completed solvers.
2. **Implement one client-side mathematical slice when its exercise is agreed.** Begin with stateless TypeScript inputs/results, explicit errors and reference cases. Selected evaluation, small matrices or plotting calculations may need little code; robust roots, exact algebra or matrix functions may justify a dependency. Do not assume every algorithm is either trivial or supplied by one package.
3. **Keep the SISO model conventions in the application layer.** Coefficient order, continuous/discrete domain, delays, transform rules, sample period and numerical tolerances must remain explicit. Exact ZOH needs a suitable matrix-exponential method; it cannot rely exclusively on `A^-1` when A may be singular.
4. **Evaluate browser libraries and optional C/WebAssembly only for a demonstrated need.** Compare actual operation coverage, correctness, download/initialization cost, memory ownership and license requirements. A small adapter may expose a selected native algorithm through WebAssembly. Build and test it in the browser before adopting it; a native API feature list is insufficient evidence.
5. **Evaluate exact algebra separately from floating-point numerics.** Mason's symbolic identities need a defined rational/polynomial domain. Expansion alone does not prove factorization, multi-symbol rational equivalence, assumptions or complete CAS coverage. Compare against independently generated fixtures and return explicit unsupported/inconclusive results where necessary.

A TypeScript adapter should hide any future WebAssembly-specific pointers, allocation and ABI details from lesson code. The public module lifecycle stays browser-native:

```ts
mount({ container, signal }): void | (() => void)
```

`mount` initializes local state synchronously and may return synchronous cleanup. A later lazy backend or asynchronous calculation starts within that visit, honors the signal, and rejects stale results before touching the DOM. The shell aborts the active signal and invokes cleanup before leaving or resetting; a superseded workspace import never mounts. Reset remounts from the baseline. There is no separate native `unmount` callback, C module host or per-tool static-library target in this interface.

Backend-specific asynchronous initialization does not make `mount` return a promise. If initialization is necessary later, show a local loading/error state, register cleanup immediately, and publish results only while the visit remains current. Large client calculations may eventually use a worker after explicit evaluation; no server calculation is part of the product.

## Independent modules and shared services

Each module owns its input values, temporary matrices, solver workspaces, comparison/reveal state and results for one visit. Shared helpers accept explicit arguments and return values or errors. They do not retain a mutable current plant/controller that couples tools. Workspaces live in the same browser page and are not security/process-isolation boundaries.

Module styles stay scoped through CSS modules or the shell's `data-module="CR01"`-style root rather than global selectors. Event listeners, timers, observers and any future worker or WebAssembly workspace are released through the visit signal and returned cleanup. A math adapter must turn recoverable calculation failures into module feedback instead of corrupting another workspace or the shell.

The first release has no accounts, persistence, save/load, project files, export or service worker. Browser execution does not itself make an application available offline: this static application has no service-worker/offline-cache feature in the initial scope.

## Verification and deployment gates

When a mathematical module is implemented, validate a known polynomial, repeated/near roots, the mechanical realization, ZOH with singular A, controllability/observability, and actual closed-loop/observer eigenvalues as applicable. Exact algebra needs independent reconstruction and rational-equivalence checks. Distinguish exact, approximate and inconclusive outputs. The existing slide/worksheet examples define exercise targets, not a claim that the browser scaffolds compute them.

No native candidate above has been compiled to WebAssembly, integrated, benchmarked or certified for this browser application during this research. Verify compiler/runtime requirements, wasm32 integer/pointer assumptions, allocation and cleanup, and any threading requirements. Measure the shipped static assets, module/backend load and startup time, memory and interaction latency on named browsers and devices. Lazy workspaces should not pull a whole optional mathematical stack into the eager catalogue bundle.

Browser compatibility is determined by the emitted build, DOM/JavaScript/WebAssembly features actually used, and supported browser versions. It is not determined by the historical Windows/Linux/macOS Vulkan matrix. The earlier [native platform assessment](history/PLATFORM_FEASIBILITY_NATIVE.md) is retained for provenance. Vite build tooling runs on a development computer; students need a compatible browser for the delivered static application, with no C compiler, Raven or Vulkan SDK prerequisite.

Use `npm run check` for TypeScript checking and `npm test` for the configured Vitest run; test files use `*.test.ts`. Passing shell/lifecycle checks establishes navigation behavior, not the correctness of future exercise algorithms or every possible browser. Add focused mathematical tests when actual calculation code is introduced.
