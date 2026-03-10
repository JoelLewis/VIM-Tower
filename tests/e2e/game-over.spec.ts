/**
 * E2E Tests: Game Over Conditions
 *
 * Tests loss conditions including:
 * - Lives reaching 0 triggers game over
 * - Game over screen display
 * - Score tracking without progression unlock
 * - Return to menu with Enter/Escape
 *
 * ## TIMING CONSIDERATIONS
 *
 * These tests involve waiting for enemies to traverse the entire path and deplete
 * all player lives. This is inherently slow because:
 * 1. Enemies spawn over time (wave spawn intervals)
 * 2. Each enemy must walk the full path to the exit
 * 3. Multiple enemies must reach the exit to drain all 10 lives
 *
 * ### Timeout Strategy:
 * - test.setTimeout(90000-120000): Extended test timeout for full game-over scenarios
 * - waitForPhase('combat', { timeout: 5000 }): Quick transition, should complete fast
 * - waitForPhase('game_over', { timeout: 90000 }): Main waiting period for enemies to
 *   traverse path and deplete lives. 90s is conservative for Stage 1 (shortest path).
 *
 * ### Potential Flakiness:
 * - Enemy movement speed variations (frame-dependent)
 * - Browser performance differences (especially in CI)
 * - Network latency on asset loading
 *
 * ### Recommended Optimizations (Future Task):
 * - Implement test mode with accelerated game speed (10x multiplier)
 * - Use URL param ?testMode=true to enable fast-forward
 * - Would reduce 90-120s tests to <10s
 */

import { test, expect } from '@playwright/test';
import {
	waitForPhase,
	waitForLives,
	getGameState,
	pressKey,
	executeCommand,
	startStage,
	clearProgressData,
	getProgressData,
	setProgressData,
	waitForMenuReady
} from '../helpers/game-helpers.js';

