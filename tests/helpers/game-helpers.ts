/**
 * E2E Test Helpers for VIM Tower Defense
 *
 * Utilities for waiting on game state transitions, extracting state from DOM,
 * simulating VIM key sequences, and verifying canvas rendering.
 *
 * ## TIMING CONFIGURATION
 *
 * This file defines the timing constants and wait utilities used across all E2E tests.
 * Understanding these values is critical for debugging flaky tests.
 *
 * ### Default Timeouts:
 * - DEFAULT_TIMEOUT = 10000ms (10s) - Base timeout for most wait operations
 * - DEFAULT_POLL_INTERVAL = 100ms - How often to check for state changes
 * - DEFAULT_KEY_DELAY = 50ms - Delay between key presses to avoid race conditions
 *
 * ### Wait Function Behavior:
 * All wait functions use Playwright's expect().toPass() pattern which:
 * 1. Runs the assertion immediately
 * 2. If it fails, waits pollInterval (100ms) and retries
 * 3. Continues until assertion passes or timeout is reached
 *
 * ### Recommended Timeouts by Use Case:
 * - waitForPhase('combat'): 5000ms - immediate transition after :w command
 * - waitForPhase('wave_complete'): 30000-45000ms - single wave combat
 * - waitForPhase('game_over'): 90000ms - multiple waves, enemy traversal
 * - waitForPhase('stage_complete'): 30000-120000ms - depends on stage difficulty
 * - waitForMode(): 2000ms - mode transitions are synchronous with input
 * - waitForMenuReady/waitForGameReady: 10000ms (default) - app initialization
 *
 * ### Flakiness Patterns:
 * - Too short timeout: Test fails inconsistently, especially in CI
 * - Too short key delay: Keys may be processed out of order
 * - Missing wait: Test reads stale state before update completes
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

/**
 * Default timeout for wait operations (10 seconds).
 * Sufficient for most state transitions (menu load, game init, mode changes).
 *
 * For combat-related waits, tests should override with longer timeouts:
 * - Wave completion: 30000-45000ms
 * - Game over: 90000ms
 * - Stage 4 final wave: 120000ms
 */
const DEFAULT_TIMEOUT = 10000;

/**
 * How often to check for state changes (100ms).
 * This value balances responsiveness vs CPU usage.
 * Lower values make tests faster when state changes quickly,
 * but increase CPU overhead from frequent polling.
 */
const DEFAULT_POLL_INTERVAL = 100;

/**
 * Wait for game phase to transition to the expected phase.
 *
 * TIMING GUIDELINES:
 * - 'combat': 5000ms - instant transition after :w command
 * - 'wave_complete': 30000-60000ms - depends on tower effectiveness and enemy count
 * - 'stage_complete': 30000-120000ms - final wave, depends on stage difficulty
 * - 'game_over': 90000ms - requires enemies to traverse path and deplete lives
 * - 'planning': 5000ms - auto-transition after wave_complete
 *
 * FLAKINESS NOTE: If this times out, check:
 * 1. Are enough towers placed to defeat enemies?
 * 2. Is the timeout appropriate for the stage/wave?
 * 3. Is CI running slower than local dev machine?
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
 *
 * TIMING: Mode transitions are synchronous with key input.
 * A 2000ms timeout is more than sufficient for any mode change.
 * If this times out, the issue is likely the key not being received,
 * not a slow transition.
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
 *
 * TIMING: Lives decrease when enemies reach the exit.
 * Time depends on enemy spawn rate and path length:
 * - First life lost: 10-20s (first enemy traversal)
 * - All lives lost: 60-90s (multiple enemies/waves)
 *
 * Use 45000ms for waiting on first life lost.
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

/**
 * Default delay between key presses (50ms).
 *
 * This delay is CRITICAL for test reliability. It ensures:
 * 1. The game loop processes each key before the next arrives
 * 2. Mode transitions complete before subsequent keys
 * 3. Count prefixes (e.g., "5j") are parsed correctly
 *
 * Reducing this value may cause flakiness in:
 * - Count prefix commands (keys arrive before parser resets)
 * - Mode transitions (Escape processed before insert mode fully exits)
 * - Command mode input (:w parses incorrectly)
 */
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

export interface StartStageOptions {
	testMode?: boolean;
}

/**
 * Start a stage directly via URL.
 *
 * @param testMode - When true, enables 10x game speed for faster E2E tests.
 *   This reduces test timeouts from 90-120s to under 10s.
 */
export async function startStage(
	page: Page,
	stageNumber: number,
	options: StartStageOptions = {}
): Promise<void> {
	const { testMode = false } = options;
	const url = testMode ? `/play?stage=${stageNumber}&testMode=true` : `/play?stage=${stageNumber}`;
	await page.goto(url);
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

// ─── Game Over Helpers ───────────────────────────────────────

/**
 * Keep starting waves until game over is reached.
 * Useful for tests that need to deplete all lives.
 *
 * This function:
 * 1. Starts a wave when in planning phase
 * 2. Waits for combat to complete
 * 3. Repeats until game_over phase is reached
 *
 * TIMING: With testMode (10x speed), typically completes in ~5-10s.
 * Without testMode, can take 90+ seconds.
 */
export async function runUntilGameOver(
	page: Page,
	options: { timeout?: number } = {}
): Promise<void> {
	const { timeout = 30000 } = options;
	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		const state = await getGameState(page);
		if (state?.phase === 'game_over') return;

		// Start next wave if in planning phase
		if (state?.phase === 'planning') {
			await executeCommand(page, 'w');
		}

		// Brief wait for phase transitions
		await page.waitForTimeout(100);
	}

	// Final check
	const finalState = await getGameState(page);
	if (finalState?.phase !== 'game_over') {
		throw new Error(
			`Timeout waiting for game_over. Current phase: ${finalState?.phase}, lives: ${finalState?.lives}`
		);
	}
}

/**
 * Wait for a wave to complete and transition to the next state.
 * Handles fast transitions in testMode where wave_complete may be missed.
 *
 * For non-final waves: waits for planning phase with incremented wave number
 * For final wave: waits for stage_complete phase
 *
 * @param currentWave - The wave that was just started
 * @param totalWaves - Total waves in the stage
 */
export async function waitForWaveComplete(
	page: Page,
	currentWave: number,
	totalWaves: number,
	options: WaitOptions = {}
): Promise<void> {
	const { timeout = 10000, pollInterval = DEFAULT_POLL_INTERVAL } = options;

	if (currentWave >= totalWaves) {
		// Final wave - wait for stage_complete
		await waitForPhase(page, 'stage_complete', { timeout, pollInterval });
	} else {
		// Non-final wave - wait for planning phase with next wave number
		await expect(async () => {
			const state = await getGameState(page);
			// Accept wave_complete or planning (may transition too fast to catch wave_complete)
			const validPhase = state?.phase === 'planning' || state?.phase === 'wave_complete';
			expect(validPhase).toBe(true);
			// If in planning, verify we advanced to next wave
			if (state?.phase === 'planning') {
				expect(state?.wave).toBe(currentWave + 1);
			}
		}).toPass({ timeout, intervals: [pollInterval] });
	}
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
