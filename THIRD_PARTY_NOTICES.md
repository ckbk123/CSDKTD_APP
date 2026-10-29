# Third-party notices

The GUI uses Raven, pinned to commit
`c4410662723bf0eec633a36a7c2e4d69490325cf`, under Apache-2.0.
Raven's upstream LICENSE, NOTICE and THIRD_PARTY.md describe its notices,
including bundled font/image components:
https://github.com/oscar-soirey/Raven/tree/c4410662723bf0eec633a36a7c2e4d69490325cf

Distributions must include the upstream license and notices. The app does
not bundle a Vulkan GPU driver. The existing university logo is separately
identified in assets/README.md.

The install directory includes full Raven, stb, Roboto and Roboto Mono
license texts in licenses/, together with Raven's NOTICE, component table
and the logo provenance. Raven's development headers and static libraries
are not part of the application package.

No numerical or symbolic library is linked into this GUI scaffold yet.
Future candidates and their upstream licenses are documented in
docs/MATH_BACKEND_OPTIONS.md.
