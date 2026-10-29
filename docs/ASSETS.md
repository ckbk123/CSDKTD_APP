# Control Studio identity assets

## Application mark

[public/control-studio.svg](../public/control-studio.svg) is the project-authored, minimal vector mark for **Control Studio**. A cross represents a pole and an open ring represents a zero. It uses the selected Indigo + slate identity and is served locally as the favicon and the compact 32 px header mark.

Keep the cross and ring simple and legible at small sizes. Use the existing SVG rather than substituting another logo, a university mark or generated artwork. The selected layout and color tokens are specified in [DESIGN.md](DESIGN.md). No external image service is required.

## University artwork

[public/hcmut.png](../public/hcmut.png) is copied unchanged from the instructor's course workspace:
`Tai_to_chuc_bai_giang/style/assets/logo_bkhcm_cover.png`.

This is the existing HCMUT/Bach Khoa university artwork. It retains its identity and provenance; no application-wide software license is asserted over it. It appears with the **HCMUT/EE2019 institutional footer credit**. The application header and favicon use the Control Studio pole/zero mark.

## Name and author line

The visible application name is **Control Studio**. The compact header's second line is `v<package.version> · Cao Kha Bao Khanh`. The application reads the version from `package.json`; it is not maintained as a separate asset or hardcoded label.

`CSDKTD_APP` remains the repository name and `csdktd-app` remains the package/Cloudflare identifier. Existing course names and historical CSDKTD references are preserved. Installed system fonts provide interface text; no external font service is required.
