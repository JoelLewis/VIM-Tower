# VIM Tower Defense — Design Document

## Overview

VIM Tower Defense (working title: **`:wq!`**) is a lightweight browser-based tower defense game designed to teach players VIM keybindings through natural gameplay. Players defend against waves of enemies using tower placement and management — all controlled exclusively through VIM-style commands. The game's core insight is that tower defense gameplay naturally requires modal interaction (scanning, placing, selecting, commanding), making it an ideal vehicle for internalizing VIM's modal editing philosophy.

### Design Principles

1. **Every interaction is a real VIM command.** No mouse, no WASD, no game-specific bindings. If a player gets good at this game, they've gotten good at VIM.
2. **Modes should feel motivated, not imposed.** Players should _want_ to switch modes because each mode gives them a different kind of power, not because the game forces them to.
3. **Teach the grammar, not just the keys.** VIM's real power is composability — verb + count + noun. The game should make players _think_ in that grammar.
4. **Progressive disclosure.** Start with `h/j/k/l` and a single tower type. Unlock commands as the player advances, so each new VIM concept arrives exactly when the player needs it.

---

## Core Gameplay Loop

### Between Waves (Planning Phase)

- Player has unlimited time to survey the grid, place towers, rearrange defenses, and upgrade
- This is where most VIM commands are learned and practiced
- A wave timer shows when the next wave will begin; player can trigger it early with `:wave` or `:w` for bonus gold

### During Waves (Combat Phase)

- Enemies traverse a path from entry to exit
- Towers fire automatically at enemies in range
- Player can still issue commands (sell a tower, place emergency defenses) but is under time pressure
- Quick VIM commands become critical — this is where muscle memory gets tested

### Progression

- Each stage introduces 1–2 new VIM concepts alongside a new gameplay mechanic
- Completing a stage unlocks those commands permanently
- A persistent command reference panel shows unlocked commands

---

## Modal System

The game uses four modes that directly mirror VIM's modes. The current mode is always displayed prominently in the UI (bottom-left, styled like a VIM status bar).

### Normal Mode (default)

The player's "eyes and hands" — for navigation, inspection, and issuing quick commands.

| Command               | Action                                               | Stage Introduced |
| --------------------- | ---------------------------------------------------- | ---------------- |
| `h` / `j` / `k` / `l` | Move cursor left / down / up / right                 | 1                |
| `w`                   | Jump cursor to next tower                            | 2                |
| `b`                   | Jump cursor to previous tower                        | 2                |
| `e`                   | Jump to last tower in current row                    | 3                |
| `0`                   | Jump cursor to first cell in row                     | 3                |
| `$`                   | Jump cursor to last cell in row                      | 3                |
| `gg`                  | Jump cursor to top-left of grid                      | 4                |
| `G`                   | Jump cursor to bottom-left of grid                   | 4                |
| `{count}j/k/h/l`      | Move cursor N cells in direction                     | 4                |
| `f{tower}`            | Jump to next tower of type (by first letter)         | 6                |
| `/`                   | Enter search — highlights matching towers/enemies    | 7                |
| `n` / `N`             | Jump to next / previous search match                 | 7                |
| `x`                   | Quick-sell tower under cursor (instant, no confirm)  | 3                |
| `dd`                  | Sell tower under cursor (with gold refund animation) | 5                |
| `u`                   | Undo last action                                     | 5                |
| `Ctrl-r`              | Redo last undone action                              | 5                |
| `.`                   | Repeat last command                                  | 8                |
| `ZZ`                  | Quick-save and exit to menu                          | —                |

### Insert Mode

Entered from Normal mode. Used for placing towers on the grid.

| Command | Action                                                 | Stage Introduced |
| ------- | ------------------------------------------------------ | ---------------- |
| `i`     | Enter insert mode at cursor position                   | 1                |
| `a`     | Enter insert mode one cell to the right                | 3                |
| `o`     | Enter insert mode one row below (new placement row)    | 4                |
| `O`     | Enter insert mode one row above                        | 4                |
| `I`     | Enter insert mode at first open cell in row            | 6                |
| `A`     | Enter insert mode at last open cell in row             | 6                |
| `1`–`9` | Select tower type from build menu while in insert mode | 1                |
| `Esc`   | Return to Normal mode                                  | 1                |

