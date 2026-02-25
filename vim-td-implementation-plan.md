# VIM Tower Defense — Implementation Plan

## Stack Decision

### Recommended: SvelteKit + TypeScript (full client-side)

For the MVP, the entire game runs in the browser with no backend. Here's how Joel's preferred technologies map:

| Technology      | Role                                                                                                                                                                                                                                                                                                     | Rationale                                                                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SvelteKit**   | App shell, UI panels, state management                                                                                                                                                                                                                                                                   | Svelte's reactivity model is ideal for the HUD, command reference, and build menu. SvelteKit gives routing (menu → game → stage select) and static adapter for Cloudflare Pages deployment.       |
| **TypeScript**  | All game logic                                                                                                                                                                                                                                                                                           | Type safety for the VIM parser state machine, tower/enemy definitions, and command grammar is extremely valuable. The parser alone has enough state transitions that untyped JS would be painful. |
| **Rust → WASM** | _Deferred to V1._ Pathfinding (A\*), enemy AI, and optionally the VIM parser could move to WASM for performance. For MVP with a 20×14 grid and <50 enemies, pure TS is more than fast enough. Introducing the WASM build pipeline adds ~2 days of tooling overhead with no visible benefit at MVP scale. |
| **Go**          | _Deferred to post-MVP._ Natural fit for a future leaderboard API, replay storage, or multiplayer server. No backend needed for MVP.                                                                                                                                                                      |

### Build & Deploy

- **Bundler:** Vite (via SvelteKit)
- **Deployment:** Cloudflare Pages (static adapter)
- **Package manager:** pnpm
- **Testing:** Vitest for unit tests (especially the VIM parser)

### Key Architecture Decisions

- The **Canvas renderer** is a standalone TypeScript module with no Svelte dependency — it receives a state snapshot and draws it. This keeps rendering decoupled and makes a future Rust/WASM renderer swap trivial.
- The **VIM input parser** is a pure function / state machine with no DOM dependency. Input events are captured in Svelte, translated to key strings, and fed to the parser. This makes it fully unit-testable.
- **Game state** is a single immutable-ish object that flows: Input → Parser → Command → State Update → Render. Svelte stores wrap this for reactivity in the UI panels, but the game loop itself doesn't depend on Svelte's reactivity.

---

## Epic & Task Breakdown

Tasks are scoped for the **MVP (Stages 1–4)**. Each task includes an estimate. Total estimated effort: **~12–15 days** for a solo developer.

---

### Epic 1: Project Scaffolding & Renderer

> Goal: A visible character grid on screen that can draw colored glyphs in cells.

#### 1.1 — Project setup

**Estimate:** 0.5 day

- Initialize SvelteKit project with TypeScript, static adapter
- Configure pnpm, Vitest, ESLint, Prettier
- Set up Cloudflare Pages deployment pipeline
- Create basic route structure: `/` (menu), `/play` (game)
- Establish directory structure:
  ```
  src/
    lib/
      engine/       — Pure TS game logic (no Svelte imports)
      renderer/     — Canvas rendering
      ui/           — Svelte components (HUD, panels)
      types/        — Shared type definitions
    routes/
      +page.svelte  — Main menu
      play/
        +page.svelte — Game screen
  static/
    fonts/          — CP437 tileset image
  ```

#### 1.2 — CP437 tileset & font loading

**Estimate:** 0.5 day

- Source or create a CP437 bitmap font tileset (16×16 grid of glyphs, PNG)
- Write a `TilesetLoader` that loads the image and provides a `drawGlyph(ctx, charCode, x, y, fg, bg)` method
- Support configurable cell size (e.g., 16×16, 12×12) for display scaling
- Handle retina/HiDPI rendering (canvas resolution vs. display size)

#### 1.3 — Character grid renderer

**Estimate:** 1 day

- Implement `GridRenderer` class:
  - Accepts a `RenderState` object: 2D array of cells, each with `{ char, fg, bg }`
  - Draws the entire grid to a `<canvas>` element each frame
  - Supports a "dirty cell" optimization: only redraw cells that changed (optional, can defer)
- Render the full screen as a character grid: game area, sidebar, status bar, header — all in the same canvas
- Define a `ColorPalette` with named colors matching the DF aesthetic:
  - `terrain.grass`, `terrain.path`, `terrain.stone`, `terrain.water`
  - `tower.arrow`, `tower.cannon`, `tower.frost`, etc.
  - `enemy.walker`, `enemy.runner`, `enemy.tank`
  - `ui.cursor`, `ui.selection`, `ui.statusBar`
- Implement cursor rendering (highlighted background cell)

