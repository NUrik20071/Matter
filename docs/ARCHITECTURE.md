# MATTER architecture

**Status:** architecture baseline, 2026-11-26  
**Deployment:** static site on Render; repository `NUrik20071/Matter`, branch `main`.

## Current runtime

MATTER is deliberately a dependency-light static site. It uses native JavaScript ES modules, CSS, HTML Canvas 2D and WebGL/3D rendering. It does not require a Node.js server, database, Clerk or a backend build step.

The deployed entry point remains `index.html`. Render publishes the repository root (`.`) and automatically deploys commits from `main`.

## Existing module responsibilities

| File | Responsibility |
|---|---|
| `app.js` | Application orchestration, scene lifecycle, interaction wiring |
| `world.js` | Shared world/scene rendering primitives |
| `sculpture.js` | Hero sculpture / primary visual scene |
| `studies.js` | Three interactive study experiences |
| `kinetic.js` | Motion and interaction behaviour |
| `scroll.js` | Scroll-driven behaviour |
| `scene-catalog.js` | Scene definitions/catalog |
| `object-geometry.js` | Geometry construction |
| `object-viewer.js` | Interactive 3D object viewer |
| `commerce.js` | Brief/contact interaction and optional commerce-related UI |
| `commerce-config.js` | Explicit owner-provided contact/payment configuration |
| `styles.css`, `commerce.css`, `object-viewer.css` | Presentation layers |

## Target module boundaries

Keep the current root-level module paths until import mapping, relative assets and deployment behaviour have been verified. Prefer a staged migration to this logical structure:

```text
src/
  app/
    bootstrap.js
    lifecycle.js
  scenes/
    hero/
    studies/
    catalog.js
  interaction/
    pointer.js
    keyboard.js
    motion-preferences.js
  rendering/
    canvas/
    webgl/
    geometry/
  features/
    object-viewer/
    brief/
  shared/
    dom/
    math/
    accessibility/
styles/
  base/
  scenes/
  components/
```

This is a logical target, not a statement that these directories exist today.

## Dependency rules

- App bootstrap coordinates modules; it should not contain every scene's implementation.
- Scene modules own their rendering and scene-specific state.
- Shared rendering/math utilities must not depend on page-level DOM selectors.
- Feature modules expose explicit init/dispose functions where lifecycle cleanup is needed.
- Global listeners, animation frames, observers and WebGL resources must have a defined cleanup owner.
- Respect `prefers-reduced-motion` and provide non-pointer alternatives for essential interactions.
- Keep the site static and fast; do not introduce a framework, server, database or authentication without a demonstrated need.

## Release safety

- Preserve the current static entry point and Render publish directory.
- Make changes in a branch and review the diff before merge.
- Verify JavaScript syntax/import paths and asset paths after every module move.
- Smoke-test mobile touch, keyboard, reduced-motion and WebGL fallback behaviour.
- Do not configure real contact/payment details without values explicitly supplied by the owner.
