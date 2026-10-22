# Website Styling Repair Design

## Intent and scope

Improve the visual quality and responsiveness of the existing DocLens website without changing product features, backend API contracts, or document-processing behavior. The work covers the shared UI shell and the Home, Chat, Library, Compare, Knowledge Map, Study, settings, inspector, and command-palette surfaces.

Success means each route remains readable and operable at desktop and mobile widths; page content scrolls within the correct container; controls retain clear hover, keyboard-focus, disabled, and selected states; and shared colors, spacing, typography, and panel treatments are consistent in light and dark themes.

## Approach

Retain the current dark engineering-console visual language and make the smallest shared CSS and JSX adjustments necessary. Prefer shared tokens and reusable layout rules over duplicating page-specific overrides. Do not redesign the information architecture, copy, data states, or API integration.

## Architecture and layout

1. Establish robust viewport and scroll containment in the app shell so desktop rail navigation and mobile bottom navigation do not clip route content.
2. Normalize global type scaling, surface colors, borders, focus rings, motion preferences, and scrollbar behavior in the existing theme CSS.
3. Audit every page's root container and main interactive region for `min-h-0`, overflow direction, responsive padding, and narrow-width wrapping.
4. Preserve large visual elements such as the Landing hero and 3D canvas but constrain them at smaller breakpoints so controls and primary text remain visible.

## Page-level repairs

- Landing: prevent hero text and calls to action from overflowing; make the header and content stack cleanly; retain the internal landing-page scroll area.
- Chat: maintain a reachable composer and readable suggestion cards on short and narrow viewports.
- Library and Compare: make toolbar controls wrap and card/grid layouts remain usable on mobile.
- Knowledge Map: guard canvas, filters, and details panes against overlap and clipped content.
- Study: make cards, progress controls, and completion UI fit compact viewports.
- Shared overlays: ensure the inspector, settings modal, and command palette have safe viewport insets, predictable z-index ordering, visible focus, and internal scrolling where needed.

## Error handling and accessibility

Use semantic control attributes and existing labels where possible. Every interactive control touched by the pass must have a visible keyboard focus state. Honor `prefers-reduced-motion` for decorative animations and avoid global style rules that lower contrast in light mode.

## Validation

Run the existing frontend linter and production build. Manually exercise route navigation, command palette opening/closing, theme settings, and representative page controls. Inspect the rendered site at a desktop viewport and a mobile viewport, checking for blank/error overlays, console issues, clipping, overlap, and scroll traps.

## Exclusions

No backend changes, API behavior changes, document uploads/deletions, chat submissions, external service calls, or content rewrites are part of this styling-only task.