#### 1.4 — Screen layout system

**Estimate:** 0.5 day

- Define screen regions as character-cell rectangles:
  - Header bar (row 0): stage name, wave info, gold
  - Game grid (rows 1–15, cols 0–39): the play area
  - Sidebar (rows 1–15, cols 41–60): command reference
  - Build menu (row 16): tower selection
  - Status bar (row 17): mode, cursor position, messages
- Implement `ScreenLayout` that maps these regions and provides coordinate translation (screen cell ↔ game grid cell)
- Draw box-drawing characters (╔═╗║╚╝╠╣╦╩) for borders between regions

---

### Epic 2: Grid & Game State

> Goal: A data model for the game grid, towers, enemies, and path — independent of rendering.

#### 2.1 — Core type definitions

**Estimate:** 0.5 day

- Define TypeScript types/interfaces:

  ```typescript
  type CellType = 'grass' | 'path' | 'stone' | 'water' | 'entry' | 'exit'
  type TowerType = 'arrow' | 'cannon' | 'frost' | 'lightning' | 'sniper' | 'buff' | 'trap' | 'wall'
  type EnemyType = 'walker' | 'runner' | 'tank' | 'swarm' | 'ghost' | 'boss'
  type GameMode = 'normal' | 'insert' | 'visual' | 'visual-line' | 'visual-block' | 'command'
  type GamePhase = 'planning' | 'combat' | 'wave-complete' | 'stage-complete' | 'game-over'

  interface Tower { type: TowerType; level: number; row: number; col: number; }
  interface Enemy { type: EnemyType; hp: number; maxHp: number; pathIndex: number; speed: number; }
  interface GameState { ... }
  ```

- Define tower stat tables (damage, range, fire rate, cost per type and level)
- Define enemy stat tables (HP, speed, gold reward per type)

#### 2.2 — Grid state manager

**Estimate:** 0.5 day

- Implement `Grid` class:
  - Initialize from a stage definition (2D array of `CellType`)
  - `placeTower(row, col, type)` — validates cell is buildable + unoccupied, deducts gold
  - `removeTower(row, col)` — returns tower, refunds gold
  - `getTower(row, col)` — lookup
  - `getNextTower(row, col, direction)` — for `w`/`b` navigation (finds next/prev tower)
  - `getCellType(row, col)` — lookup
- Store towers in both a Map (for lookup) and the grid array (for rendering)

#### 2.3 — Path definition & enemy movement

**Estimate:** 1 day

- Define path as an ordered array of `[row, col]` waypoints in stage data
- Implement `PathManager`:
  - Interpolate waypoints into a full cell-by-cell path sequence
  - `getPosition(pathIndex)` → `[row, col]`
  - `advance(enemy, dt)` → update `pathIndex` based on speed and delta time
- Implement `EnemyManager`:
  - `spawnEnemy(type)` — creates enemy at path start
  - `update(dt)` — moves all active enemies along path
  - `getEnemiesInRange(row, col, range)` — for tower targeting
  - `damageEnemy(id, amount)` — apply damage, handle death + gold reward
  - `removeEnemy(id)` — enemy reached exit (lose life) or died

#### 2.4 — Stage data format & first 4 stages

**Estimate:** 1 day

- Define stage data schema:
  ```typescript
  interface StageDefinition {
  	id: number;
  	name: string;
  	subtitle: string;
  	gridWidth: number;
  	gridHeight: number;
  	terrain: CellType[][]; // 2D grid
  	path: [number, number][]; // waypoints
  	waves: WaveDefinition[];
  	availableTowers: TowerType[];
  	unlockedCommands: string[]; // VIM commands unlocked this stage
  	parKeystrokes: number; // VIM golf target
  	tutorialSteps?: TutorialStep[];
  }
  ```
- Design and implement grid layouts for stages 1–4:
  - **Stage 1:** 10×7 grid, straight horizontal path, 3 waves of walkers. Arrow tower only.
  - **Stage 2:** 14×10 grid, L-shaped path, 4 waves (walkers + runners). Arrow + Cannon. Pre-placed towers to rearrange.
  - **Stage 3:** 18×10 grid, serpentine horizontal path, 5 waves. Arrow + Cannon + Frost. Wide layout rewards `0`/`$` usage.
  - **Stage 4:** 20×14 grid, vertical zigzag path, 6 waves (walkers + runners + tanks). All MVP towers. Tall layout rewards `gg`/`G` and count prefixes.

---

### Epic 3: VIM Input Parser

> Goal: A fully testable state machine that translates keystrokes into game commands, respecting the current mode.

