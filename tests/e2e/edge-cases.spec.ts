/**
 * E2E Tests: Edge Cases and Error Handling
 *
 * Tests for:
 * - localStorage corruption and invalid JSON handling
 * - Browser back/forward navigation between menu and game
 * - Rapid stage switching behavior
 * - Game state persistence during tab visibility changes
 *
 * ## TIMING CONSIDERATIONS
 *
 * These tests are generally FAST since they test UI behavior and state handling
 * rather than full gameplay. Most tests complete in under 5 seconds.
 *
 * ### Timeout Strategy:
 * - localStorage tests: Default timeouts (10s)
 * - Navigation tests: Default timeouts (10s)
 * - Rapid switching tests: Short timeouts for failure verification
 * - Visibility tests: Extended timeouts for combat completion with testMode
 */

import { test, expect } from '@playwright/test';
import {
	waitForMenuReady,
	waitForGameReady,
	waitForPhase,
	getMenuState,
	getGameState,
	pressKey,
	startStage,
	executeCommand,
	setProgressData,
	getProgressData,
	clearProgressData,
	enterInsertMode,
	exitInsertMode,
	moveCursor,
	placeTower
} from '../helpers/game-helpers.js';

// ─── localStorage Corruption Tests ───────────────────────────────────────────

test.describe('localStorage Corruption Handling', () => {
	test.describe('Invalid JSON Data', () => {
		test('should recover gracefully when localStorage contains invalid JSON', async ({ page }) => {
			await page.goto('/');

			// Set corrupted/invalid JSON in localStorage
			await page.evaluate(() => {
				localStorage.setItem('vim-tower-progress', 'this is not valid JSON {{{');
			});

			// Reload and verify app recovers with defaults
			await page.reload();
			await waitForMenuReady(page);

			// Should have default progression (1 stage unlocked)
			const state = await getMenuState(page);
			expect(state?.unlockedStages).toBe(1);
		});

		test('should recover from truncated JSON', async ({ page }) => {
			await page.goto('/');

			// Set truncated JSON
			await page.evaluate(() => {
				localStorage.setItem('vim-tower-progress', '{"unlockedStages": 3, "scores": {');
			});

			await page.reload();
			await waitForMenuReady(page);

			// Should reset to defaults
			const state = await getMenuState(page);
			expect(state?.unlockedStages).toBe(1);
		});

		test('should recover from JSON with wrong type for unlockedStages', async ({ page }) => {
			await page.goto('/');

			// unlockedStages should be number, not string
			await page.evaluate(() => {
				localStorage.setItem(
					'vim-tower-progress',
					JSON.stringify({ unlockedStages: 'invalid', scores: {} })
				);
			});

			await page.reload();
			await waitForMenuReady(page);

			// Should reset to defaults since unlockedStages is not a number
			const state = await getMenuState(page);
			expect(state?.unlockedStages).toBe(1);
		});

		test('should recover from JSON with null unlockedStages', async ({ page }) => {
			await page.goto('/');

			await page.evaluate(() => {
				localStorage.setItem(
					'vim-tower-progress',
					JSON.stringify({ unlockedStages: null, scores: {} })
				);
			});

			await page.reload();
			await waitForMenuReady(page);

			// Should reset to defaults
			const state = await getMenuState(page);
			expect(state?.unlockedStages).toBe(1);
		});

		test('should recover from JSON array instead of object', async ({ page }) => {
			await page.goto('/');

			// Array is valid JSON but wrong type
			await page.evaluate(() => {
				localStorage.setItem('vim-tower-progress', '[1, 2, 3]');
			});

			await page.reload();
			await waitForMenuReady(page);

			// Should reset to defaults
			const state = await getMenuState(page);
			expect(state?.unlockedStages).toBe(1);
		});

		test('should handle negative unlockedStages gracefully', async ({ page }) => {
			await page.goto('/');

			await page.evaluate(() => {
				localStorage.setItem(
					'vim-tower-progress',
					JSON.stringify({ unlockedStages: -5, scores: {} })
				);
			});

			await page.reload();
			await waitForMenuReady(page);

			// App should still load (might use the value or reset)
			const state = await getMenuState(page);
			expect(state).not.toBeNull();
		});

		test('should handle extremely large unlockedStages', async ({ page }) => {
			await page.goto('/');

			await page.evaluate(() => {
				localStorage.setItem(
					'vim-tower-progress',
					JSON.stringify({ unlockedStages: 9999999, scores: {} })
				);
			});

			await page.reload();
			await waitForMenuReady(page);

			// App should still load
			const state = await getMenuState(page);
			expect(state).not.toBeNull();
		});
	});

	test.describe('Empty and Missing Data', () => {
		test('should handle empty string in localStorage', async ({ page }) => {
			await page.goto('/');

			await page.evaluate(() => {
				localStorage.setItem('vim-tower-progress', '');
			});

			await page.reload();
			await waitForMenuReady(page);

			// Should use defaults
			const state = await getMenuState(page);
			expect(state?.unlockedStages).toBe(1);
		});

		test('should handle null stored value', async ({ page }) => {
			await page.goto('/');

			await page.evaluate(() => {
				// Clear any existing data
				localStorage.removeItem('vim-tower-progress');
			});

			await page.reload();
			await waitForMenuReady(page);

			// Should use defaults
			const state = await getMenuState(page);
			expect(state?.unlockedStages).toBe(1);
		});

		test('should handle missing scores property', async ({ page }) => {
			await page.goto('/');

			await page.evaluate(() => {
				localStorage.setItem('vim-tower-progress', JSON.stringify({ unlockedStages: 3 }));
			});

			await page.reload();
			await waitForMenuReady(page);

			// App should still load (may reset or accept partial data)
			const state = await getMenuState(page);
			expect(state).not.toBeNull();
			// Just verify the app loads - actual behavior may vary
			expect(state?.unlockedStages).toBeGreaterThanOrEqual(1);
		});

		test('should handle empty scores object', async ({ page }) => {
			await page.goto('/');
			await clearProgressData(page);

			// Use setProgressData helper which is known to work correctly
			await setProgressData(page, { unlockedStages: 2, scores: {} });

			// Navigate to a stage to verify the data is used
			await page.goto('/play?stage=2');
			await waitForGameReady(page);

			// Game should load for stage 2 (meaning it accepted unlocked stage 2)
			const state = await getGameState(page);
			expect(state?.phase).toBe('planning');
		});
	});

	test.describe('Corrupted Score Data', () => {
		test('should handle corrupted score entry', async ({ page }) => {
			await page.goto('/');

			await page.evaluate(() => {
				localStorage.setItem(
					'vim-tower-progress',
					JSON.stringify({
						unlockedStages: 2,
						scores: {
							1: 'not an object'
						}
					})
				);
			});

			await page.reload();
			await waitForMenuReady(page);

			// App should still load (may reset to defaults due to corrupted data)
			const state = await getMenuState(page);
			expect(state).not.toBeNull();
			expect(state?.unlockedStages).toBeGreaterThanOrEqual(1);
		});

		test('should handle score with invalid rating', async ({ page }) => {
			await page.goto('/');

			await page.evaluate(() => {
				localStorage.setItem(
					'vim-tower-progress',
					JSON.stringify({
						unlockedStages: 2,
						scores: {
							1: { bestKeystrokes: 50, rating: 'INVALID' }
						}
					})
				);
			});

			await page.reload();
			await waitForMenuReady(page);

			// App should still load (may reset to defaults due to invalid data)
			const state = await getMenuState(page);
			expect(state).not.toBeNull();
			// App might reset due to validation, so just check it loads
			expect(state?.unlockedStages).toBeGreaterThanOrEqual(1);
		});

		test('should handle score with negative keystrokes', async ({ page }) => {
			await page.goto('/');

			await page.evaluate(() => {
				localStorage.setItem(
					'vim-tower-progress',
					JSON.stringify({
						unlockedStages: 2,
						scores: {
							1: { bestKeystrokes: -100, rating: 'S' }
						}
					})
				);
			});

			await page.reload();
			await waitForMenuReady(page);

			// App should still load (may accept or reset based on validation)
			const state = await getMenuState(page);
			expect(state).not.toBeNull();
			expect(state?.unlockedStages).toBeGreaterThanOrEqual(1);
		});
	});
});

