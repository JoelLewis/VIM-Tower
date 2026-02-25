/**
 * Color palette for VIM Tower Defense.
 * All colors are CSS hex strings for canvas fillStyle.
 */

// Base terminal palette (CGA-inspired)
export const palette = {
	black: '#000000',
	darkGray: '#555555',
	gray: '#aaaaaa',
	white: '#ffffff',
	darkRed: '#aa0000',
	red: '#ff5555',
	darkGreen: '#00aa00',
	green: '#55ff55',
	darkYellow: '#aa5500',
	yellow: '#ffff55',
	darkBlue: '#0000aa',
	blue: '#5555ff',
	darkMagenta: '#aa00aa',
	magenta: '#ff55ff',
	darkCyan: '#00aaaa',
	cyan: '#55ffff'
} as const;

// Semantic colors — game elements reference these
export const colors = {
	// UI chrome
	uiBorder: palette.darkGray,
	uiBorderHighlight: palette.gray,
	uiBackground: palette.black,
	uiText: palette.gray,
	uiTextBright: palette.white,
	uiTextDim: palette.darkGray,

	// Mode indicators
	modeNormal: palette.green,
	modeInsert: palette.blue,
	modeCommand: palette.yellow,
	modeVisual: palette.magenta,

	// Terrain
	terrainEmpty: palette.black,
	terrainPath: palette.darkYellow,
	terrainPathChar: palette.darkGray,
	terrainWall: palette.darkGray,
	terrainSpawn: palette.darkRed,
	terrainExit: palette.darkGreen,

	// Towers
	towerArrow: palette.cyan,
	towerCannon: palette.red,
	towerFrost: palette.blue,
	towerLightning: palette.yellow,
	towerRange: palette.darkGray,

	// Enemies
	enemyWalker: palette.green,
	enemyRunner: palette.yellow,
	enemyTank: palette.red,
	enemyDamaged: palette.darkRed,

	// Cursor
	cursorNormal: palette.green,
	cursorInsert: palette.blue,

	// Combat effects
	projectile: palette.white,
	explosion: palette.red,
	frost: palette.cyan,
	lightning: palette.yellow,

	// HUD
	gold: palette.yellow,
	health: palette.red,
	wave: palette.cyan,
	keystroke: palette.green
} as const;
