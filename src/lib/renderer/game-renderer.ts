/**
 * Game renderer — converts live game state to a cell buffer for canvas display.
 *
 * Reads from Game (engine state) and writes to CellBuffer (renderer state).
 * This is the bridge between the engine and the canvas.
 */

import type { Game } from '$lib/engine/game.js';
import { getPendingInput, isLeakFlashing } from '$lib/engine/game.js';
import { getTower } from '$lib/engine/grid.js';
import { calculateRating } from '$lib/stages/progression.js';
import type { ScreenLayout } from './screen-layout.js';
import type { CellBuffer } from './grid-renderer.js';
import { createCellBuffer, setCell, writeText, fillRect, drawChrome, drawBox } from './grid-renderer.js';
import { colors, palette } from './colors.js';
import { getPositionOnPath } from '$lib/engine/path-manager.js';
import { getTutorialHighlight } from '$lib/engine/tutorial.js';
import { getEnemyStats } from '$lib/engine/enemy-stats.js';
import { getTowerStats } from '$lib/engine/tower-stats.js';
import { GAME_MODES, GAME_PHASES } from '$lib/types/game.js';
import type { CellType, TowerType, GameMode, Enemy } from '$lib/types/game.js';

const TOWER_CHARS: Record<TowerType, number> = {
	arrow: '>'.charCodeAt(0),
	cannon: 'O'.charCodeAt(0),
	frost: '*'.charCodeAt(0),
	lightning: '~'.charCodeAt(0)
};

const TOWER_COLORS: Record<TowerType, string> = {
	arrow: colors.towerArrow,
	cannon: colors.towerCannon,
	frost: colors.towerFrost,
	lightning: colors.towerLightning
};

const ENEMY_COLORS: Record<string, string> = {
	walker: colors.enemyWalker,
	runner: colors.enemyRunner,
	tank: colors.enemyTank
};

const TERRAIN_DISPLAY: Record<CellType, { char: number; fg: string; bg: string }> = {
	empty: { char: 250, fg: colors.uiTextDim, bg: colors.terrainEmpty }, // middle dot
	path: { char: 176, fg: colors.terrainPathChar, bg: colors.terrainPath }, // light shade
	spawn: { char: 'S'.charCodeAt(0), fg: palette.white, bg: colors.terrainSpawn },
	exit: { char: 'E'.charCodeAt(0), fg: palette.white, bg: colors.terrainExit }
};

// Mode chip on the status bar: coloured background with dark or light text
const MODE_DISPLAY: Record<GameMode, { text: string; color: string; textColor: string }> = {
	normal: { text: ' NORMAL ', color: colors.modeNormal, textColor: palette.black },
	insert: { text: ' -- INSERT -- ', color: colors.modeInsert, textColor: palette.white },
	command: { text: ' COMMAND ', color: colors.modeCommand, textColor: palette.black },
	visual: { text: ' -- VISUAL -- ', color: colors.modeVisual, textColor: palette.black }
};

const PHASE_LABELS: Record<string, string> = {
	planning: 'PLANNING',
	combat: 'COMBAT',
	wave_complete: 'COMBAT',
	stage_complete: 'COMPLETE',
	game_over: 'GAME OVER'
};

// Health bar segments: lower half block for health left (leaves a gap
// between rows), dot for health lost
const BAR_FULL = 220;
const BAR_EMPTY = 250;

/**
 * Render the full game state into a cell buffer.
 */
export function renderGame(game: Game, layout: ScreenLayout): CellBuffer {
	const buf = createCellBuffer(layout.totalCols, layout.totalRows);

	drawChrome(buf, layout);
	drawHeader(buf, game, layout);
	drawTerrain(buf, game, layout);
	drawRangePreview(buf, game, layout);
	drawTutorialHighlight(buf, game, layout);
	drawTowers(buf, game, layout);
	drawEnemies(buf, game, layout);
	drawEffects(buf, game, layout);
	drawCursor(buf, game, layout);
	drawIntroBox(buf, game, layout);
	drawBuildMenu(buf, game, layout);
	drawSidebar(buf, game, layout);
	drawStatusBar(buf, game, layout);
	drawMessageLine(buf, game, layout);

	// Overlay for terminal game states
	if (game.state.phase === GAME_PHASES.gameOver) {
		drawOverlay(buf, layout, 'GAME OVER', colors.health, ['Press Enter to return to menu']);
	} else if (game.state.phase === GAME_PHASES.stageComplete) {
		drawOverlay(buf, layout, 'STAGE COMPLETE!', colors.modeNormal, stageCompleteLines(game));
	}

	if (game.state.helpOpen) drawHelp(buf, layout);

	return buf;
}

