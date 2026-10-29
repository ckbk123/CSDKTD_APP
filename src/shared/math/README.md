# Shared mathematics

No mathematical backend is installed in this scaffold. Coordinate the first
shared numerical or symbolic service with the integration owner before adding
dependencies. Candidate research is in `docs/MATH_BACKEND_OPTIONS.md`.

Use explicit, typed inputs/results, documented coefficient and sign conventions,
caller-owned workspaces and meaningful independent fixtures. Keep DOM, routing,
current-system state and module imports out of this layer. Numerical routines
must report failure/conditioning rather than terminate or invent a result.

JavaScript/TypeScript and selected C-to-WebAssembly kernels are possible. Test
actual browser builds and library licenses before adoption. UI dependencies or
the presence of a C wrapper alone do not prove browser compatibility.