While in Insert mode:

- The build menu is visible, showing available tower types numbered 1–9
- Pressing a number places that tower at the cursor position and advances the cursor one cell right (like typing a character)
- `h/j/k/l` still moves the cursor (staying in insert mode) so you can place multiple towers quickly
- This mirrors how insert mode in VIM lets you type freely until you escape

### Visual Mode

Used for selecting groups of towers to operate on in bulk.

| Command   | Action                                                     | Stage Introduced |
| --------- | ---------------------------------------------------------- | ---------------- |
| `v`       | Enter character-wise visual mode (select individual cells) | 6                |
| `V`       | Enter line-wise visual mode (select entire rows)           | 7                |
| `Ctrl-v`  | Enter block visual mode (select rectangular region)        | 9                |
| `h/j/k/l` | Expand selection in direction                              | 6                |
| `d`       | Sell all selected towers                                   | 6                |
| `y`       | Yank (copy) selected tower layout                          | 8                |
| `p`       | Put (paste) yanked layout at cursor                        | 8                |
| `U`       | Upgrade all selected towers                                | 7                |
| `Esc`     | Exit visual mode, return to Normal                         | 6                |

### Command Mode

Entered by pressing `:` from Normal mode. A command-line input appears at the bottom of the screen (exactly like VIM).

| Command          | Action                                                        | Stage Introduced |
| ---------------- | ------------------------------------------------------------- | ---------------- |
| `:w` / `:wave`   | Start next wave early (bonus gold)                            | 2                |
| `:q`             | Quit to main menu                                             | 1                |
| `:q!`            | Quit without saving                                           | 1                |
| `:wq`            | Save and quit                                                 | 2                |
| `:save`          | Save current layout                                           | 2                |
| `:set speed=N`   | Set game speed (1–3x)                                         | 5                |
| `:towers`        | List all placed towers and stats                              | 5                |
| `:map`           | Show all unlocked keybindings                                 | 3                |
| `:help {cmd}`    | Show help for a specific command                              | 1                |
| `:upgrade`       | Upgrade tower under cursor                                    | 5                |
| `:{range}d`      | Sell towers in range (e.g., `:3,7d` sells towers on rows 3–7) | 10               |
| `:s/{old}/{new}` | Replace all towers of one type with another                   | 11               |
| `Esc`            | Cancel command, return to Normal                              | 1                |

---

## Game World & Aesthetics

### Visual Style

- **Pre-GUI Dwarf Fortress inspired.** Full ASCII rendering using CP437 (Code Page 437) characters on a solid-color tile grid. No sprites, no pixel art — just characters, background colors, and foreground colors.
- The grid is rendered as a matrix of monospaced character cells. Each cell has a foreground color, background color, and a single character glyph.
- **Color palette:** Dark background tones (blacks, deep grays, dark browns) with saturated foreground colors for game elements. Towers use distinct foreground colors by type. Enemies use reds/magentas. Path tiles use a subtle brown or dark gray background to differentiate from buildable terrain (black or very dark green).
- **Terrain variety through background color:** Grass = dark green bg, stone = dark gray bg, path = brown bg, water/impassable = dark blue bg. All rendered as flat colored cells with optional ASCII texture characters (`.` for grass, `,` for dirt, `≈` for water).
- **No smoothing, no anti-aliasing.** Hard pixel edges. The font should be a classic terminal/bitmap font (e.g., IBM VGA, Terminus, or a CP437-compatible web font).
- Towers are single characters with bright, distinct foreground colors. Enemies are single characters that move cell-to-cell (no sub-cell animation — they snap between tiles, with movement paced to feel fluid at ~4–8 moves/second).
- **UI chrome** (status bar, command reference, build menu) uses the same character-cell rendering as the game grid — the entire screen should feel like one continuous terminal output.
- Projectiles and effects are rendered as brief character flashes in cells (e.g., a `-` or `*` appears momentarily between a tower and its target).
- The cursor is rendered as a highlighted cell with a distinct background color (e.g., white or bright yellow bg) that makes it instantly visible against the dark terrain.