function drawHeader(buf: CellBuffer, game: Game, layout: ScreenLayout): void {
	const { header } = layout;
	const bg = colors.uiBackground;

	// Title
	writeText(buf, header.x, header.y, ':wq!', colors.uiTextBright, bg);

	// Stage and wave info
	const waveText = `W${game.state.currentWave}/${game.state.totalWaves}`;
	writeText(buf, header.x + 6, header.y, waveText, colors.wave, bg);

	// Gold
	const goldText = `${game.state.gold}g`;
	const goldX = header.x + header.width - goldText.length - 8;
	writeText(buf, goldX, header.y, goldText, colors.gold, bg);

	// Lives
	const livesText = `${game.state.lives}hp`;
	const livesX = header.x + header.width - livesText.length;
	const flashing = isLeakFlashing(game);
	writeText(buf, livesX, header.y, livesText, flashing ? palette.white : colors.health, flashing ? palette.darkRed : bg);
}

function drawTerrain(buf: CellBuffer, game: Game, layout: ScreenLayout): void {
	const { gameGrid } = layout;

	for (let y = 0; y < game.grid.height; y++) {
		for (let x = 0; x < game.grid.width; x++) {
			const cellType = game.grid.cells[y][x];
			const display = TERRAIN_DISPLAY[cellType];
			setCell(buf, gameGrid.x + x, gameGrid.y + y, display.char, display.fg, display.bg);
		}
	}
}

/**
 * Show which cells a tower reaches. In NORMAL mode this is the tower under the
 * cursor; in INSERT mode it previews the tower you would build next.
 */
function drawRangePreview(buf: CellBuffer, game: Game, layout: ScreenLayout): void {
	const { cursor, mode, phase } = game.state;
	if (phase === GAME_PHASES.stageComplete || phase === GAME_PHASES.gameOver) return;

	const towerHere = getTower(game.grid, cursor.x, cursor.y);
	const type: TowerType | null =
		mode === GAME_MODES.insert ? game.state.selectedTowerType : (towerHere?.type ?? null);
	if (!type) return;

	const range = getTowerStats(type).range;
	const { gameGrid } = layout;
	for (let y = 0; y < game.grid.height; y++) {
		for (let x = 0; x < game.grid.width; x++) {
			const dx = x - cursor.x;
			const dy = y - cursor.y;
			if (dx * dx + dy * dy > range * range) continue;
			const idx = (gameGrid.y + y) * buf.width + gameGrid.x + x;
			const cell = buf.cells[idx];
			const cellType = game.grid.cells[y][x];
			if (cellType === 'empty') cell.fg = TOWER_COLORS[type];
			else if (cellType === 'path') cell.fg = colors.uiText;
		}
	}
}

/** Flash the target cell (and the firing tower) for each recent hit */
function drawEffects(buf: CellBuffer, game: Game, layout: ScreenLayout): void {
	const { gameGrid } = layout;
	for (const effect of game.effects) {
		if (effect.kind === 'shot') {
			paintCell(buf, gameGrid.x + effect.toX, gameGrid.y + effect.toY, palette.black, TOWER_COLORS[effect.towerType]);
			paintCell(buf, gameGrid.x + effect.fromX, gameGrid.y + effect.fromY, palette.white, palette.darkGray);
		} else {
			paintCell(buf, gameGrid.x + effect.x, gameGrid.y + effect.y, palette.white, palette.red);
		}
	}
}

/** Recolour an already-drawn cell, keeping its character */
function paintCell(buf: CellBuffer, x: number, y: number, fg: string, bg: string): void {
	if (x < 0 || x >= buf.width || y < 0 || y >= buf.height) return;
	const cell = buf.cells[y * buf.width + x];
	cell.fg = fg;
	cell.bg = bg;
}

function drawTutorialHighlight(buf: CellBuffer, game: Game, layout: ScreenLayout): void {
	const highlight = getTutorialHighlight(game.tutorial);
	if (!highlight) return;

	const { gameGrid } = layout;
	const hx = gameGrid.x + highlight.x;
	const hy = gameGrid.y + highlight.y;
	if (hx >= 0 && hx < buf.width && hy >= 0 && hy < buf.height) {
		const idx = hy * buf.width + hx;
		const cell = buf.cells[idx];
		cell.bg = palette.darkYellow;
		cell.fg = palette.white;
	}
}