This is the most critical and complex piece. It must feel exactly like VIM — buffered input, count prefixes, multi-key sequences, and mode-aware behavior.

#### 3.1 — Input capture layer

**Estimate:** 0.5 day

- Svelte `onMount` keydown/keyup handler on the game page
- Translate `KeyboardEvent` into a normalized key string:
  - `event.key` for printable characters
  - Handle `Escape`, `Ctrl-r`, `Ctrl-v` modifiers
  - Prevent default browser behavior for all game keys
- Feed normalized key strings to the parser
- Display raw keystrokes in a "pending input" area of the status bar (like VIM shows partial commands)

#### 3.2 — Parser state machine (Normal mode)

**Estimate:** 2 days

- Implement `VimParser` class with:
  - Internal state: `{ mode, countBuffer, verbBuffer, pendingKeys }`
  - `processKey(key: string): Command | null` — returns a command when a complete sequence is recognized, null while buffering
  - Timeout handling: if `g` is pressed and nothing follows within 500ms, clear buffer
- **Normal mode key handling** (MVP scope):
  - **Simple motions:** `h`, `j`, `k`, `l` → `MoveCursor` command
  - **Count prefix:** accumulate digits, apply to next motion (e.g., `5j` → `MoveCursor { direction: 'down', count: 5 }`)
  - **Word motions:** `w` → `JumpNextTower`, `b` → `JumpPrevTower`
  - **Line motions:** `0` → `JumpRowStart`, `$` → `JumpRowEnd`, `e` → `JumpRowLastTower`
  - **Global motions:** `gg` → `JumpGridStart`, `G` → `JumpGridEnd`
  - **Actions:** `x` → `QuickSellTower`, `i` → `EnterInsertMode`, `v` → `EnterVisualMode` (stub for MVP)
  - **Mode switch:** `:` → `EnterCommandMode`
- Define `Command` as a discriminated union type:
  ```typescript
  type Command =
  	| { type: 'move'; direction: Direction; count: number }
  	| { type: 'jump'; target: JumpTarget }
  	| { type: 'sell'; row: number; col: number }
  	| { type: 'enterMode'; mode: GameMode }
  	| { type: 'placeTower'; towerType: TowerType }
  	| { type: 'commandLine'; command: string };
  // ...
  ```
- Comprehensive unit tests for all key sequences, edge cases (double digits, `gg` vs `g` timeout, escape mid-sequence)

#### 3.3 — Parser: Insert mode

**Estimate:** 0.5 day

- On `EnterInsertMode`: switch parser to insert mode handling
- Insert mode keys:
  - `1`–`9` → `PlaceTower` command with corresponding tower type
  - `h/j/k/l` → `MoveCursor` (stay in insert mode)
  - `Esc` → `EnterNormalMode`
- `i` places at cursor, `a` places one cell right (set cursor +1 before entering insert)
- Stage 4 additions: `o`/`O` (one row below/above)
- Unit tests

#### 3.4 — Parser: Command mode

**Estimate:** 0.5 day

- On `:`: switch to command mode, show command line input in status bar
- Capture text input until `Enter` (execute) or `Esc` (cancel)
- Parse command strings:
  - `q` / `q!` → quit commands
  - `w` / `wave` → start wave
  - `wq` → save and quit
  - `save` → save
  - `help` / `help {cmd}` → show help
  - `map` → toggle command reference
- Return `CommandLineCommand` with parsed action
- Unit tests

#### 3.5 — Command executor

**Estimate:** 1 day

- Implement `CommandExecutor` that takes a `Command` and mutates `GameState`:
  - `move` → update cursor position (clamped to grid bounds)
  - `jump` → calculate target position, update cursor
  - `sell` → remove tower from grid, add refund to gold, push to undo stack
  - `placeTower` → validate placement, deduct gold, add tower, push to undo stack
  - `enterMode` → update game mode
  - `commandLine` → dispatch to appropriate handler
- Track keystroke count for every command executed
- Feed updated state to renderer

---

### Epic 4: Tower Combat System

> Goal: Towers automatically target and damage enemies during combat phase.

#### 4.1 — Tower targeting & firing

**Estimate:** 1 day

- Implement `CombatManager`:
  - Each game tick during combat phase, iterate all towers
  - For each tower: find enemies in range, select target (closest to exit by default)
  - Check fire cooldown; if ready, create a "shot" event
  - Apply damage to target enemy
- Tower-specific behavior:
  - **Arrow (`>`):** Single target, fast cooldown
  - **Cannon (`O`):** AOE — damage target + all enemies within 1 cell of target
  - **Frost (`*`):** No damage; applies slow debuff to enemies in range