### Grid

- The play area is a grid (suggested default: 20 columns × 14 rows).
- A pre-defined enemy path winds through the grid. Path cells cannot have towers placed on them.
- Non-path cells are valid tower placement locations.
- The cursor is always visible as a highlighted cell with a blinking border.

### Tower Types

Each tower is associated with a character, reinforcing the text-editor aesthetic.

| Key | Tower         | Character | Behavior                                                   | Cost |
| --- | ------------- | --------- | ---------------------------------------------------------- | ---- |
| `1` | **Arrow**     | `>`       | Single-target, fast fire rate, low damage                  | 50g  |
| `2` | **Cannon**    | `O`       | AOE splash damage, slow fire rate                          | 100g |
| `3` | **Frost**     | `*`       | Slows enemies in range                                     | 75g  |
| `4` | **Lightning** | `~`       | Chain damage to multiple enemies                           | 125g |
| `5` | **Sniper**    | `.`       | Very long range, very high single-target damage, very slow | 150g |
| `6` | **Buff**      | `+`       | Boosts adjacent towers' damage/speed                       | 100g |
| `7` | **Trap**      | `_`       | Placed on path; single-use, high damage                    | 60g  |
| `8` | **Wall**      | `#`       | Blocks path, forcing enemies to reroute (limited uses)     | 200g |

Towers can be upgraded (3 levels). Upgraded towers display as their character with a color shift (green → blue → gold).

### Enemies

Enemies follow the path. Types escalate across stages.

| Enemy      | Behavior                                                  |
| ---------- | --------------------------------------------------------- |
| **Walker** | Standard speed, standard HP                               |
| **Runner** | Fast, low HP                                              |
| **Tank**   | Slow, very high HP                                        |
| **Swarm**  | Appears in large clusters, very low individual HP         |
| **Ghost**  | Immune to certain tower types, must use specific counters |
| **Boss**   | End-of-stage, high HP, special abilities                  |

### Economy

- Gold is earned per kill and per wave completion
- Bonus gold for triggering waves early (`:w`)
- Bonus gold for "VIM golf" — completing a placement sequence in fewer keystrokes than the par target
- Tower selling refunds 75% of investment (including upgrades)
- Keystroke efficiency bonus at end of each stage

---

## Stage Design & Progression

The game is structured as a campaign of 12 stages. Each stage introduces specific VIM concepts and is designed so that the new commands are either required or dramatically more efficient than brute-forcing with previously known commands.

### Stage 1: "Hello, VIM"

- **VIM concepts:** `h/j/k/l`, `i`, `Esc`, number keys for tower selection, `:q`, `:help`
- **Gameplay:** Tiny grid (10×7), straight enemy path, 3 waves. Only Arrow towers available. Tutorial overlays guide the player through placing their first towers.
- **Design intent:** Establish the basics. Player should feel comfortable moving and placing by the end.

### Stage 2: "Words Apart"

- **VIM concepts:** `w`, `b`, `:w` (start wave), `:save`
- **Gameplay:** Larger grid with pre-placed towers. Player must rearrange existing defenses. `w`/`b` jumping between towers makes this dramatically faster than `h/j/k/l` one cell at a time.
- **Design intent:** Show that VIM has faster ways to navigate. The "word" concept = tower-to-tower jumping.

### Stage 3: "Line Discipline"

- **VIM concepts:** `0`, `$`, `e`, `a`, `x`, `:map`
- **Gameplay:** Wide grid, enemies come in horizontal waves. Building rows of towers efficiently is key. `0`/`$` for jumping to row edges, `a` for placing one cell right of cursor.
- **Design intent:** Teach line-level navigation. `x` for quick corrections (misplaced tower? zap it).