function drawTowers(buf: CellBuffer, game: Game, layout: ScreenLayout): void {
	const { gameGrid } = layout;

	for (const tower of game.grid.towers.values()) {
		const char = TOWER_CHARS[tower.type];
		const fg = TOWER_COLORS[tower.type];
		setCell(buf, gameGrid.x + tower.x, gameGrid.y + tower.y, char, fg, colors.terrainEmpty);
	}
}

function drawEnemies(buf: CellBuffer, game: Game, layout: ScreenLayout): void {
	const { gameGrid } = layout;

	for (const enemy of game.enemies.enemies) {
		if (!enemy.alive) continue;

		const pos = getPositionOnPath(game.enemies.path, enemy.pathIndex, enemy.pathProgress);
		const screenX = Math.round(pos.x);
		const screenY = Math.round(pos.y);

		// Only draw if within grid bounds
		if (screenX >= 0 && screenX < game.grid.width && screenY >= 0 && screenY < game.grid.height) {
			const stats = getEnemyStats(enemy.type);
			const charCode = stats.char.charCodeAt(0);
			const fg = enemy.hp < enemy.maxHp * 0.5 ? colors.enemyDamaged : (ENEMY_COLORS[enemy.type] ?? colors.enemyWalker);
			// Slowed enemies sit on an icy background
			const bg = enemy.slowTimer > 0 ? palette.darkCyan : colors.terrainPath;
			setCell(buf, gameGrid.x + screenX, gameGrid.y + screenY, charCode, fg, bg);
		}
	}
}

function drawCursor(buf: CellBuffer, game: Game, layout: ScreenLayout): void {
	const { gameGrid } = layout;
	const { cursor, mode } = game.state;

	const cx = gameGrid.x + cursor.x;
	const cy = gameGrid.y + cursor.y;

	if (cx < 0 || cx >= buf.width || cy < 0 || cy >= buf.height) return;

	// Get the existing cell content and overlay the cursor color as background
	const idx = cy * buf.width + cx;
	const cell = buf.cells[idx];
	const cursorColor = mode === GAME_MODES.insert ? colors.cursorInsert : colors.cursorNormal;

	cell.bg = cursorColor;
	// Keep existing char and fg, but make fg brighter for visibility
	if (cell.fg === colors.terrainEmpty || cell.fg === colors.terrainPathChar) {
		cell.fg = palette.white;
	}
}

function drawBuildMenu(buf: CellBuffer, game: Game, layout: ScreenLayout): void {
	const { buildMenu } = layout;
	const bg = colors.uiBackground;
	const isInsert = game.state.mode === GAME_MODES.insert;

	const allTowers: { key: string; type: TowerType }[] = [
		{ key: '1', type: 'arrow' },
		{ key: '2', type: 'cannon' },
		{ key: '3', type: 'frost' },
		{ key: '4', type: 'lightning' }
	];
	const towers = allTowers.filter((t) => game.state.availableTowers.includes(t.type));

	let x = buildMenu.x;
	for (const t of towers) {
		const stats = getTowerStats(t.type);
		const char = String.fromCharCode(TOWER_CHARS[t.type]);
		const color = TOWER_COLORS[t.type];
		const highlight = isInsert && game.state.selectedTowerType === t.type;
		const fgColor = highlight ? palette.white : color;
		const bgColor = highlight ? color : bg;
		// Space between glyph and cost so the Cannon's O doesn't read as a zero
		const text = `${t.key}:${char} ${stats.cost}g  `;
		writeText(buf, x, buildMenu.y, text, fgColor, bgColor);
		x += text.length;
	}
}

function drawSidebar(buf: CellBuffer, game: Game, layout: ScreenLayout): void {
	const { sidebar, header } = layout;
	const bg = colors.uiBackground;
	const titleY = header.y;
	const x = sidebar.x + 1;

	writeText(buf, x, titleY, 'COMMANDS', colors.uiTextBright, bg);

	const dividerY = header.y + header.height + 1;
	let y = dividerY;

	writeText(buf, x, y++, PHASE_LABELS[game.state.phase] ?? 'PLANNING', colors.wave, bg);
	y++;

	const line = (text: string) => writeText(buf, x, y++, text, colors.uiText, bg);

	if (game.state.mode === GAME_MODES.insert) {
		line('1-4      tower');
		line('h/j/k/l  move');
		line('Esc      normal');
	} else if (game.state.mode === GAME_MODES.command) {
		line('Type command...');
		line('Enter    exec');
		line('Esc      cancel');
	} else if (game.state.phase === GAME_PHASES.combat) {
		drawEnemyList(buf, game, x, y, sidebar.y + sidebar.height - 1 - y);
	} else {
		line('h/j/k/l  move');
		line('w/b      towers');
		line('0/$      row');
		line('gg/G     grid');
		line('i/a/o/O  insert');
		line('x        sell');
		line(':w       wave');
		line(':help    keys');
	}
}

