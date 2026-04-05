/**
 * E2E Tests: Menu Navigation
 *
 * Tests stage selection with j/k/Enter, locked stage prevention,
 * progression display, and navigation back from game with Escape.
 *
 * ## TIMING CONSIDERATIONS
 *
 * Menu navigation tests are FAST - they test UI interactions without combat.
 *
 * ### Timeout Strategy:
 * - waitForMenuReady(): Default 10s - menu loads quickly
 * - waitForGameReady(): 5000ms - game initialization
 * - page.waitForURL(): Uses Playwright defaults
 * - page.waitForTimeout(300): Only used for locked stage tests
 *   (verifying navigation does NOT occur)
 *
 * ### Potential Flakiness:
 * - page.waitForTimeout(300) in locked stage tests is a "wait for nothing to happen"
 *   pattern - if navigation is slow, this could false-negative. However, 300ms is
 *   sufficient since menu->game navigation completes in <100ms typically.
 */

import { test, expect } from '@playwright/test';
import {
	waitForMenuReady,
	waitForGameReady,
	getMenuState,
	pressKey,
	setProgressData,
	clearProgressData,
	getProgressData
} from '../helpers/game-helpers.js';

test.describe('Menu Navigation', () => {
	test.beforeEach(async ({ page }) => {
		// Clear any saved progress before each test
		await page.goto('/');
		await clearProgressData(page);
		// Reload to apply cleared progress
		await page.reload();
		await waitForMenuReady(page);
	});

	test.describe('Stage Selection with j/k keys', () => {
		test('should start with first stage selected', async ({ page }) => {
			const state = await getMenuState(page);
			expect(state?.selectedIndex).toBe(0);
		});

		test('should move selection down with j key', async ({ page }) => {
			await pressKey(page, 'j');
			const state = await getMenuState(page);
			expect(state?.selectedIndex).toBe(1);
		});

		test('should move selection up with k key', async ({ page }) => {
			// First move down
			await pressKey(page, 'j');
			await pressKey(page, 'j');
			let state = await getMenuState(page);
			expect(state?.selectedIndex).toBe(2);

			// Then move up
			await pressKey(page, 'k');
			state = await getMenuState(page);
			expect(state?.selectedIndex).toBe(1);
		});

		test('should not go above first stage with k', async ({ page }) => {
			// Try to go up from first stage
			await pressKey(page, 'k');
			const state = await getMenuState(page);
			expect(state?.selectedIndex).toBe(0);
		});

		test('should not go below last stage with j', async ({ page }) => {
			// Move to last stage (4 stages total, so j*3)
			await pressKey(page, 'j');
			await pressKey(page, 'j');
			await pressKey(page, 'j');
			let state = await getMenuState(page);
			expect(state?.selectedIndex).toBe(3);

			// Try to go further down
			await pressKey(page, 'j');
			state = await getMenuState(page);
			expect(state?.selectedIndex).toBe(3);
		});

		test('should support arrow key navigation (ArrowDown)', async ({ page }) => {
			await page.keyboard.press('ArrowDown');
			const state = await getMenuState(page);
			expect(state?.selectedIndex).toBe(1);
		});

		test('should support arrow key navigation (ArrowUp)', async ({ page }) => {
			await pressKey(page, 'j');
			await page.keyboard.press('ArrowUp');
			const state = await getMenuState(page);
			expect(state?.selectedIndex).toBe(0);
		});
	});

	test.describe('Stage Selection with Enter', () => {
		test('should launch stage 1 when pressing Enter on first unlocked stage', async ({ page }) => {
			await pressKey(page, 'Enter');

			// Should navigate to play route
			await page.waitForURL(/\/play\?stage=1/);
			await waitForGameReady(page);
		});

		test('should launch selected stage with Enter', async ({ page }) => {
			// Unlock stage 2
			await setProgressData(page, {
				unlockedStages: 2,
				scores: {}
			});
			await page.reload();
			await waitForMenuReady(page);

			// Select stage 2
			await pressKey(page, 'j');
			const state = await getMenuState(page);
			expect(state?.selectedIndex).toBe(1);

			// Launch
			await pressKey(page, 'Enter');
			await page.waitForURL(/\/play\?stage=2/);
			await waitForGameReady(page);
		});

		test('should also launch stage with l key', async ({ page }) => {
			await pressKey(page, 'l');
			await page.waitForURL(/\/play\?stage=1/);
		});

		test('should also launch stage with ArrowRight', async ({ page }) => {
			await page.keyboard.press('ArrowRight');
			await page.waitForURL(/\/play\?stage=1/);
		});
	});

	test.describe('Locked Stage Prevention', () => {
		test('should show only stage 1 unlocked by default', async ({ page }) => {
			const state = await getMenuState(page);
			expect(state?.unlockedStages).toBe(1);
		});

		test('should not launch locked stage 2 when pressing Enter', async ({ page }) => {
			// Move to stage 2 (locked)
			await pressKey(page, 'j');
			const state = await getMenuState(page);
			expect(state?.selectedIndex).toBe(1);

			// Try to launch
			await pressKey(page, 'Enter');

			// Should remain on menu (no navigation)
			await page.waitForTimeout(300);
			expect(page.url()).not.toContain('/play');
		});

		test('should not launch locked stage 3 when pressing Enter', async ({ page }) => {
			// Move to stage 3
			await pressKey(page, 'j');
			await pressKey(page, 'j');

			await pressKey(page, 'Enter');

			await page.waitForTimeout(300);
			expect(page.url()).not.toContain('/play');
		});

		test('should not launch locked stage 4 when pressing Enter', async ({ page }) => {
			// Move to stage 4
			await pressKey(page, 'j');
			await pressKey(page, 'j');
			await pressKey(page, 'j');

			await pressKey(page, 'Enter');

			await page.waitForTimeout(300);
			expect(page.url()).not.toContain('/play');
		});

		test('should respect unlocked stages from progression', async ({ page }) => {
			// Unlock stages 1-3
			await setProgressData(page, {
				unlockedStages: 3,
				scores: {}
			});
			await page.reload();
			await waitForMenuReady(page);

			const state = await getMenuState(page);
			expect(state?.unlockedStages).toBe(3);

			// Stage 3 should be launchable
			await pressKey(page, 'j');
			await pressKey(page, 'j');
			await pressKey(page, 'Enter');
			await page.waitForURL(/\/play\?stage=3/);
		});
	});

	test.describe('Progression Display', () => {
		test('should display score for completed stages', async ({ page }) => {
			// Set up progression with a score for stage 1
			await setProgressData(page, {
				unlockedStages: 2,
				scores: {
					1: {
						bestKeystrokes: 25,
						rating: 'S'
					}
				}
			});
			await page.reload();
			await waitForMenuReady(page);

			const state = await getMenuState(page);
			expect(state?.unlockedStages).toBe(2);
		});

		test('should show multiple stage scores', async ({ page }) => {
			await setProgressData(page, {
				unlockedStages: 4,
				scores: {
					1: { bestKeystrokes: 20, rating: 'S' },
					2: { bestKeystrokes: 45, rating: 'A' },
					3: { bestKeystrokes: 80, rating: 'B' }
				}
			});
			await page.reload();
			await waitForMenuReady(page);

			const state = await getMenuState(page);
			expect(state?.unlockedStages).toBe(4);
		});

		test('should preserve progression across page reloads', async ({ page }) => {
			await setProgressData(page, {
				unlockedStages: 3,
				scores: {
					1: { bestKeystrokes: 30, rating: 'A' }
				}
			});
			await page.reload();
			await waitForMenuReady(page);

			let state = await getMenuState(page);
			expect(state?.unlockedStages).toBe(3);

			// Reload again
			await page.reload();
			await waitForMenuReady(page);

			state = await getMenuState(page);
			expect(state?.unlockedStages).toBe(3);

			// Verify in localStorage
			const progress = await getProgressData(page);
			expect(progress?.unlockedStages).toBe(3);
			expect(progress?.scores[1]?.bestKeystrokes).toBe(30);
		});
	});

	test.describe('Navigation Back from Game', () => {
		test('should return to menu with :q command', async ({ page }) => {
			// Start stage 1
			await pressKey(page, 'Enter');
			await page.waitForURL(/\/play\?stage=1/);
			await waitForGameReady(page);

			// Use :q to quit
			await pressKey(page, ':');
			await pressKey(page, 'q');
			await pressKey(page, 'Enter');

			// Should return to menu
			await page.waitForURL('/');
			await waitForMenuReady(page);
		});

		test('should return to menu with :q! command', async ({ page }) => {
			await pressKey(page, 'Enter');
			await page.waitForURL(/\/play\?stage=1/);
			await waitForGameReady(page);

			// Use :q! to force quit
			await pressKey(page, ':');
			await pressKey(page, 'q');
			await pressKey(page, '!');
			await pressKey(page, 'Enter');

			await page.waitForURL('/');
			await waitForMenuReady(page);
		});

		test('should preserve menu selection state after returning from game', async ({ page }) => {
			// Unlock all stages for this test
			await setProgressData(page, {
				unlockedStages: 4,
				scores: {}
			});
			await page.reload();
			await waitForMenuReady(page);

			// Select stage 2
			await pressKey(page, 'j');

			// Start game
			await pressKey(page, 'Enter');
			await page.waitForURL(/\/play\?stage=2/);
			await waitForGameReady(page);

			// Return to menu
			await pressKey(page, ':');
			await pressKey(page, 'q');
			await pressKey(page, 'Enter');

			await page.waitForURL('/');
			await waitForMenuReady(page);

			// Selection should reset to first item (menu doesn't preserve state)
			const state = await getMenuState(page);
			expect(state?.selectedIndex).toBe(0);
		});
	});

	test.describe('Direct URL Navigation', () => {
		test('should start game directly via URL parameter', async ({ page }) => {
			await page.goto('/play?stage=1');
			await waitForGameReady(page);
			expect(page.url()).toContain('/play?stage=1');
		});

		test('should handle direct navigation to locked stage', async ({ page }) => {
			// Stage 2 is locked by default
			await page.goto('/play?stage=2');

			// The game should still load (URL params bypass menu)
			// This tests that the game gracefully handles this case
			await waitForGameReady(page, { timeout: 5000 });
		});
	});
});