### Stage 4: "The Numbers Game"

- **VIM concepts:** `{count}` prefix (e.g., `5j`, `3l`), `gg`, `G`, `o`, `O`
- **Gameplay:** Tall grid (20×20). Enemies come from top and bottom. Player needs to rapidly reposition across the grid.
- **Design intent:** Count prefixes are a huge VIM unlock. Player should feel the speed difference immediately.

### Stage 5: "Undo Your Mistakes"

- **VIM concepts:** `dd`, `u`, `Ctrl-r`, `:set`, `:upgrade`, `:towers`
- **Gameplay:** Complex map with limited gold. Player must experiment with tower placement and undo bad choices. Some waves require selling and rebuilding (economic pressure).
- **Design intent:** Teach the undo/redo workflow and the `dd` "delete line" equivalent.

### Stage 6: "Select and Conquer"

- **VIM concepts:** `v`, visual selection + `d`, `I`, `A`, `f{tower}`
- **Gameplay:** Dense grid with many towers. Mid-game pivot required — player must select groups of towers and sell them to fund a different strategy. `f` for finding specific tower types.
- **Design intent:** Introduce visual mode as a power tool for bulk operations.

### Stage 7: "Search and Destroy"

- **VIM concepts:** `/`, `n`, `N`, `V` (line visual), visual + `U` (upgrade)
- **Gameplay:** Huge map with 50+ placed towers. Enemies have type-specific weaknesses. Player must search for and upgrade specific tower types to counter incoming waves.
- **Design intent:** Search is one of VIM's most powerful features. Make it feel essential.

### Stage 8: "Copy That"

- **VIM concepts:** `y`, `p`, `.` (repeat)
- **Gameplay:** Symmetrical map where the optimal defense on one side should be mirrored on the other. Yank a layout, paste it elsewhere. Repeat (`.`) for efficiency.
- **Design intent:** Yank/put and repeat are VIM's productivity multipliers. The stage should make the player feel clever.

### Stage 9: "Block Party"

- **VIM concepts:** `Ctrl-v` (block visual mode)
- **Gameplay:** Grid-based puzzle element — player must select rectangular blocks of towers to move, upgrade, or sell as units. Enemies come in grid formations that match tower block shapes.
- **Design intent:** Block visual mode is VIM's secret weapon. Reward spatial thinking.

### Stage 10: "Command Authority"

- **VIM concepts:** `:{range}d`, advanced command-line usage
- **Gameplay:** Overwhelming waves that require rapid, large-scale tower management. Using range commands (`:5,10d`) is dramatically faster than selecting and deleting manually.
- **Design intent:** Command mode as a power user tool. Player should feel like they're "scripting" their defense.

### Stage 11: "Find and Replace"

- **VIM concepts:** `:s/{old}/{new}` (substitution)
- **Gameplay:** Counter-based wave design — wave 1 requires frost towers, wave 2 requires lightning, etc. Player must rapidly swap tower types across the grid. Substitution command makes this instant.
- **Design intent:** The `:s` command is VIM's most iconic power move. Showing its utility in a game context should create an "aha" moment.

### Stage 12: "The Final Buffer"

- **VIM concepts:** All commands. No new introductions.
- **Gameplay:** The ultimate challenge — large grid, long multi-wave siege, every enemy type, economic pressure. Success requires fluent use of all learned commands.
- **Design intent:** Mastery test. Player should feel like a VIM power user by the end.

---

## Onboarding & Teaching Mechanics

### Tutorial System

- **Stage 1** uses a step-by-step guided tutorial with overlay prompts ("Press `i` to enter Insert mode", "Press `1` to place an Arrow tower").
- **Stages 2–6** introduce new commands with a brief modal popup at stage start: shows the new command, its VIM equivalent, and a one-sentence explanation. Then a "practice prompt" requires the player to use it once before the stage begins.
- **Stages 7–12** show new commands in the command reference only — the player is expected to discover optimal usage through gameplay.

### Command Reference Panel

