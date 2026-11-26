# MATTER engineering standards

1. Preserve the static-site architecture unless a concrete requirement justifies changing it.
2. Keep modules cohesive and loosely coupled; avoid splitting trivial helpers into excessive files.
3. Every event listener, observer, animation frame and WebGL resource needs an explicit lifecycle and cleanup path.
4. Pointer interactions must have keyboard/touch alternatives where they convey essential functionality.
5. Respect reduced-motion preferences and avoid starting expensive render loops for invisible scenes.
6. Keep DOM access scoped to a module; avoid implicit global mutable state.
7. Keep configuration separate from rendering and never invent contact/payment endpoints.
8. Test JavaScript module syntax, imports, static asset paths and deployment output after structural changes.
9. Review mobile layout and touch behaviour, keyboard navigation, focus visibility and screen-reader labels.
10. Prefer incremental refactors over mass file moves. Preserve a known-good deploy until the replacement is verified.

## Quality checklist

- [ ] No console errors during the primary experience.
- [ ] All interactive controls work with keyboard and touch.
- [ ] Reduced-motion mode remains usable.
- [ ] WebGL failure has a graceful fallback.
- [ ] Observers/listeners/animation loops are cleaned up.
- [ ] No broken local assets or imports.
- [ ] Render deploy is live before calling the change complete.
