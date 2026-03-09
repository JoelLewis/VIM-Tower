/**
 * E2E Test Helpers for VIM Tower Defense
 *
 * Utilities for waiting on game state transitions, extracting state from DOM,
 * simulating VIM key sequences, and verifying canvas rendering.
 */

import { expect, type Page, type Locator } from '@playwright/test';

// ─── Game State Types ────────────────────────────────────────────

export type GamePhase = 'planning' | 'combat' | 'wave_complete' | 'stage_complete' | 'game_over';
export type GameMode = 'normal' | 'insert' | 'command' | 'visual';

export interface GameState {
	phase: GamePhase;
	mode: GameMode;
	gold: number;
	lives: number;
	wave: number;
	totalWaves: number;
	keystrokeCount: number;
}

// ─── State Extraction ────────────────────────────────────────────

/**
 * Extract game state from data attributes on the game container.
 * Note: Requires data-testid attributes to be added to Game.svelte.
 */
export async function getGameState(page: Page): Promise<GameState | null> {
	const container = page.locator('[data-testid="game-container"]');
	const exists = (await container.count()) > 0;

	if (!exists) {
		return null;
	}

	const phase = (await container.getAttribute('data-phase')) as GamePhase | null;
	const mode = (await container.getAttribute('data-mode')) as GameMode | null;
	const gold = await container.getAttribute('data-gold');
	const lives = await container.getAttribute('data-lives');
	const wave = await container.getAttribute('data-wave');
	const totalWaves = await container.getAttribute('data-total-waves');
	const keystrokeCount = await container.getAttribute('data-keystrokes');

	if (!phase || !mode) {
		return null;
	}

	return {
		phase,
		mode,
		gold: gold ? parseInt(gold, 10) : 0,
		lives: lives ? parseInt(lives, 10) : 0,
		wave: wave ? parseInt(wave, 10) : 0,
		totalWaves: totalWaves ? parseInt(totalWaves, 10) : 0,
		keystrokeCount: keystrokeCount ? parseInt(keystrokeCount, 10) : 0
	};
}

/**
 * Get the current game phase from DOM.
 */
export async function getPhase(page: Page): Promise<GamePhase | null> {
	const state = await getGameState(page);
	return state?.phase ?? null;
}

/**
 * Get the current game mode from DOM.
 */
export async function getMode(page: Page): Promise<GameMode | null> {
	const state = await getGameState(page);
	return state?.mode ?? null;
}

// ─── Menu State Extraction ───────────────────────────────────────

export interface MenuState {
	selectedIndex: number;
	unlockedStages: number;
}

/**
 * Extract menu state from data attributes.
 * Note: Requires data-testid attributes to be added to +page.svelte.
 */
export async function getMenuState(page: Page): Promise<MenuState | null> {
	const container = page.locator('[data-testid="menu-container"]');
	const exists = (await container.count()) > 0;

	if (!exists) {
		return null;
	}

	const selectedIndex = await container.getAttribute('data-selected-index');
	const unlockedStages = await container.getAttribute('data-unlocked-stages');

	return {
		selectedIndex: selectedIndex ? parseInt(selectedIndex, 10) : 0,
		unlockedStages: unlockedStages ? parseInt(unlockedStages, 10) : 1
	};
}

// ─── Wait Functions ──────────────────────────────────────────────

export interface WaitOptions {
	timeout?: number;
	pollInterval?: number;
}

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_POLL_INTERVAL = 100;

/**
 * Wait for game phase to transition to the expected phase.
 */
export async function waitForPhase(
	page: Page,
	expectedPhase: GamePhase,
	options: WaitOptions = {}
): Promise<void> {
	const { timeout = DEFAULT_TIMEOUT, pollInterval = DEFAULT_POLL_INTERVAL } = options;

	await expect(async () => {
		const phase = await getPhase(page);
		expect(phase).toBe(expectedPhase);
	}).toPass({ timeout, intervals: [pollInterval] });
}

/**
 * Wait for game mode to transition to the expected mode.
 */
