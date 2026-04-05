/**
 * E2E Tests: Game Over Conditions
 *
 * Tests loss conditions including:
 * - Lives reaching 0 triggers game over
 * - Game over screen display
 * - Score tracking without progression unlock
 * - Return to menu with Enter/Escape
 *
 * ## TEST MODE (10x Speed)
 *
 * These tests use `testMode=true` URL parameter which enables 10x game speed.
 * This dramatically reduces test duration:
 * - Normal mode: 90-120s per test (enemy traversal at normal speed)
 * - Test mode: <10s per test (10x faster enemy movement and combat)
 *
 * ## TIMING CONSIDERATIONS
 *
 * With test mode enabled, timeouts are reduced by approximately 10x:
 * - test.setTimeout(15000): Extended test timeout for full game-over scenarios
 * - waitForPhase('combat', { timeout: 5000 }): Quick transition, should complete fast
 * - waitForPhase('game_over', { timeout: 10000 }): Main waiting period for enemies
 *
 * ### Potential Flakiness:
 * - Enemy movement speed variations (frame-dependent)
 * - Browser performance differences (especially in CI)
 * - Network latency on asset loading
 */

import { test, expect } from '@playwright/test';
import {
	waitForPhase,
	getGameState,
	pressKey,
	executeCommand,
	startStage,
	clearProgressData,
	getProgressData,
	setProgressData,
	waitForMenuReady,
	runUntilGameOver
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
			// TIMING: With testMode (10x speed), tests complete in ~10s instead of 90-120s
			test.setTimeout(20000);
			await startStage(page, 1, { testMode: true });

			// Verify initial lives
			let state = await getGameState(page);
			expect(state?.lives).toBeGreaterThan(0);

			// Run waves until game over (no towers = enemies reach exit)
			await runUntilGameOver(page, { timeout: 15000 });

			// Verify game over state
			state = await getGameState(page);
			expect(state?.phase).toBe('game_over');
			expect(state?.lives).toBe(0);
		});

		test('should decrement lives as enemies reach exit', async ({ page }) => {
			// TIMING: With testMode, first life lost quickly (~1-2s)
			test.setTimeout(15000);
			await startStage(page, 1, { testMode: true });

			const initialState = await getGameState(page);
			const initialLives = initialState?.lives ?? 10;

			// Start wave without defenses
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });

			// TIMING: Wait for lives to decrease (any amount)
			// With 10x speed, enemies reach exit faster
			await expect(async () => {
				const state = await getGameState(page);
				expect(state?.lives).toBeLessThan(initialLives);
			}).toPass({ timeout: 10000, intervals: [100] });

			// Verify life was lost
			const midState = await getGameState(page);
			expect(midState?.lives).toBeLessThan(initialLives);
		});

		test('should show game over message when lives reach 0', async ({ page }) => {
			// TIMING: With testMode (10x speed), full game-over in ~10s
			test.setTimeout(20000);
			await startStage(page, 1, { testMode: true });

			// Run waves until game over
			await runUntilGameOver(page, { timeout: 15000 });

			// Game over screen should be displayed
			const state = await getGameState(page);
			expect(state?.phase).toBe('game_over');
		});
	});

	test.describe('Game Over Screen Display', () => {
		test('should display game over phase in data attributes', async ({ page }) => {
			// TIMING: With testMode (10x speed), ~10s instead of 90-120s
			test.setTimeout(20000);
			await startStage(page, 1, { testMode: true });

			// Run waves until game over
			await runUntilGameOver(page, { timeout: 15000 });

			// Verify game container shows game_over phase
			const container = page.locator('[data-testid="game-container"]');
			await expect(container).toHaveAttribute('data-phase', 'game_over');
		});

		test('should track keystrokes during failed attempt', async ({ page }) => {
			// TIMING: With testMode (10x speed), ~10s instead of 90-120s
			test.setTimeout(20000);
			await startStage(page, 1, { testMode: true });

			// Make some moves before starting wave
			await pressKey(page, 'j'); // Move down
			await pressKey(page, 'l'); // Move right

			const beforeWave = await getGameState(page);
			expect(beforeWave?.keystrokeCount).toBeGreaterThan(0);

			// Run waves until game over
			await runUntilGameOver(page, { timeout: 15000 });

			// Keystrokes should still be tracked
			const afterGame = await getGameState(page);
			expect(afterGame?.keystrokeCount).toBeGreaterThan(0);
		});

		test('should show current wave at time of game over', async ({ page }) => {
			// TIMING: With testMode (10x speed), ~10s instead of 90-120s
			test.setTimeout(20000);
			await startStage(page, 1, { testMode: true });

			// Run waves until game over
			await runUntilGameOver(page, { timeout: 15000 });

			// Should show wave number at game over (depends on how many enemies needed)
			const state = await getGameState(page);
			expect(state?.wave).toBeGreaterThanOrEqual(1);
		});
	});

	test.describe('Score Tracking Without Progression Unlock', () => {
		test('should NOT unlock next stage on game over', async ({ page }) => {
			// TIMING: With testMode (10x speed), ~10s instead of 90-120s
			test.setTimeout(20000);

			// Start with only stage 1 unlocked
			await clearProgressData(page);
			await setProgressData(page, { unlockedStages: 1, scores: {} });

			await startStage(page, 1, { testMode: true });

			// Run waves until game over
			await runUntilGameOver(page, { timeout: 15000 });

			// Return to menu
			await pressKey(page, 'Enter');
			await waitForMenuReady(page);

			// Verify stage 2 is NOT unlocked
			const progress = await getProgressData(page);
			expect(progress?.unlockedStages).toBe(1);
		});

		test('should NOT save score on game over', async ({ page }) => {
			// TIMING: With testMode (10x speed), ~10s instead of 90-120s
			test.setTimeout(20000);

			await clearProgressData(page);
			await setProgressData(page, { unlockedStages: 1, scores: {} });

			await startStage(page, 1, { testMode: true });

			// Run waves until game over
			await runUntilGameOver(page, { timeout: 15000 });

			// Return to menu
			await pressKey(page, 'Enter');
			await waitForMenuReady(page);

			// Verify no score was saved for stage 1
			const progress = await getProgressData(page);
			expect(progress?.scores[1]).toBeUndefined();
		});

		test('should preserve existing progression data after game over', async ({ page }) => {
			// TIMING: With testMode (10x speed), ~10s instead of 90-120s
			test.setTimeout(20000);

			// Set up with existing progress
			await clearProgressData(page);
			await setProgressData(page, {
				unlockedStages: 2,
				scores: {
					1: { bestKeystrokes: 30, rating: 'A' }
				}
			});

			// Play stage 2 and lose
			await startStage(page, 2, { testMode: true });

			// Run waves until game over
			await runUntilGameOver(page, { timeout: 15000 });

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
			// TIMING: With testMode (10x speed), ~10s instead of 90-120s
			test.setTimeout(20000);
			await startStage(page, 1, { testMode: true });

			// Run waves until game over
			await runUntilGameOver(page, { timeout: 15000 });

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
			// TIMING: With testMode (10x speed), ~10s instead of 90-120s
			test.setTimeout(20000);
			await startStage(page, 1, { testMode: true });

			// Run waves until game over
			await runUntilGameOver(page, { timeout: 15000 });

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
			// TIMING: With testMode (10x speed), ~10s instead of 90-120s
			test.setTimeout(20000);
			await startStage(page, 1, { testMode: true });

			// Run waves until game over
			await runUntilGameOver(page, { timeout: 15000 });

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
			// TIMING: With testMode (10x speed), ~10s instead of 90-120s
			test.setTimeout(20000);

			await setProgressData(page, { unlockedStages: 2, scores: {} });
			await startStage(page, 2, { testMode: true });

			// Run waves until game over
			await runUntilGameOver(page, { timeout: 15000 });

			const state = await getGameState(page);
			expect(state?.phase).toBe('game_over');
			expect(state?.lives).toBe(0);
		});

		test('should NOT unlock Stage 3 when failing Stage 2', async ({ page }) => {
			// TIMING: With testMode (10x speed), ~10s instead of 90-120s
			test.setTimeout(20000);

			await clearProgressData(page);
			await setProgressData(page, { unlockedStages: 2, scores: {} });
			await startStage(page, 2, { testMode: true });

			// Run waves until game over
			await runUntilGameOver(page, { timeout: 15000 });

			// Return to menu
			await pressKey(page, 'Enter');
			await waitForMenuReady(page);

			// Stage 3 should still be locked
			const progress = await getProgressData(page);
			expect(progress?.unlockedStages).toBe(2);
		});
	});
});
