# VIM Tower Defense (:wq!)

Browser-based tower defense game that teaches VIM keybindings through gameplay. ASCII/CP437 aesthetic, keyboard-only controls.

## Tech Stack

- **Framework:** SvelteKit (static adapter, thin shell only — game is all-canvas)
- **Language:** TypeScript (strict mode)
- **Rendering:** HTML5 Canvas with CP437 bitmap font tileset (16x16 glyphs)
- **Testing:** Vitest
- **Package Manager:** pnpm
- **Deployment:** Cloudflare Pages (static)

## Architecture

All game rendering happens on a single `<canvas>`. SvelteKit provides routing and keyboard event capture only.

- `src/lib/engine/` — Pure TypeScript game logic. NO Svelte imports. Independently testable.
- `src/lib/renderer/` — Canvas rendering. Receives state snapshots, draws them. No game logic.
- `src/lib/ui/` — Svelte components (route shells, event capture). Thin wrappers only.
- `src/lib/types/` — Shared type definitions (discriminated unions for modes, commands, phases).
- `src/lib/stages/` — Stage definitions (grid layouts, terrain, paths, waves, unlocks).
- `src/routes/` — SvelteKit routes (menu, game).
- `static/fonts/` — CP437 tileset image.

## Key Principles

- **All rendering is canvas.** Game grid, sidebar, status bar, menus — one canvas. No DOM overlays.
- **VIM parser is a pure state machine.** No DOM dependency. Input → Parser → Command. Fully unit-testable.
- **Game state is a plain object.** Flows: Input → Parser → Command → State Update → Render.
- **Types over interfaces.** Discriminated unions for GameMode, GamePhase, Command.
- **No `any`.** Use `unknown` and narrow.
- **Engine modules have zero Svelte/DOM imports.** This keeps the WASM migration path open for V1.

## Dev Commands

- `pnpm dev` — Start dev server
- `pnpm build` — Build for production
- `pnpm test` — Run Vitest
- `pnpm test:watch` — Run Vitest in watch mode
- `pnpm lint` — Run ESLint
- `pnpm format` — Run Prettier
- `pnpm check` — Svelte type checking
- `npx wrangler deploy` — Deploy to Cloudflare Pages

## Gotchas

- **SPA routing:** The `/play` route uses query params (`?stage=1`). It requires `prerender = false` in `+page.ts` and `fallback: '200.html'` in the static adapter config.
- **Layout minimum width:** `screen-layout.ts` enforces `MIN_CONTENT_COLS=32` so the header/build menu have enough space even on small grids (Stage 1 is only 10 cols wide).
- **Svelte navigation:** Use `window.location.href` instead of `goto()` to avoid the `svelte/no-navigation-without-resolve` lint rule (simpler for a static site).

## Design References

- `vim-tower-defense-design-doc.md` — Full game design (modes, towers, enemies, stages, UI layout)
- `vim-td-implementation-plan.md` — Epic/task breakdown with estimates

## MVP Scope (Stages 1-4)

- Normal mode: h/j/k/l, w/b, 0/$, e, gg/G, count prefixes, x (quick sell)
- Insert mode: i/a/o/O, number keys 1-4 for tower placement, h/j/k/l movement, Esc
- Command mode: :q, :q!, :w, :wq, :save, :help, :map
- Towers: Arrow (>), Cannon (O), Frost (*), Lightning (~)
- Enemies: Walker, Runner, Tank
- Fixed enemy paths (no dynamic A* — Wall tower deferred to V1)
- Tutorial: guided walkthrough for Stage 1, intro popups for Stages 2-4

## Testing Strategy

- **VIM parser (highest priority):** Extensive unit tests for all key sequences, count prefixes, multi-key commands (gg, dd), timeouts, mode transitions, edge cases
- **Grid operations:** Unit tests for tower placement, removal, validation, boundary checks
- **Combat:** Unit tests for targeting, damage calculation, AOE, slow debuff, wave progression
- **Integration:** Game loop tests connecting parser → executor → state updates
