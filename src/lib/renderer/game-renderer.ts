/**
 * Game renderer — converts live game state to a cell buffer for canvas display.
 *
 * Reads from Game (engine state) and writes to CellBuffer (renderer state).
 * This is the bridge between the engine and the canvas.
 */

import type { Game } from '$lib/engine/game.js';
import type { ScreenLayout } from './screen-layout.js';
import type { CellBuffer } from './grid-renderer.js';
import { createCellBuffer, setCell, writeText, fillRect, drawChrome } from './grid-renderer.js';
import { colors, palette } from './colors.js';
import { getPositionOnPath } from '$lib/engine/path-manager.js';
import { getTutorialHighlight } from '$lib/engine/tutorial.js';
import { getEnemyStats } from '$lib/engine/enemy-stats.js';
import { getTowerStats } from '$lib/engine/tower-stats.js';
import { GAME_MODES, GAME_PHASES } from '$lib/types/game.js';
import type { CellType, TowerType, GameMode } from '$lib/types/game.js';

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
	empty: { char: 250, fg: colors.terrainEmpty, bg: colors.terrainEmpty }, // middle dot
	path: { char: 176, fg: colors.terrainPathChar, bg: colors.terrainPath }, // light shade
	spawn: { char: 'S'.charCodeAt(0), fg: palette.white, bg: colors.terrainSpawn },
	exit: { char: 'E'.charCodeAt(0), fg: palette.white, bg: colors.terrainExit }
};

const MODE_DISPLAY: Record<GameMode, { text: string; color: string }> = {
	normal: { text: 'NORMAL', color: colors.modeNormal },
	insert: { text: '-- INSERT --', color: colors.modeInsert },
	command: { text: ':', color: colors.modeCommand },
	visual: { text: '-- VISUAL --', color: colors.modeVisual }
};

/**
 * Render the full game state into a cell buffer.
 */
export function renderGame(game: Game, layout: ScreenLayout): CellBuffer {
	const buf = createCellBuffer(layout.totalCols, layout.totalRows);

	drawChrome(buf, layout);
	drawHeader(buf, game, layout);
	drawTerrain(buf, game, layout);
	drawTutorialHighlight(buf, game, layout);
	drawTowers(buf, game, layout);
	drawEnemies(buf, game, layout);
	drawCursor(buf, game, layout);
	drawBuildMenu(buf, game, layout);
	drawSidebar(buf, game, layout);
	drawStatusBar(buf, game, layout);

	// Overlay for terminal game states
	if (game.state.phase === GAME_PHASES.gameOver) {
		drawOverlay(buf, layout, 'GAME OVER', colors.health, 'Press Enter to return to menu');
	} else if (game.state.phase === GAME_PHASES.stageComplete) {
		drawOverlay(buf, layout, 'STAGE COMPLETE!', colors.modeNormal,
			`Keystrokes: ${game.state.keystrokeCount} — Press Enter`);
	}

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
	writeText(buf, livesX, header.y, livesText, colors.health, bg);
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
			setCell(buf, gameGrid.x + screenX, gameGrid.y + screenY, charCode, fg, colors.terrainPath);
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

	const towers: { key: string; name: string; type: TowerType }[] = [
		{ key: '1', name: 'Arrow', type: 'arrow' },
		{ key: '2', name: 'Cannon', type: 'cannon' },
		{ key: '3', name: 'Frost', type: 'frost' },
		{ key: '4', name: 'Lnng', type: 'lightning' }
	];

	let x = buildMenu.x;
	for (const t of towers) {
		const stats = getTowerStats(t.type);
		const char = String.fromCharCode(TOWER_CHARS[t.type]);
		const color = TOWER_COLORS[t.type];
		const highlight = isInsert && game.state.selectedTowerType === t.type;
		const fgColor = highlight ? palette.white : color;
		const bgColor = highlight ? color : bg;
		const text = `${t.key}:${char}${stats.cost}g `;
		writeText(buf, x, buildMenu.y, text, fgColor, bgColor);
		x += text.length;
	}
}

