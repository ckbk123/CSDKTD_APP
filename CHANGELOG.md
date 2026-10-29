# Control Studio changelog

Versions identify accepted application integrations, not worker checkpoints or hosting deployments. The coordinator assigns patch releases serially under [the version policy](docs/COORDINATION.md#version-policy).

## 0.3.1 — 29 October 2026

- DS03: edit a monic quadratic family affine in K, map the unit disk to a half-plane, follow the bilinear substitution and Routh rows, and derive the complete strict gain interval. Endpoint checks retain z=-1 at infinity and vanishing leading coefficients.
- Accept [PR #2](https://github.com/ckbk123/CSDKTD_APP/pull/2), source `9c39403f72273a65c608f58b134a1a291bc84b38`. Scope is quadratic affine-gain families; coefficient, numerical and plotting limits are documented in [DS03 status](src/modules/ds03/STATUS.md).
- Independent review checked 805 family/boundary cases and 1,680 complex mappings, including the corrected near-minus-one cancellation case. All 83 application tests, 28 coordination tests, type checking and production build pass. Real-browser production evidence and integration results are recorded in the module status.

## 0.3.0 — existing scaffold baseline

- Compact Control Studio interface, version/author identity, 56 independent module routes and fresh per-visit workspaces.
- Shared visual equation input and typeset examples through locally bundled MathLive.
- Atomic local module claims, isolated worker protocol and per-module acceptance/progress records.

This records the baseline before the ten-worker integration batch on 29 October 2026. It does not certify any exercise solver or claim a hosted deployment.