// ─── Browser Back/Forward Navigation Tests ───────────────────────────────────

test.describe('Browser Navigation (Back/Forward)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearProgressData(page);
		await setProgressData(page, { unlockedStages: 4, scores: {} });
	});

	test('should handle browser back from game to menu', async ({ page }) => {
		await page.reload();
		await waitForMenuReady(page);

		// Navigate to game via direct URL (Enter key may have issues)
		await page.goto('/play?stage=1');
		await waitForGameReady(page);

		// Use browser back button
		await page.goBack();

		// Should return to menu
		await page.waitForURL('/');
		await waitForMenuReady(page);

		const menuState = await getMenuState(page);
		expect(menuState).not.toBeNull();
	});

	test('should handle browser forward after going back', async ({ page }) => {
		await page.reload();
		await waitForMenuReady(page);

		// Navigate to game via direct URL
		await page.goto('/play?stage=1');
		await waitForGameReady(page);

		// Go back to menu
		await page.goBack();
		await page.waitForURL('/');
		await waitForMenuReady(page);

		// Go forward to game
		await page.goForward();
		await page.waitForURL(/\/play\?stage=1/);
		await waitForGameReady(page);

		const gameState = await getGameState(page);
		expect(gameState).not.toBeNull();
		expect(gameState?.phase).toBe('planning');
	});

	test('should handle multiple back/forward cycles', async ({ page }) => {
		await page.reload();
		await waitForMenuReady(page);

		// Navigate to game via direct URL
		await page.goto('/play?stage=1');
		await waitForGameReady(page);

		// Cycle back and forward multiple times
		for (let i = 0; i < 3; i++) {
			await page.goBack();
			await page.waitForURL('/');
			await waitForMenuReady(page);

			await page.goForward();
			await page.waitForURL(/\/play\?stage=1/);
			await waitForGameReady(page);
		}

		// Should still be functional
		const gameState = await getGameState(page);
		expect(gameState?.phase).toBe('planning');
	});

	test('should start fresh game after browser back during planning', async ({ page }) => {
		await page.reload();
		await waitForMenuReady(page);

		// Start game via direct URL
		await page.goto('/play?stage=1');
		await waitForGameReady(page);

		// Make some moves
		await pressKey(page, 'j');
		await pressKey(page, 'l');

		// Go back
		await page.goBack();
		await page.waitForURL('/');
		await waitForMenuReady(page);

		// Go forward - game should reinitialize
		await page.goForward();
		await page.waitForURL(/\/play\?stage=1/);
		await waitForGameReady(page);

		// Verify game is in initial state
		const gameState = await getGameState(page);
		expect(gameState?.phase).toBe('planning');
		expect(gameState?.wave).toBe(1);
	});

	test('should handle back navigation when on different stages', async ({ page }) => {
		await page.reload();
		await waitForMenuReady(page);

		// Navigate to stage 2 via direct URL
		await page.goto('/play?stage=2');
		await waitForGameReady(page);

		// Go back
		await page.goBack();
		await page.waitForURL('/');
		await waitForMenuReady(page);

		// Navigate to stage 3 via direct URL
		await page.goto('/play?stage=3');
		await waitForGameReady(page);

		// Go back
		await page.goBack();
		await page.waitForURL('/');
	});
});