export async function waitForMode(
	page: Page,
	expectedMode: GameMode,
	options: WaitOptions = {}
): Promise<void> {
	const { timeout = DEFAULT_TIMEOUT, pollInterval = DEFAULT_POLL_INTERVAL } = options;

	await expect(async () => {
		const mode = await getMode(page);
		expect(mode).toBe(expectedMode);
	}).toPass({ timeout, intervals: [pollInterval] });
}

/**
 * Wait for game to be fully loaded (has valid state).
 */
export async function waitForGameReady(page: Page, options: WaitOptions = {}): Promise<void> {
	const { timeout = DEFAULT_TIMEOUT, pollInterval = DEFAULT_POLL_INTERVAL } = options;

	await expect(async () => {
		const state = await getGameState(page);
		expect(state).not.toBeNull();
	}).toPass({ timeout, intervals: [pollInterval] });
}

/**
 * Wait for menu to be fully loaded.
 */
export async function waitForMenuReady(page: Page, options: WaitOptions = {}): Promise<void> {
	const { timeout = DEFAULT_TIMEOUT, pollInterval = DEFAULT_POLL_INTERVAL } = options;

	await expect(async () => {
		const state = await getMenuState(page);
		expect(state).not.toBeNull();
	}).toPass({ timeout, intervals: [pollInterval] });
}

/**
 * Wait for gold to reach a specific value.
 */
export async function waitForGold(
	page: Page,
	expectedGold: number,
	options: WaitOptions = {}
): Promise<void> {
	const { timeout = DEFAULT_TIMEOUT, pollInterval = DEFAULT_POLL_INTERVAL } = options;

	await expect(async () => {
		const state = await getGameState(page);
		expect(state?.gold).toBe(expectedGold);
	}).toPass({ timeout, intervals: [pollInterval] });
}

/**
 * Wait for lives to reach a specific value.
 */
export async function waitForLives(
	page: Page,
	expectedLives: number,
	options: WaitOptions = {}
): Promise<void> {
	const { timeout = DEFAULT_TIMEOUT, pollInterval = DEFAULT_POLL_INTERVAL } = options;

	await expect(async () => {
		const state = await getGameState(page);
		expect(state?.lives).toBe(expectedLives);
	}).toPass({ timeout, intervals: [pollInterval] });
}

/**
 * Wait for wave number to change.
 */
export async function waitForWave(
	page: Page,
	expectedWave: number,
	options: WaitOptions = {}
): Promise<void> {
	const { timeout = DEFAULT_TIMEOUT, pollInterval = DEFAULT_POLL_INTERVAL } = options;

	await expect(async () => {
		const state = await getGameState(page);
		expect(state?.wave).toBe(expectedWave);
	}).toPass({ timeout, intervals: [pollInterval] });
}

// ─── VIM Key Sequence Simulation ─────────────────────────────────

export interface KeyOptions {
	delay?: number;
}

const DEFAULT_KEY_DELAY = 50;

/**
 * Type a single VIM key, handling special keys appropriately.
 */
export async function pressKey(page: Page, key: string, options: KeyOptions = {}): Promise<void> {
	const { delay = DEFAULT_KEY_DELAY } = options;

	// Map special key names to Playwright key strings
	const keyMap: Record<string, string> = {
		Escape: 'Escape',
		Esc: 'Escape',
		Enter: 'Enter',
		Tab: 'Tab',
		Space: ' ',
		Backspace: 'Backspace'
	};

	const mappedKey = keyMap[key] ?? key;
	await page.keyboard.press(mappedKey);

	if (delay > 0) {
		await page.waitForTimeout(delay);
	}
}

/**
 * Type a sequence of VIM keys.
 * Handles multi-character sequences like "gg", "5j", ":w", etc.
 *
 * @example
 * await typeVimSequence(page, 'gg'); // Go to top
 * await typeVimSequence(page, '5j'); // Move down 5 lines
 * await typeVimSequence(page, ':wq'); // Save and quit
 */
export async function typeVimSequence(
	page: Page,
	sequence: string,
	options: KeyOptions = {}
): Promise<void> {
	const { delay = DEFAULT_KEY_DELAY } = options;

	for (const char of sequence) {
		await pressKey(page, char, { delay });
	}
}

