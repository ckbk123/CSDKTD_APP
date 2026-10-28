# CSDKTD APP

A proposed desktop learning application for **Cơ sở điều khiển tự động (EE2019)**. The aim is to let students change a model, inspect the mathematics, predict its behavior, and check their own reasoning.

**Current stage: functional specification for instructor review.** This repository contains proposals and research, not an implemented application. Every feature remains open to acceptance, revision or deferral.

## Start here

1. Read the [functional specification](docs/FUNCTIONAL_SPECIFICATION.md) for the proposed experience and detailed features.
2. Use the [feature review sheet](docs/FEATURE_REVIEW.md) to record which features you want and how they should behave.
3. Read the [platform assessment](docs/PLATFORM_FEASIBILITY.md) before deciding whether Raven and Vulkan meet the required Windows, Linux and macOS coverage.
4. Inspect the [course evidence](docs/research/SLIDE_REVIEW.md) and [existing applet research](docs/research/APPLET_REFERENCES.md) behind the proposals.

The intended implementation language is C. Raven is the proposed UI library, subject to compatibility and usability trials. The requested operating systems include Windows 7, 8, 10 and 11, with Linux and macOS where feasible. These are **requested targets, not verified supported platforms**. Windows 8.1 is tracked separately in the compatibility assessment.

The strongest initial feature proposal is a linked **block diagram, signal-flow graph and Mason tutor**, backed by exact polynomial/rational algebra and an independent equation solver. The wider catalog covers the full continuous and discrete control course.

## Repository contents

```text
docs/
  FUNCTIONAL_SPECIFICATION.md   Detailed candidate functionality
  FEATURE_REVIEW.md            Instructor decisions and customization notes
  PLATFORM_FEASIBILITY.md      C, Raven, Vulkan and requested operating systems
  research/
    APPLET_REFERENCES.md       Primary references and transferable interaction ideas
    SLIDE_REVIEW.md            Course coverage, examples and evidence limitations
    SLIDE_INVENTORY.json       Source deck identities, hashes and slide titles
```

Course slides and textbooks remain in the parent teaching workspace. They are not redistributed in this repository. External tools are references for interaction design; no external code or assets have been incorporated. Project and dependency licensing must be selected before implementation or reuse.

Prepared on 28 October 2026. Document language is English for review; the proposed student interface supports Vietnamese terminology, with English as a configurable option.