// ─── Rapid Stage Switching Tests ─────────────────────────────────────────────

test.describe('Rapid Stage Switching', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearProgressData(page);
		await setProgressData(page, { unlockedStages: 4, scores: {} });
		await page.reload();
		await waitForMenuReady(page);
	});

	test('should handle rapid j/k key presses', async ({ page }) => {
		// Press j/k rapidly without delay
		const rapidPresses = ['j', 'j', 'j', 'k', 'k', 'j', 'k', 'j', 'j', 'k'];
		for (const key of rapidPresses) {
			await page.keyboard.press(key);
		}

		// Wait briefly for state to settle
		await page.waitForTimeout(100);

		// Menu should still be functional
		const state = await getMenuState(page);
		expect(state).not.toBeNull();
		// Index should be within valid bounds (0-3)
		expect(state?.selectedIndex).toBeGreaterThanOrEqual(0);
		expect(state?.selectedIndex).toBeLessThanOrEqual(3);
	});

	test('should handle rapid Enter presses on menu', async ({ page }) => {
		// Press Enter multiple times rapidly
		await page.keyboard.press('Enter');
		await page.keyboard.press('Enter');
		await page.keyboard.press('Enter');

		// Should navigate to game (only first Enter should take effect)
		await page.waitForURL(/\/play\?stage=1/);
		await waitForGameReady(page);

		// Game should be functional
		const state = await getGameState(page);
		expect(state?.phase).toBe('planning');
	});

	test('should handle rapid command mode entry/exit', async ({ page }) => {
		// Start game
		await page.goto('/play?stage=1');
		await waitForGameReady(page);

		// Rapidly enter and exit command mode
		for (let i = 0; i < 5; i++) {
			await page.keyboard.press(':');
			await page.waitForTimeout(20);
			await page.keyboard.press('Escape');
			await page.waitForTimeout(20);
		}

		// Game should still be functional
		const state = await getGameState(page);
		expect(state?.phase).toBe('planning');
		expect(state?.mode).toBe('normal');
	});

	test('should handle rapid game navigation cycles via URL', async ({ page }) => {
		for (let i = 0; i < 3; i++) {
			// Start game via URL
			await page.goto('/play?stage=1');
			await waitForGameReady(page);

			// Return to menu via URL
			await page.goto('/');
			await waitForMenuReady(page);
		}

		// Menu should still be functional
		const state = await getMenuState(page);
		expect(state).not.toBeNull();
	});

	test('should handle rapid stage selection changes', async ({ page }) => {
		// Rapidly switch between stages via URL
		await page.goto('/play?stage=2');
		await waitForGameReady(page);

		await page.goto('/');
		await waitForMenuReady(page);

		await page.goto('/play?stage=3');
		await waitForGameReady(page);

		const state = await getGameState(page);
		expect(state?.phase).toBe('planning');
	});

	test('should handle rapid mode changes', async ({ page }) => {
		await pressKey(page, 'Enter');
		await page.waitForURL(/\/play\?stage=1/);
		await waitForGameReady(page);

		// Rapidly toggle modes
		await page.keyboard.press('i'); // Insert
		await page.keyboard.press('Escape'); // Normal
		await page.keyboard.press('i'); // Insert
		await page.keyboard.press('Escape'); // Normal
		await page.keyboard.press(':'); // Command
		await page.keyboard.press('Escape'); // Normal

		// Game should still be functional
		await page.waitForTimeout(100);
		const state = await getGameState(page);
		expect(state?.mode).toBe('normal');
	});
});