/**
 * Enter insert mode using the specified variant.
 *
 * @param variant - 'i' (insert), 'a' (append), 'o' (open below), 'O' (open above)
 */
export async function enterInsertMode(
	page: Page,
	variant: 'i' | 'a' | 'o' | 'O' = 'i'
): Promise<void> {
	await pressKey(page, variant);
	await waitForMode(page, 'insert', { timeout: 2000 });
}

/**
 * Exit insert mode and return to normal mode.
 */
export async function exitInsertMode(page: Page): Promise<void> {
	await pressKey(page, 'Escape');
	await waitForMode(page, 'normal', { timeout: 2000 });
}

/**
 * Enter command mode by pressing ':'.
 */
export async function enterCommandMode(page: Page): Promise<void> {
	await pressKey(page, ':');
	await waitForMode(page, 'command', { timeout: 2000 });
}

/**
 * Execute a VIM command (e.g., ":w", ":q", ":help").
 * Automatically enters command mode and presses Enter.
 *
 * @example
 * await executeCommand(page, 'w'); // Start wave
 * await executeCommand(page, 'q'); // Quit
 * await executeCommand(page, 'help'); // Show help
 */
export async function executeCommand(
	page: Page,
	command: string,
	options: KeyOptions = {}
): Promise<void> {
	await enterCommandMode(page);
	await typeVimSequence(page, command, options);
	await pressKey(page, 'Enter');
}

/**
 * Move cursor using VIM movement keys.
 */
export async function moveCursor(
	page: Page,
	direction: 'h' | 'j' | 'k' | 'l',
	count: number = 1
): Promise<void> {
	if (count > 1) {
		await typeVimSequence(page, `${count}${direction}`);
	} else {
		await pressKey(page, direction);
	}
}

/**
 * Place a tower by number (1-4) while in insert mode.
 */
export async function placeTower(page: Page, towerNumber: 1 | 2 | 3 | 4): Promise<void> {
	const mode = await getMode(page);
	if (mode !== 'insert') {
		await enterInsertMode(page);
	}
	await pressKey(page, towerNumber.toString());
}

/**
 * Quick sell tower at current position using 'x' in normal mode.
 */
export async function quickSellTower(page: Page): Promise<void> {
	const mode = await getMode(page);
	if (mode !== 'normal') {
		await exitInsertMode(page);
	}
	await pressKey(page, 'x');
}

// ─── Navigation Helpers ──────────────────────────────────────────

/**
 * Navigate to a specific stage from the menu.
 */
export async function navigateToStage(page: Page, stageNumber: number): Promise<void> {
	await page.goto('/');
	await waitForMenuReady(page);

	// Move to the target stage (assuming starting at index 0)
	const currentState = await getMenuState(page);
	const currentIndex = currentState?.selectedIndex ?? 0;
	const targetIndex = stageNumber - 1;

	if (targetIndex > currentIndex) {
		for (let i = 0; i < targetIndex - currentIndex; i++) {
			await pressKey(page, 'j');
		}
	} else if (targetIndex < currentIndex) {
		for (let i = 0; i < currentIndex - targetIndex; i++) {
			await pressKey(page, 'k');
		}
	}

	await pressKey(page, 'Enter');
}

/**
 * Start a stage directly via URL.
 */
export async function startStage(page: Page, stageNumber: number): Promise<void> {
	await page.goto(`/play?stage=${stageNumber}`);
	await waitForGameReady(page);
}

/**
 * Return to menu from game using Escape.
 */
export async function returnToMenu(page: Page): Promise<void> {
	const state = await getGameState(page);

	// If in game over or stage complete, Enter/Escape returns to menu
	if (state?.phase === 'game_over' || state?.phase === 'stage_complete') {
		await pressKey(page, 'Escape');
	} else {
		// Otherwise use :q command
		await executeCommand(page, 'q');
	}

	// Wait for menu to load
	await waitForMenuReady(page);
}

// ─── Canvas Accessibility Helpers ────────────────────────────────