/** Enemies nearest the exit, each with a health bar */
function drawEnemyList(buf: CellBuffer, game: Game, x: number, y: number, rows: number): void {
	const bg = colors.uiBackground;
	const alive = game.enemies.enemies.filter((e) => e.alive);
	const pending = Math.max(0, game.waves.totalToSpawn - game.waves.totalSpawned);
	writeText(buf, x, y++, `ENEMIES ${alive.length + pending}`, colors.uiTextBright, bg);

	const sorted = [...alive].sort((a, b) => progressOf(b) - progressOf(a));
	const shown = sorted.slice(0, Math.max(0, rows - 2));
	for (const enemy of shown) {
		drawEnemyRow(buf, enemy, x, y++);
	}
	writeText(buf, x, y + Math.max(0, rows - 2 - shown.length), 'i build  :q! quit', colors.uiTextDim, bg);
}

function progressOf(enemy: Enemy): number {
	return enemy.pathIndex + enemy.pathProgress;
}

function drawEnemyRow(buf: CellBuffer, enemy: Enemy, x: number, y: number): void {
	const bg = colors.uiBackground;
	const BAR = 12;
	const stats = getEnemyStats(enemy.type);
	const color = ENEMY_COLORS[enemy.type] ?? colors.enemyWalker;
	setCell(buf, x, y, stats.char.charCodeAt(0), color, bg);
	const filled = Math.max(1, Math.ceil((enemy.hp / enemy.maxHp) * BAR));
	for (let i = 0; i < BAR; i++) {
		const full = i < filled;
		setCell(buf, x + 2 + i, y, full ? BAR_FULL : BAR_EMPTY, full ? color : colors.uiTextDim, bg);
	}
	if (enemy.slowTimer > 0) writeText(buf, x + 3 + BAR, y, 'slow', colors.frost, bg);
}

function drawStatusBar(buf: CellBuffer, game: Game, layout: ScreenLayout): void {
	const { statusBar } = layout;
	const bg = palette.darkGray;

	// Fill entire status bar with background
	fillRect(buf, statusBar, 0, colors.uiText, bg);

	// Mode chip (left)
	const modeInfo = MODE_DISPLAY[game.state.mode];
	writeText(buf, statusBar.x, statusBar.y, modeInfo.text, modeInfo.textColor, modeInfo.color);

	// Cursor position (right), as VIM's ruler: line,column counted from 1
	const posText = `${game.state.cursor.y + 1},${game.state.cursor.x + 1}`;
	const posX = statusBar.x + statusBar.width - posText.length - 1;
	writeText(buf, posX, statusBar.y, posText, colors.uiTextBright, bg);

	// Unfinished command keys (count, g), left of the ruler like VIM's showcmd
	const pending = getPendingInput(game);
	if (pending) {
		writeText(buf, posX - 4 - pending.length, statusBar.y, pending, colors.modeCommand, bg);
	}
}

/** Message line below the status bar, like VIM's command line */
function drawMessageLine(buf: CellBuffer, game: Game, layout: ScreenLayout): void {
	const { messageLine } = layout;
	const bg = colors.uiBackground;
	const maxLen = messageLine.width - 2;

	if (game.state.mode === GAME_MODES.command) {
		const cmdText = `:${game.state.commandBuffer}`.slice(-maxLen);
		writeText(buf, messageLine.x + 1, messageLine.y, cmdText, colors.modeCommand, bg);
	} else if (game.state.message) {
		const msg = game.state.message.slice(0, maxLen);
		const color = msg.startsWith('E:') ? colors.health : colors.uiTextBright;
		writeText(buf, messageLine.x + 1, messageLine.y, msg, color, bg);
	}
}

function stageCompleteLines(game: Game): string[] {
	const keys = game.state.keystrokeCount;
	const par = game.stageConfig.parKeystrokes;
	if (!par) return [`Keystrokes: ${keys}`, 'Press Enter to continue'];
	const rating = calculateRating(keys, par);
	const verdict = keys <= par ? 'At or under par!' : `${keys - par} over par`;
	return [`Keys ${keys}  Par ${par}  Rank ${rating}`, verdict, 'Press Enter to continue'];
}

