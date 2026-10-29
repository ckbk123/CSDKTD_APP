# Control Studio design contract

**Selected identity, 29 October 2026.** This document records the approved application name, palette, mark and compact interface. Module contributors use this contract so independently implemented tools still belong to one application. Mathematical feature scope remains in the atlas; the 56 workspaces are scaffolds until implemented and verified.

## Name and identity

The student-facing name is **Control Studio**. The mark is a minimal **pole/zero cross and open ring**, supplied as [public/control-studio.svg](../public/control-studio.svg). Use it as the favicon and the 32 px header mark. Keep its silhouette readable at small sizes; do not replace it with a response curve, block diagram, monogram or university logo.

The repository name remains `CSDKTD_APP`; the package and Cloudflare deployment name remain `csdktd-app`. Module IDs and course/history references do not change. Existing CSDKTD references may identify the course/repository; new application-facing text uses Control Studio.

## Indigo + slate palette

Use the shared interface tokens rather than introducing module-specific brand palettes. The selected values are:

| Role | Light | Dark media preference |
|---|---|---|
| Accent | `#4F46E5` | `#C3BEFF` |
| Background | `#F7F7FC` | `#14131D` |
| Surface | `#FFFFFF` | `#201F2B` |
| Tint / selected surface | `#ECEBFF` | `#37305F` |
| Primary text | `#25253B` | `#E8E5F3` |
| Muted text | `#62617A` | `#B7B4CC` |
| Line / border | `#DEDEED` | `#454257` |

The dark variant follows the system media preference; it does not add a saved theme preference. Use readable contrast and visible focus states. Future mathematical plot colors need semantic labels and shape/line alternatives, and should be coordinated through the shared design rather than becoming competing application palettes.

## Compact header and navigation

- Header height: **64 px**, with a **32 px** mark and a compact two-line name block.
- First line: **Control Studio**. Second line: **`v<package.version> · Cao Kha Bao Khanh`**. Read the version directly from `package.json`; version changes must not require separately editing the header string.
- Catalogue search lives in the header and remains functional. On small screens, a search icon opens the compact search control without forcing the brand into a large banner.
- The sidebar is light and quiet, using subtle tonal selection instead of a navy navigation slab. Continuous/Discrete and the five subject groups remain the navigation hierarchy.
- Main surfaces are restrained: soft outlined cards, clear whitespace, readable labels and useful hierarchy. Use the selected tint for emphasis rather than gradients or heavy decoration.
- HCMUT/EE2019 institutional credit belongs in the footer, with the preserved [university PNG](../public/hcmut.png). It does not compete with the application identity in the header.

Keep the interface compact and familiar. Do not add slogans, promotional copy, decorative charts, fake results or plots that appear to demonstrate mathematics the module does not compute. Blank workspaces remain honest scaffolds until their actual tools are implemented.

## Equations

Use textbook-style equations and the shared [visual equation input](EQUATION_INPUT.md). Fractions have a numerator and denominator, powers/subscripts use their proper positions, and matrices retain rows and columns. Students should be able to use ordinary keys, symbol buttons and the math keyboard without learning MATLAB syntax or LaTeX. Raw syntax is an internal interchange format, not the primary interface.

The default-example banner typesets all 56 curated baselines. Its **Edit equations** button opens a temporary notation preview; it clearly states that edits do not update the still-empty workspace. Actual teaching tools place the same shared input inside their own workspace and validate its mathematical meaning before calculating. Keep prose, units and assumptions next to the equation rather than burying them inside an editable formula.

## Module consistency

Modules fill their existing content container and respect the shared header/navigation. They do not add a second application header or move global search. Scope styles with CSS modules or the assigned `[data-module="ID"]` root and use the shared palette/spacing conventions. Keep numeric controls, units, equations and plot labels readable on narrow screens and with keyboard input.

Coordinate changes to the name, mark, palette, header or shared navigation with the integration owner. A single module assignment does not authorize a separate visual identity. The product still has no persistence, accounts, project saving, export workflow or service worker in this release.