test.describe('Game Over - Loss Conditions', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearProgressData(page);
		// Start with all stages unlocked for testing flexibility
		await setProgressData(page, { unlockedStages: 4, scores: {} });
	});

	test.describe('Lives Reaching 0', () => {
		test('should trigger game over when all lives are lost', async ({ page }) => {
			// TIMING: 120s test timeout allows for:
			// - Wave spawn (3 enemies over ~15s)
			// - Enemy traversal (Stage 1 path ~20s per enemy at normal speed)
			// - Multiple waves if needed to drain 10 lives
			// The 90s waitForPhase timeout is the critical wait; outer timeout provides buffer.
			test.setTimeout(120000);
			await startStage(page, 1);

			// Verify initial lives
			let state = await getGameState(page);
			expect(state?.lives).toBeGreaterThan(0);

			// Start wave without placing any towers - enemies will reach exit
			await executeCommand(page, 'w');
			// TIMING: Combat phase transition is immediate (game loop responds to :w command)
			await waitForPhase(page, 'combat', { timeout: 5000 });

			// TIMING: This is the long wait - enemies must traverse the full path.
			// Stage 1 has a straight horizontal path, enemies move at ~1 cell/second.
			// With 10 cells and 3 enemies per wave, first wave completes in ~30-40s.
			// Multiple waves may spawn to drain all 10 lives, hence 90s timeout.
			await waitForPhase(page, 'game_over', { timeout: 90000 });

			// Verify game over state
			state = await getGameState(page);
			expect(state?.phase).toBe('game_over');
			expect(state?.lives).toBe(0);
		});

		test('should decrement lives as enemies reach exit', async ({ page }) => {
			// TIMING: Shorter than full game-over test since we only wait for 1 life lost
			test.setTimeout(90000);
			await startStage(page, 1);

			const initialState = await getGameState(page);
			const initialLives = initialState?.lives ?? 3;

			// Start wave without defenses
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });

			// TIMING: Wait for first enemy to traverse the path and reach exit.
			// Stage 1 path is ~10 cells, enemy speed ~1 cell/sec = ~10-15s for first hit.
			// Using 45s timeout for safety margin (browser perf variance, CI overhead).
			await waitForLives(page, initialLives - 1, { timeout: 45000 });

			// Verify life was lost
			const midState = await getGameState(page);
			expect(midState?.lives).toBeLessThan(initialLives);
		});

		test('should show game over message when lives reach 0', async ({ page }) => {
			// TIMING: Same as 'trigger game over' test - full enemy traversal wait
			test.setTimeout(120000);
			await startStage(page, 1);

			// Start wave without towers
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });

			// TIMING: Full game-over wait (see detailed timing notes in first test)
			await waitForPhase(page, 'game_over', { timeout: 90000 });

			// Game over screen should be displayed
			const state = await getGameState(page);
			expect(state?.phase).toBe('game_over');
		});
	});

	test.describe('Game Over Screen Display', () => {
		test('should display game over phase in data attributes', async ({ page }) => {
			// TIMING: Standard game-over scenario timing
			test.setTimeout(120000);
			await startStage(page, 1);

			// Trigger game over by letting enemies through
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			// TIMING: Full enemy traversal to deplete all lives
			await waitForPhase(page, 'game_over', { timeout: 90000 });

			// Verify game container shows game_over phase
			const container = page.locator('[data-testid="game-container"]');
			await expect(container).toHaveAttribute('data-phase', 'game_over');
		});

		test('should track keystrokes during failed attempt', async ({ page }) => {
			// TIMING: Standard game-over scenario with keystroke tracking
			test.setTimeout(120000);
			await startStage(page, 1);

			// Make some moves before starting wave
			await pressKey(page, 'j'); // Move down
			await pressKey(page, 'l'); // Move right

			const beforeWave = await getGameState(page);
			expect(beforeWave?.keystrokeCount).toBeGreaterThan(0);

			// Start wave and lose
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			// TIMING: Full enemy traversal
			await waitForPhase(page, 'game_over', { timeout: 90000 });

			// Keystrokes should still be tracked
			const afterGame = await getGameState(page);
			expect(afterGame?.keystrokeCount).toBeGreaterThan(0);
		});

		test('should show current wave at time of game over', async ({ page }) => {
			// TIMING: Standard game-over scenario
			test.setTimeout(120000);
			await startStage(page, 1);

			// Start first wave
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });

			// TIMING: Full enemy traversal to game over
			await waitForPhase(page, 'game_over', { timeout: 90000 });

			// Should show wave 1 (failed on first wave)
			const state = await getGameState(page);
			expect(state?.wave).toBe(1);
		});
	});

	test.describe('Score Tracking Without Progression Unlock', () => {
		test('should NOT unlock next stage on game over', async ({ page }) => {
			// TIMING: Standard game-over scenario with progression verification
			test.setTimeout(120000);

			// Start with only stage 1 unlocked
			await clearProgressData(page);
			await setProgressData(page, { unlockedStages: 1, scores: {} });

			await startStage(page, 1);

			// Lose the game
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			// TIMING: Full enemy traversal
			await waitForPhase(page, 'game_over', { timeout: 90000 });

			// Return to menu
			await pressKey(page, 'Enter');
			await waitForMenuReady(page);

			// Verify stage 2 is NOT unlocked
			const progress = await getProgressData(page);
			expect(progress?.unlockedStages).toBe(1);
		});

		test('should NOT save score on game over', async ({ page }) => {
			// TIMING: Standard game-over scenario
			test.setTimeout(120000);

			await clearProgressData(page);
			await setProgressData(page, { unlockedStages: 1, scores: {} });

			await startStage(page, 1);

			// Lose the game
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			// TIMING: Full enemy traversal
			await waitForPhase(page, 'game_over', { timeout: 90000 });

			// Return to menu
			await pressKey(page, 'Enter');
			await waitForMenuReady(page);

			// Verify no score was saved for stage 1
			const progress = await getProgressData(page);
			expect(progress?.scores[1]).toBeUndefined();
		});

		test('should preserve existing progression data after game over', async ({ page }) => {
			// TIMING: Testing on Stage 2 which has a longer L-shaped path
			// but same timeout applies since enemies still need to drain all lives
			test.setTimeout(120000);

			// Set up with existing progress
			await clearProgressData(page);
			await setProgressData(page, {
				unlockedStages: 2,
				scores: {
					1: { bestKeystrokes: 30, rating: 'A' }
				}
			});

			// Play stage 2 and lose
			await startStage(page, 2);
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			// TIMING: Stage 2 has a longer path than Stage 1, but 90s still sufficient
			await waitForPhase(page, 'game_over', { timeout: 90000 });

			// Return to menu
			await pressKey(page, 'Enter');
			await waitForMenuReady(page);

			// Verify existing progress is preserved
			const progress = await getProgressData(page);
			expect(progress?.unlockedStages).toBe(2);
			expect(progress?.scores[1]).toBeDefined();
			expect(progress?.scores[1].bestKeystrokes).toBe(30);
			expect(progress?.scores[1].rating).toBe('A');
			// Stage 2 should NOT have a score (we lost)
			expect(progress?.scores[2]).toBeUndefined();
		});
	});

	test.describe('Return to Menu', () => {
		test('should return to menu with Enter key after game over', async ({ page }) => {
			// TIMING: Game-over scenario + menu navigation (fast)
			test.setTimeout(120000);
			await startStage(page, 1);

			// Lose the game
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			// TIMING: Primary wait - enemy traversal to game over
			await waitForPhase(page, 'game_over', { timeout: 90000 });

			// Press Enter to return to menu
			await pressKey(page, 'Enter');

			// Should navigate to menu
			await page.waitForURL('/');
			await waitForMenuReady(page);

			// Verify we're on the menu
			const menuContainer = page.locator('[data-testid="menu-container"]');
			await expect(menuContainer).toBeVisible();
		});

		test('should return to menu with Escape key after game over', async ({ page }) => {
			// TIMING: Standard game-over scenario
			test.setTimeout(120000);
			await startStage(page, 1);

			// Lose the game
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			// TIMING: Primary wait
			await waitForPhase(page, 'game_over', { timeout: 90000 });

			// Press Escape to return to menu
			await pressKey(page, 'Escape');

			// Should navigate to menu
			await page.waitForURL('/');
			await waitForMenuReady(page);

			// Verify we're on the menu
			const menuContainer = page.locator('[data-testid="menu-container"]');
			await expect(menuContainer).toBeVisible();
		});

		test('should ignore other keys during game over', async ({ page }) => {
			// TIMING: Standard game-over scenario
			test.setTimeout(120000);
			await startStage(page, 1);

			// Lose the game
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			// TIMING: Primary wait
			await waitForPhase(page, 'game_over', { timeout: 90000 });

			// Try pressing various keys that should NOT exit
			await pressKey(page, 'j');
			await pressKey(page, 'k');
			await pressKey(page, 'h');
			await pressKey(page, 'l');
			await pressKey(page, 'i');
			await pressKey(page, ':');

			// Should still be on game over screen
			const state = await getGameState(page);
			expect(state?.phase).toBe('game_over');

			// Now press Enter to exit
			await pressKey(page, 'Enter');
			await page.waitForURL('/');
		});
	});

	test.describe('Game Over from :q! Command', () => {
		// NOTE: These tests are FAST - :q! triggers instant game_over without enemy traversal
		// No extended timeouts needed for command-triggered game over
		test('should trigger game over with :q! force quit command', async ({ page }) => {
			await startStage(page, 1);

			// Use :q! to force quit (which sets phase to game_over)
			// TIMING: This is instant - no waiting for enemies
			await executeCommand(page, 'q!');

			// Should be in game over state
			const state = await getGameState(page);
			expect(state?.phase).toBe('game_over');
		});

		test('should return to menu after :q! with Enter', async ({ page }) => {
			await startStage(page, 1);

			// Force quit
			await executeCommand(page, 'q!');
			await waitForPhase(page, 'game_over', { timeout: 5000 });

			// Press Enter to return to menu
			await pressKey(page, 'Enter');
			await page.waitForURL('/');
			await waitForMenuReady(page);
		});

		test(':q without ! should NOT trigger game over', async ({ page }) => {
			await startStage(page, 1);

			// Try :q without exclamation
			await executeCommand(page, 'q');

			// Should still be in planning phase (game not quit)
			const state = await getGameState(page);
			expect(state?.phase).toBe('planning');
		});
	});

	test.describe('Game Over on Later Stages', () => {
		test('should trigger game over on Stage 2 when lives reach 0', async ({ page }) => {
			// TIMING: Stage 2 has L-shaped path (longer than Stage 1)
			// Same timeout strategy - enemies still need to traverse and drain lives
			test.setTimeout(120000);

			await setProgressData(page, { unlockedStages: 2, scores: {} });
			await startStage(page, 2);

			// Start wave without adequate defenses
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			// TIMING: Stage 2 path is longer but 90s covers worst case
			await waitForPhase(page, 'game_over', { timeout: 90000 });

			const state = await getGameState(page);
			expect(state?.phase).toBe('game_over');
			expect(state?.lives).toBe(0);
		});

		test('should NOT unlock Stage 3 when failing Stage 2', async ({ page }) => {
			// TIMING: Standard game-over on Stage 2
			test.setTimeout(120000);

			await clearProgressData(page);
			await setProgressData(page, { unlockedStages: 2, scores: {} });
			await startStage(page, 2);

			// Lose the game
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			// TIMING: Full enemy traversal on Stage 2's longer path
			await waitForPhase(page, 'game_over', { timeout: 90000 });

			// Return to menu
			await pressKey(page, 'Enter');
			await waitForMenuReady(page);

			// Stage 3 should still be locked
			const progress = await getProgressData(page);
			expect(progress?.unlockedStages).toBe(2);
		});
	});
});