function drawSidebar(buf: CellBuffer, game: Game, layout: ScreenLayout): void {
	const { sidebar, header } = layout;
	const bg = colors.uiBackground;
	const titleY = header.y;

	writeText(buf, sidebar.x + 1, titleY, 'COMMANDS', colors.uiTextBright, bg);

	const dividerY = header.y + header.height + 1;
	let y = dividerY;

	const phaseLabel = game.state.phase === GAME_PHASES.combat ? 'COMBAT' : 'PLANNING';
	writeText(buf, sidebar.x + 1, y++, phaseLabel, colors.wave, bg);
	y++;

	// Show mode-appropriate commands
	if (game.state.mode === GAME_MODES.normal) {
		writeText(buf, sidebar.x + 1, y++, 'h/j/k/l  move', colors.uiText, bg);
		writeText(buf, sidebar.x + 1, y++, 'w/b      towers', colors.uiText, bg);
		writeText(buf, sidebar.x + 1, y++, '0/$      row', colors.uiText, bg);
		writeText(buf, sidebar.x + 1, y++, 'gg/G     grid', colors.uiText, bg);
		writeText(buf, sidebar.x + 1, y++, 'i        insert', colors.uiText, bg);
		writeText(buf, sidebar.x + 1, y++, 'x        sell', colors.uiText, bg);
		writeText(buf, sidebar.x + 1, y++, ':w       wave', colors.uiText, bg);
		writeText(buf, sidebar.x + 1, y, ':q!      quit', colors.uiText, bg);
	} else if (game.state.mode === GAME_MODES.insert) {
		writeText(buf, sidebar.x + 1, y++, '1-4      tower', colors.uiText, bg);
		writeText(buf, sidebar.x + 1, y++, 'h/j/k/l  move', colors.uiText, bg);
		writeText(buf, sidebar.x + 1, y, 'Esc      normal', colors.uiText, bg);
	} else if (game.state.mode === GAME_MODES.command) {
		writeText(buf, sidebar.x + 1, y++, 'Type command...', colors.uiText, bg);
		writeText(buf, sidebar.x + 1, y++, 'Enter    exec', colors.uiText, bg);
		writeText(buf, sidebar.x + 1, y, 'Esc      cancel', colors.uiText, bg);
	}
}

function drawStatusBar(buf: CellBuffer, game: Game, layout: ScreenLayout): void {
	const { statusBar } = layout;
	const bg = palette.darkGray;

	// Fill entire status bar with background
	fillRect(buf, statusBar, 0, colors.uiText, bg);

	// Mode indicator (left)
	const modeInfo = MODE_DISPLAY[game.state.mode];
	if (game.state.mode === GAME_MODES.command) {
		// Show command buffer
		const cmdText = `:${game.state.commandBuffer}`;
		writeText(buf, statusBar.x, statusBar.y, cmdText, modeInfo.color, bg);
	} else {
		writeText(buf, statusBar.x, statusBar.y, modeInfo.text, modeInfo.color, bg);
	}

	// Message (center)
	if (game.state.message) {
		const msgX = statusBar.x + 15;
		const maxLen = statusBar.width - 30;
		const msg = game.state.message.slice(0, maxLen);
		writeText(buf, msgX, statusBar.y, msg, colors.uiTextBright, bg);
	}

	// Cursor position (right)
	const posText = `${game.state.cursor.x},${game.state.cursor.y}`;
	const posX = statusBar.x + statusBar.width - posText.length - 1;
	writeText(buf, posX, statusBar.y, posText, colors.uiText, bg);
}

function drawOverlay(buf: CellBuffer, layout: ScreenLayout, title: string, titleColor: string, subtitle: string): void {
	const { gameGrid } = layout;

	// Center the overlay on the game grid
	const centerY = gameGrid.y + Math.floor(gameGrid.height / 2);
	const centerX = gameGrid.x + Math.floor(gameGrid.width / 2);

	// Dark background band across the grid
	for (let dy = -2; dy <= 2; dy++) {
		const y = centerY + dy;
		if (y < gameGrid.y || y >= gameGrid.y + gameGrid.height) continue;
		for (let x = gameGrid.x; x < gameGrid.x + gameGrid.width; x++) {
			setCell(buf, x, y, 0, colors.uiText, palette.black);
		}
	}

	// Title
	const titleX = centerX - Math.floor(title.length / 2);
	writeText(buf, titleX, centerY - 1, title, titleColor, palette.black);

	// Subtitle
	const subX = centerX - Math.floor(subtitle.length / 2);
	writeText(buf, subX, centerY + 1, subtitle, colors.uiText, palette.black);
}