/**
 * Get the game canvas element.
 */
export function getCanvas(page: Page): Locator {
	return page.locator('[data-testid="game-container"] canvas');
}

/**
 * Get the menu canvas element.
 */
export function getMenuCanvas(page: Page): Locator {
	return page.locator('[data-testid="menu-container"] canvas');
}

/**
 * Verify canvas is rendered and has dimensions.
 */
export async function verifyCanvasRendered(page: Page): Promise<void> {
	const canvas = getCanvas(page);
	await expect(canvas).toBeVisible();

	const width = await canvas.getAttribute('width');
	const height = await canvas.getAttribute('height');

	expect(parseInt(width ?? '0', 10)).toBeGreaterThan(0);
	expect(parseInt(height ?? '0', 10)).toBeGreaterThan(0);
}

/**
 * Check for accessibility marker indicating game state.
 * Note: This relies on aria-label or similar attributes on the canvas.
 */
export async function getCanvasAccessibilityLabel(page: Page): Promise<string | null> {
	const canvas = getCanvas(page);
	return canvas.getAttribute('aria-label');
}

// ─── LocalStorage Helpers ────────────────────────────────────────

export interface ProgressData {
	unlockedStages: number;
	scores: Record<
		number,
		{
			bestKeystrokes: number;
			rating: string;
		}
	>;
}

/**
 * Get progression data from localStorage.
 */
export async function getProgressData(page: Page): Promise<ProgressData | null> {
	return page.evaluate(() => {
		const data = localStorage.getItem('vim-tower-progress');
		return data ? JSON.parse(data) : null;
	});
}

/**
 * Clear progression data from localStorage.
 */
export async function clearProgressData(page: Page): Promise<void> {
	await page.evaluate(() => {
		localStorage.removeItem('vim-tower-progress');
	});
}

/**
 * Set custom progression data for testing.
 */
export async function setProgressData(page: Page, data: ProgressData): Promise<void> {
	await page.evaluate((progressData) => {
		localStorage.setItem('vim-tower-progress', JSON.stringify(progressData));
	}, data);
}

// ─── Assertion Helpers ───────────────────────────────────────────

/**
 * Assert that the game is in a specific phase.
 */
export async function expectPhase(page: Page, expectedPhase: GamePhase): Promise<void> {
	const phase = await getPhase(page);
	expect(phase).toBe(expectedPhase);
}

/**
 * Assert that the game is in a specific mode.
 */
export async function expectMode(page: Page, expectedMode: GameMode): Promise<void> {
	const mode = await getMode(page);
	expect(mode).toBe(expectedMode);
}

/**
 * Assert game state matches expected values.
 */
export async function expectGameState(
	page: Page,
	expected: Partial<GameState>
): Promise<void> {
	const state = await getGameState(page);
	expect(state).not.toBeNull();

	if (expected.phase !== undefined) {
		expect(state?.phase).toBe(expected.phase);
	}
	if (expected.mode !== undefined) {
		expect(state?.mode).toBe(expected.mode);
	}
	if (expected.gold !== undefined) {
		expect(state?.gold).toBe(expected.gold);
	}
	if (expected.lives !== undefined) {
		expect(state?.lives).toBe(expected.lives);
	}
	if (expected.wave !== undefined) {
		expect(state?.wave).toBe(expected.wave);
	}
}

// ─── Test Utilities ──────────────────────────────────────────────

/**
 * Take a screenshot for debugging.
 */
export async function debugScreenshot(page: Page, name: string): Promise<void> {
	await page.screenshot({ path: `test-results/debug-${name}.png` });
}

/**
 * Wait for any animations to settle.
 */
export async function waitForAnimations(page: Page, ms: number = 500): Promise<void> {
	await page.waitForTimeout(ms);
}

/**
 * Check for console errors during test.
 */
export function setupConsoleErrorCapture(page: Page): { errors: string[] } {
	const errors: string[] = [];

	page.on('console', (msg) => {
		if (msg.type() === 'error') {
			errors.push(msg.text());
		}
	});

	return { errors };
}