- Shot visualization: brief character flash (`-`, `*`, `~`) in cells between tower and target (1–2 frame duration)

#### 4.2 — Wave spawning system

**Estimate:** 0.5 day

- Define wave data:
  ```typescript
  interface WaveDefinition {
  	enemies: { type: EnemyType; count: number; spawnInterval: number }[];
  	delayBefore: number; // seconds before wave starts
  }
  ```
- Implement `WaveManager`:
  - `startWave()` — begin spawning enemies per wave definition
  - Spawn enemies at timed intervals
  - Track wave completion (all enemies spawned + all enemies dead or exited)
  - Trigger `wave-complete` phase transition

#### 4.3 — Game loop & phase management

**Estimate:** 1 day

- Implement core game loop using `requestAnimationFrame`:
  - **Planning phase:** No enemy movement. Player has full control. Render at low tick rate (UI updates only).
  - **Combat phase:** Enemy movement, tower firing, projectile updates at 60fps. Player can still issue commands.
  - **Wave-complete:** Brief pause, show wave summary, transition to planning for next wave.
  - **Stage-complete:** Show stage results (keystrokes, par, rating). Unlock next stage.
  - **Game-over:** Player lives reached 0. Show retry option.
- Player lives: start with 10 (or 20). Each enemy reaching exit costs 1 life.
- Gold: starting gold per stage defined in stage data. Earned per kill and wave completion bonus.
- Wire up: Input → Parser → Executor → State Update → Combat Update → Render

---

### Epic 5: UI & HUD (Svelte Components)

> Goal: All non-canvas UI elements — or, if fully canvas-rendered, the data-feeding layer for the canvas HUD regions.

#### 5.1 — Status bar

**Estimate:** 0.5 day

- Render at bottom of canvas (or as Svelte overlay — decide during implementation):
  - Left: current mode (`-- NORMAL --`, `-- INSERT --`, `-- COMMAND --`)
  - Center: cursor position as `row,col`
  - Right: message area (command feedback, errors, hints)
- In command mode: replace status bar content with `:` prompt and text input
- Style: bright white text on dark background, mode label colored (green for normal, blue for insert, yellow for visual)

#### 5.2 — Command reference panel

**Estimate:** 0.5 day

- Sidebar region of the canvas (or Svelte panel)
- Display unlocked commands grouped by mode
- Highlight commands introduced in current stage with a color accent
- Gray out / hide commands not yet unlocked
- Toggleable with `:map` command

#### 5.3 — Build menu

**Estimate:** 0.25 day

- Row above status bar showing available tower types
- Format: `[1]> [2]O [3]*` etc.
- Only show towers available in current stage
- Highlight selected tower in insert mode

#### 5.4 — Header bar

**Estimate:** 0.25 day

- Top row: game title, stage name, wave counter (`Wave 2/5`), gold display
- Update reactively as game state changes

#### 5.5 — Tutorial overlay system

**Estimate:** 1 day

- For Stage 1: step-by-step guided prompts
- Implement `TutorialManager`:
  - Accepts an array of `TutorialStep` definitions per stage
  - Each step: `{ message, requiredCommand, highlightCell? }`
  - Displays message in a prominent area (center of grid as overlay, or in message bar)
  - Waits for player to execute `requiredCommand` before advancing
  - Dims/blocks other input during tutorial steps (or allows free movement but requires the specific action to proceed)
- Stages 2–4: brief intro popup showing new commands, then one required practice action before stage begins
- Tutorial state is tracked so completed tutorials don't repeat

#### 5.6 — Stage results screen

**Estimate:** 0.5 day

- Displayed on stage completion:
  - Keystrokes used vs. par
  - Efficiency rating (S / A / B / C)
  - Gold earned
  - "Next Stage" / "Retry" options
- Rendered as a character-art panel centered on the canvas (DF-style popup)

---

### Epic 6: Menu & Navigation

> Goal: Main menu, stage select, and app shell.

#### 6.1 — Main menu

**Estimate:** 0.5 day

- ASCII art title screen (`:wq!` rendered large in character art)
- Menu options: New Game, Continue, Stage Select (if stages unlocked)
- Navigate with `j`/`k` and `Enter` (of course)
- Rendered on the same canvas, full-screen character grid

#### 6.2 — Stage select

**Estimate:** 0.25 day

- Grid or list of stages 1–4
- Show: stage name, best score, locked/unlocked status
- Select with `j`/`k` + `Enter`

#### 6.3 — Persistence

**Estimate:** 0.25 day

- Save to localStorage:
  - Unlocked stages
  - Per-stage best keystroke count and rating
  - Current in-progress stage (optional for MVP, nice-to-have)