- Always visible on the right side of the screen (toggleable with `:map` or a dedicated key)
- Shows all unlocked commands grouped by mode
- New commands are highlighted with a "NEW" badge for the first stage after unlock
- Grayed-out entries for commands not yet unlocked, to build curiosity

### Keystroke Counter & VIM Golf

- Every stage has a "par" keystroke count for optimal play
- Player's actual keystroke count is displayed in real-time
- End-of-stage summary shows: keystrokes used, par, efficiency rating (S/A/B/C)
- Optional "VIM Golf" challenge mode: replay any completed stage with a strict keystroke limit

### Hint System

- If a player is struggling (e.g., using `h` 15 times when `15h` or `$` would work), a subtle hint appears: "Tip: try `$` to jump to end of row"
- Hints are non-intrusive (small text in the message area of the status bar)
- Can be disabled in settings

---

## UI Layout

The entire screen is rendered as a single character grid — no HTML elements overlaid on the game. Everything is cells with characters and colors, like a terminal application.

```
╔═══════════════════════════════════════════════════════════════╗
║  :wq!   Stage 3: Line Discipline    Wave 2/5      Gold: 450  ║
╠═════════════════════════════════════════╦═════════════════════╣
║ . . . . . . . . . . . . . . . . . . . .║ COMMANDS            ║
║ . . . . .▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒. . . . . . .║                     ║
║ . . . > .▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒. . . . . . .║ -- NORMAL --        ║
║ . . . . .▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒. O . * . . .║ h/j/k/l  move      ║
║ . . . . .▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒. . . . . . .║ w/b      jump tower║
║ . . > . .▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒. . . . . . .║ 0/$      row ends  ║
║ . . . . .▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒. . > . . . .║ x        quick sell║
║ . . . . .▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒. . . . . . .║                     ║
║ . . . . .▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒. . . . . . .║ -- INSERT --        ║
║ . . * . .▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒. . . O . . .║ i    enter          ║
║ . . . . .▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒. . . . . . .║ 1-9  place tower   ║
║ . . . . . . . . . . . . . . . . . . . .║ Esc  exit           ║
║                                         ║                     ║
║ Build: [1]> [2]O [3]* [4]~ [5]. [6]+   ║ Keys: 47  Par: 38  ║
╠═════════════════════════════════════════╩═════════════════════╣
║ -- NORMAL --                          12,7          :help     ║
╚═══════════════════════════════════════════════════════════════╝
```

- `▒` = enemy path (brown background, no foreground character)
- `.` = buildable grass terrain (dark green background, dim green foreground)
- `>`, `O`, `*` = placed towers (bright colored foreground on terrain background)
- The cursor cell has a bright yellow or white background, making it pop against the dark terrain
- Everything inside the box-drawing border is rendered on the same canvas — no DOM/canvas split

### Status Bar (bottom)

Mimics VIM exactly:

- Left: current mode (e.g., `-- NORMAL --`, `-- INSERT --`, `-- VISUAL --`)
- Center: cursor position as row,col
- Right: last command feedback / message area

### Build Menu (above status bar)

- Only visible in Insert mode (or always as a subtle reference)
- Shows tower types with their number key and character glyph

---

## Technical Architecture

### Stack

- **Renderer:** HTML5 Canvas with a fixed-size character grid. Each cell is rendered as a colored rectangle (background) with a character drawn on top (foreground). This gives full control over CP437 glyphs and per-cell coloring without fighting CSS layout. A bitmap font texture atlas (CP437 tileset) is ideal for crisp, pixel-perfect rendering at any scale.
- **Framework:** Vanilla JS or lightweight framework (Preact/Svelte for reactivity without overhead). The game loop itself should be vanilla — framework only for UI panels if needed.
- **State management:** Simple pub/sub or a small state machine for game state and mode transitions
- **Pathfinding:** A\* for enemy pathing (recalculated when walls are placed)
- **Font:** CP437-compatible bitmap font loaded as a tileset image (16×16 glyph grid). Alternatives: Terminus, IBM VGA 8×16, or Square as web fonts with a canvas text fallback.
- **Deployment:** Static site — Cloudflare Pages