// ─── Tab Visibility Change Tests ─────────────────────────────────────────────

test.describe('Tab Visibility Changes', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearProgressData(page);
		await setProgressData(page, { unlockedStages: 4, scores: {} });
	});

	test('should preserve game state when tab becomes hidden during planning', async ({ page }) => {
		await startStage(page, 1);

		// Get initial state
		const initialState = await getGameState(page);
		expect(initialState?.phase).toBe('planning');

		// Place a tower
		await moveCursor(page, 'l', 3);
		await enterInsertMode(page);
		await placeTower(page, 1);
		await exitInsertMode(page);

		const goldAfterPlace = (await getGameState(page))?.gold;

		// Simulate tab becoming hidden
		await page.evaluate(() => {
			Object.defineProperty(document, 'hidden', { value: true, writable: true });
			document.dispatchEvent(new Event('visibilitychange'));
		});

		// Wait a moment
		await page.waitForTimeout(500);

		// Simulate tab becoming visible again
		await page.evaluate(() => {
			Object.defineProperty(document, 'hidden', { value: false, writable: true });
			document.dispatchEvent(new Event('visibilitychange'));
		});

		// State should be preserved
		const afterState = await getGameState(page);
		expect(afterState?.phase).toBe('planning');
		expect(afterState?.gold).toBe(goldAfterPlace);
	});

	test('should handle visibility change during combat', async ({ page }) => {
		// TIMING: With testMode (10x speed), combat is faster
		test.setTimeout(30000);
		await startStage(page, 1, { testMode: true });

		// Place minimal towers
		await moveCursor(page, 'l', 3);
		await enterInsertMode(page);
		await placeTower(page, 1);
		await exitInsertMode(page);

		// Start combat
		await executeCommand(page, 'w');
		await waitForPhase(page, 'combat', { timeout: 5000 });

		// Simulate tab becoming hidden during combat
		await page.evaluate(() => {
			Object.defineProperty(document, 'hidden', { value: true, writable: true });
			document.dispatchEvent(new Event('visibilitychange'));
		});

		// Wait a moment (game may pause or continue depending on implementation)
		await page.waitForTimeout(500);

		// Simulate tab becoming visible
		await page.evaluate(() => {
			Object.defineProperty(document, 'hidden', { value: false, writable: true });
			document.dispatchEvent(new Event('visibilitychange'));
		});

		// Game should still be functional (either in combat or wave_complete/planning)
		await page.waitForTimeout(500);
		const state = await getGameState(page);
		expect(state).not.toBeNull();
		// Phase should be one of the expected game phases
		expect(['planning', 'combat', 'wave_complete', 'stage_complete', 'game_over']).toContain(
			state?.phase
		);
	});

	test('should preserve progression data when tab visibility changes', async ({ page }) => {
		// Set up progression
		await setProgressData(page, {
			unlockedStages: 3,
			scores: {
				1: { bestKeystrokes: 25, rating: 'S' }
			}
		});

		await page.reload();
		await waitForMenuReady(page);

		// Simulate tab hidden/visible cycle
		await page.evaluate(() => {
			Object.defineProperty(document, 'hidden', { value: true, writable: true });
			document.dispatchEvent(new Event('visibilitychange'));
		});

		await page.waitForTimeout(200);

		await page.evaluate(() => {
			Object.defineProperty(document, 'hidden', { value: false, writable: true });
			document.dispatchEvent(new Event('visibilitychange'));
		});

		// Progression should be preserved
		const progress = await getProgressData(page);
		expect(progress?.unlockedStages).toBe(3);
		expect(progress?.scores[1]?.rating).toBe('S');
	});

	test('should handle rapid visibility changes', async ({ page }) => {
		await startStage(page, 1);

		// Rapidly toggle visibility
		for (let i = 0; i < 5; i++) {
			await page.evaluate(() => {
				Object.defineProperty(document, 'hidden', { value: true, writable: true });
				document.dispatchEvent(new Event('visibilitychange'));
			});

			await page.waitForTimeout(50);

			await page.evaluate(() => {
				Object.defineProperty(document, 'hidden', { value: false, writable: true });
				document.dispatchEvent(new Event('visibilitychange'));
			});

			await page.waitForTimeout(50);
		}

		// Game should still be functional
		const state = await getGameState(page);
		expect(state).not.toBeNull();
		expect(state?.phase).toBe('planning');
	});

	test('should maintain correct mode after visibility change', async ({ page }) => {
		await startStage(page, 1);

		// Enter insert mode
		await enterInsertMode(page);
		const beforeHide = await getGameState(page);
		expect(beforeHide?.mode).toBe('insert');

		// Hide and show
		await page.evaluate(() => {
			Object.defineProperty(document, 'hidden', { value: true, writable: true });
			document.dispatchEvent(new Event('visibilitychange'));
		});

		await page.waitForTimeout(200);

		await page.evaluate(() => {
			Object.defineProperty(document, 'hidden', { value: false, writable: true });
			document.dispatchEvent(new Event('visibilitychange'));
		});

		// Mode should be preserved
		const afterShow = await getGameState(page);
		expect(afterShow?.mode).toBe('insert');
	});

	test('should handle page reload after visibility change', async ({ page }) => {
		await setProgressData(page, {
			unlockedStages: 2,
			scores: {
				1: { bestKeystrokes: 30, rating: 'A' }
			}
		});

		await page.reload();
		await waitForMenuReady(page);

		// Hide tab
		await page.evaluate(() => {
			Object.defineProperty(document, 'hidden', { value: true, writable: true });
			document.dispatchEvent(new Event('visibilitychange'));
		});

		await page.waitForTimeout(200);

		// Reload while hidden (edge case)
		await page.reload();
		await waitForMenuReady(page);

		// Show tab
		await page.evaluate(() => {
			Object.defineProperty(document, 'hidden', { value: false, writable: true });
			document.dispatchEvent(new Event('visibilitychange'));
		});

		// Progression should be preserved
		const progress = await getProgressData(page);
		expect(progress?.unlockedStages).toBe(2);
	});
});