- Load on app start

---

### Epic 7: Polish & Playtesting

> Goal: Make it feel good to play.

#### 7.1 — Mouse click interception

**Estimate:** 0.25 day

- Intercept all mouse clicks on the game canvas
- Display contextual hint in status bar: "Try `5j` to move down 5 cells" (based on where they clicked relative to cursor)
- No mouse-based game actions

#### 7.2 — VIM-style error messages

**Estimate:** 0.25 day

- When invalid commands are attempted, show VIM-style errors in the status bar message area:
  - `E: Not a valid tower location` (placing on path)
  - `E: Not enough gold` (can't afford tower)
  - `E: No tower under cursor` (selling empty cell)
  - `E: Unknown command: {cmd}` (invalid command mode input)

#### 7.3 — Visual feedback & micro-animations

**Estimate:** 0.5 day

- Cursor movement: instant snap (no tweening — matches DF/VIM feel)
- Tower placement: brief bright flash on the cell
- Tower sell: cell flashes then clears
- Enemy death: character changes to `☼` or `*` for 2 frames then disappears
- Enemy reaching exit: screen border flashes red briefly
- Wave start: header bar flashes

#### 7.4 — Keystroke hint system

**Estimate:** 0.5 day

- Track player behavior patterns
- If player presses `h` or `l` 8+ times consecutively, hint: "Tip: use `8l` or `$`"
- If player navigates to a tower slowly, hint: "Tip: `w` jumps to the next tower"
- Hints appear in status bar message area, auto-dismiss after 3 seconds
- Non-blocking, non-modal

#### 7.5 — Playtesting & balance pass

**Estimate:** 1 day

- Play through all 4 stages end to end
- Tune: enemy HP/speed, tower damage/range, gold economy, wave composition
- Verify all VIM commands work correctly in context
- Set par keystroke targets based on optimal play
- Fix bugs

---

## Task Summary

| Epic                      | Tasks        | Estimated Days |
| ------------------------- | ------------ | -------------- |
| 1. Scaffolding & Renderer | 4 tasks      | 2.5            |
| 2. Grid & Game State      | 4 tasks      | 3.0            |
| 3. VIM Input Parser       | 5 tasks      | 4.5            |
| 4. Tower Combat           | 3 tasks      | 2.5            |
| 5. UI & HUD               | 6 tasks      | 3.0            |
| 6. Menu & Navigation      | 3 tasks      | 1.0            |
| 7. Polish & Playtesting   | 5 tasks      | 2.5            |
| **Total**                 | **30 tasks** | **~19 days**   |

Note: estimates assume focused solo development. Tasks within an epic are roughly sequential, but epics can overlap. A realistic timeline with context-switching and unexpected issues: **3–4 weeks**.

---

## Suggested Build Order

The critical path is: Renderer → Grid/State → VIM Parser → Combat → Wire it all together.

**Week 1: Foundation**

- Epic 1 (all) — get a visible, colored character grid on screen
- Epic 2.1, 2.2 — core types and grid state
- Epic 3.1, 3.2 — input capture and normal mode parser

**Week 2: Playable loop**

- Epic 3.3, 3.4, 3.5 — insert mode, command mode, executor
- Epic 2.3 — path and enemy movement
- Epic 4.1, 4.2 — towers shoot, waves spawn
- Epic 4.3 — game loop ties it together

**Week 3: Complete MVP**

- Epic 5 (all) — HUD, tutorial, results screen
- Epic 2.4 — finalize all 4 stage layouts
- Epic 6 (all) — menus and persistence

**Week 4: Polish**

- Epic 7 (all) — error messages, hints, feedback, playtesting, balance

---

## V1 Preparation Notes

These don't need action now but should inform MVP architecture decisions:

1. **Undo system** (V1, Epic 3 extension): the `CommandExecutor` should log every state-mutating command to an array from day one, even if `u`/`Ctrl-r` aren't implemented yet. This makes the V1 undo feature a simple addition rather than a retrofit.
2. **Yank register** (V1): the grid state should support serializing a rectangular region of towers to a plain object. Don't build yank/put yet, but don't make it structurally hard.
3. **Rust/WASM migration path**: keep the `VimParser`, `Grid`, `CombatManager`, and `PathManager` as pure TypeScript modules with no Svelte or DOM dependencies. If/when performance demands it, these can be rewritten in Rust and compiled to WASM with the same interface boundary.
4. **Sound system**: leave a `SoundManager.play('tower-place')` hook in the executor even if no sounds are loaded yet. Easier than adding hooks later.