function drawOverlay(buf: CellBuffer, layout: ScreenLayout, title: string, titleColor: string, lines: string[]): void {
	const { gameGrid, header } = layout;

	// Center overlay on the full content area (header width), not just the game grid
	const height = lines.length + 2;
	const top = gameGrid.y + Math.max(0, Math.floor((gameGrid.height - height) / 2));
	const centerX = header.x + Math.floor(header.width / 2);

	// Dark background band across the content area
	for (let y = top; y < top + height && y < buf.height; y++) {
		for (let x = header.x; x < header.x + header.width; x++) {
			setCell(buf, x, y, 0, colors.uiText, palette.black);
		}
	}

	writeText(buf, centerX - Math.floor(title.length / 2), top, title, titleColor, palette.black);
	lines.forEach((text, i) => {
		const color = i === lines.length - 1 ? colors.uiText : colors.uiTextBright;
		writeText(buf, centerX - Math.floor(text.length / 2), top + 2 + i, text, color, palette.black);
	});
}

/** Stage intro (new tower, new keys) in the free space beside the grid during wave 1 */
function drawIntroBox(buf: CellBuffer, game: Game, layout: ScreenLayout): void {
	const intro = game.stageConfig.introText;
	if (!intro || game.state.phase !== GAME_PHASES.planning || game.state.currentWave !== 1) return;

	const { gameGrid, header, buildMenu } = layout;
	const x = gameGrid.x + gameGrid.width + 1;
	const width = header.x + header.width - x;
	const height = buildMenu.y - 1 - gameGrid.y;
	if (width < 12) return;

	const lines = wrapText(intro, width - 4);
	const boxH = Math.min(height, lines.length + 2);
	drawBox(buf, x, gameGrid.y, width, boxH, colors.modeCommand, colors.uiBackground);
	writeText(buf, x + 2, gameGrid.y, ' NEW ', colors.modeCommand, colors.uiBackground);
	lines.slice(0, boxH - 2).forEach((text, i) => {
		writeText(buf, x + 2, gameGrid.y + 1 + i, text, colors.uiTextBright, colors.uiBackground);
	});
}

/** Greedy word wrap for monospace text */
function wrapText(text: string, width: number): string[] {
	const lines: string[] = [];
	let current = '';
	for (const word of text.split(' ')) {
		if (current && current.length + 1 + word.length > width) {
			lines.push(current);
			current = word;
		} else {
			current = current ? `${current} ${word}` : word;
		}
	}
	if (current) lines.push(current);
	return lines;
}

// Descriptions stay within 19 characters so two columns fit the smallest screen
const HELP_LINES: [string, string][] = [
	['MOVE', ''],
	['h j k l', 'left down up right'],
	['5l  3j', 'count repeats move'],
	['w  b', 'next / prev tower'],
	['0  $', 'start / end of row'],
	['e', 'last tower in row'],
	['gg  G', 'first / last cell'],
	['BUILD', ''],
	['i', 'insert here'],
	['a  o  O', 'right/below/above'],
	['1-4', 'build (INSERT)'],
	['x', 'sell tower here'],
	['Esc', 'back to NORMAL'],
	['COMMANDS', ''],
	[':w', 'start next wave'],
	[':q!', 'quit the stage']
];

/** Full key reference, drawn over everything above the status bar */
function drawHelp(buf: CellBuffer, layout: ScreenLayout): void {
	const height = layout.statusBar.y;
	drawBox(buf, 0, 0, layout.totalCols, height, colors.modeCommand, palette.black);
	for (let y = 1; y < height - 1; y++) {
		for (let x = 1; x < layout.totalCols - 1; x++) setCell(buf, x, y, 0, colors.uiText, palette.black);
	}
	writeText(buf, 2, 0, ' HELP ', colors.modeCommand, palette.black);
	const footer = ' Press any key to close ';
	writeText(buf, layout.totalCols - footer.length - 2, height - 1, footer, colors.uiTextBright, palette.black);

	// Two columns when the screen is short
	const rowsAvailable = height - 2;
	const perColumn = Math.ceil(HELP_LINES.length / Math.ceil(HELP_LINES.length / rowsAvailable));
	const colWidth = Math.floor((layout.totalCols - 2) / Math.ceil(HELP_LINES.length / perColumn));
	HELP_LINES.forEach(([key, desc], i) => {
		const col = Math.floor(i / perColumn);
		const x = 2 + col * colWidth;
		const y = 1 + (i % perColumn);
		if (!desc) {
			writeText(buf, x, y, key, colors.wave, palette.black);
		} else {
			writeText(buf, x, y, key, colors.modeNormal, palette.black);
			writeText(buf, x + 9, y, desc.slice(0, colWidth - 10), colors.uiText, palette.black);
		}
	});
}