### Key Technical Considerations

1. **Input handling** — The keystroke parser needs to handle VIM's grammar: buffered input for multi-key commands (`dd`, `3j`, `gg`), timeout for ambiguous prefixes, and mode-aware key mapping. This is the most critical piece to get right.
2. **Command composability** — The `{count}{verb}{noun}` pattern needs a small parser. A simple state machine: accumulate digits → identify verb → identify noun/motion → execute.
3. **Undo system** — Implement as a command stack. Every action pushes to the stack; `u` pops; `Ctrl-r` re-pushes. Cap at ~50 actions per stage.
4. **Yank register** — Store yanked tower layouts as a 2D array of tower types. Paste overlays this at the cursor position, skipping path cells.
5. **Enemy pathing** — Pre-compute the default path. If walls (`#`) are placed, recalculate with A\*. If no valid path exists, reject the wall placement (VIM-style error message in status bar: `E: No valid path`).
6. **Save system** — LocalStorage for save data. Store: unlocked stages, per-stage best scores, current in-progress stage state.

### File Structure (suggested)

```
/src
  /engine
    game.js          — Core game loop, state management
    input.js         — VIM keystroke parser and command execution
    grid.js          — Grid state, tower placement logic
    pathfinding.js   — A* implementation, path validation
    enemies.js       — Enemy spawning, movement, types
    towers.js        — Tower definitions, targeting, upgrades
    economy.js       — Gold, scoring, keystroke tracking
    undo.js          — Undo/redo command stack
  /ui
    renderer.js      — Canvas-based CP437 character grid renderer
    statusbar.js     — VIM-style status bar
    commandline.js   — Command mode input and parsing
    reference.js     — Command reference panel
    tutorial.js      — Tutorial overlay system
    hud.js           — HUD elements (gold, wave info, build menu)
  /stages
    stage-data.js    — Stage definitions (grid layouts, waves, unlocks)
    progression.js   — Unlock tracking, stage transitions
  /assets
    enemies/         — Enemy sprites or character definitions
    audio/           — Sound effects (optional)
  index.html
  styles.css
  main.js            — Entry point
```

---

## Audio & Feedback (Optional, Low Priority)

- Keystroke sounds (subtle mechanical keyboard clicks) for satisfying input feedback
- Mode-switch sound (distinct tone for Normal → Insert → Visual)
- Tower placement / sell sounds
- Enemy defeat sounds
- Wave start / complete fanfare
- Background music: lo-fi / synthwave, toggleable

---

## Scope & Prioritization

### MVP (Stages 1–4)

- Grid rendering with cursor
- Normal mode movement (`h/j/k/l`, `w/b`, `0/$`, `gg/G`, count prefixes)
- Insert mode with tower placement (Arrow, Cannon, Frost)
- Basic enemy pathing and combat
- 4 stages with guided tutorial
- Status bar with mode display
- Command mode (`:q`, `:w`, `:help`, `:map`)

### V1 (Stages 5–8)

- Full tower roster
- Visual mode (character and line)
- Yank/put system
- Undo/redo
- Search (`/`, `n`, `N`)
- Keystroke tracking and par scoring
- Hint system
- Save/load

### V2 (Stages 9–12)

- Block visual mode
- Range commands
- Substitution (`:s`)
- Full 12-stage campaign
- VIM Golf challenge mode
- Leaderboard (optional)
- Sound/music (optional)

---

## Design Decisions

1. **No mouse support.** The game is keyboard-only. If a mouse click is detected, the game surfaces a contextual hint: e.g., "Try `5j` instead." This reinforces learning rather than accommodating escape hatches.
2. **No mobile support.** VIM is a keyboard-native paradigm. Desktop/laptop only.
3. **Custom keymaps** — Deferred post-MVP. Teach standard VIM bindings first.
4. **Multiplayer** — Deferred post-MVP.
5. **Path design** — Fixed paths only for MVP. Open-field/maze-style maps deferred post-MVP.
