/**
 * E2E Tests: Tower Placement
 *
 * Tests tower placement in insert mode (numbers 1-4 for different towers),
 * invalid placement rejection (on path/spawn/exit), tower selection filtering
 * by stage, gold deduction, and cursor movement in insert mode.
 *
 * ## TIMING CONSIDERATIONS
 *
 * Tower placement tests are mostly FAST - they verify input handling and
 * state changes without running combat. The one exception is the "place tower
 * during combat" test which starts a wave.
 *
 * ### Timeout Strategy:
 * - waitForMode(): 2000ms - mode transitions are instant
 * - waitForGameReady(): Default 10s - game init
 * - waitForPhase('combat'): 5000ms - only in combat-placement test
 *
 * ### No Extended Timeouts:
 * - Tower placement is synchronous with key input
 * - Gold deduction happens immediately
 * - Invalid placement rejection is instant
 *
 * ### Potential Flakiness:
 * - expect().toPass() in combat placement test uses 5s timeout with polling
 *   This is a known pattern for waiting on async state updates
 */

import { test, expect } from '@playwright/test';
import {
	waitForMode,
	getGameState,
	pressKey,
	typeVimSequence,
	enterInsertMode,
	exitInsertMode,
	moveCursor,
	placeTower,
	startStage,
	clearProgressData,
	setProgressData
} from '../helpers/game-helpers.js';

test.describe('Tower Placement', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearProgressData(page);
	});

	// ─── Basic Tower Placement (numbers 1-4) ─────────────────────

	test.describe('Basic Tower Placement', () => {
		test('should place Arrow tower with key 1', async ({ page }) => {
			await startStage(page, 1);

			const initialState = await getGameState(page);
			const initialGold = initialState?.gold ?? 200;

			// Move to empty cell above path
			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k'); // Row above path

			// Enter insert mode and place tower
			await enterInsertMode(page);
			await pressKey(page, '1');

			const state = await getGameState(page);
			// Arrow tower costs 50g
			expect(state?.gold).toBe(initialGold - 50);
		});

		test('should place Cannon tower with key 2 on Stage 2', async ({ page }) => {
			// Unlock stage 2
			await setProgressData(page, {
				unlockedStages: 2,
				scores: {}
			});

			await startStage(page, 2);

			const initialState = await getGameState(page);
			const initialGold = initialState?.gold ?? 250;

			// Move to empty cell
			await moveCursor(page, 'l', 5);
			await moveCursor(page, 'k');

			// Enter insert mode and place cannon
			await enterInsertMode(page);
			await pressKey(page, '2');

			const state = await getGameState(page);
			// Cannon costs 100g
			expect(state?.gold).toBe(initialGold - 100);
		});

		test('should place Frost tower with key 3 on Stage 3', async ({ page }) => {
			// Unlock stage 3
			await setProgressData(page, {
				unlockedStages: 3,
				scores: {}
			});

			await startStage(page, 3);

			const initialState = await getGameState(page);
			const initialGold = initialState?.gold ?? 300;

			// Move to empty cell
			await moveCursor(page, 'l', 1);
			await moveCursor(page, 'j');

			// Enter insert mode and place frost tower
			await enterInsertMode(page);
			await pressKey(page, '3');

			const state = await getGameState(page);
			// Frost tower costs 75g
			expect(state?.gold).toBe(initialGold - 75);
		});

		test('should place Lightning tower with key 4 on Stage 4', async ({ page }) => {
			// Unlock stage 4
			await setProgressData(page, {
				unlockedStages: 4,
				scores: {}
			});

			await startStage(page, 4);

			const initialState = await getGameState(page);
			const initialGold = initialState?.gold ?? 400;

			// Move to empty cell
			await moveCursor(page, 'l', 8);
			await moveCursor(page, 'j', 2);

			// Enter insert mode and place lightning tower
			await enterInsertMode(page);
			await pressKey(page, '4');

			const state = await getGameState(page);
			// Lightning tower costs 125g
			expect(state?.gold).toBe(initialGold - 125);
		});

		test('should require insert mode for tower placement', async ({ page }) => {
			await startStage(page, 1);

			const initialState = await getGameState(page);
			const initialGold = initialState?.gold ?? 200;

			// Move to empty cell
			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k');

			// Try pressing 1 in normal mode (should not place tower)
			await pressKey(page, '1');

			// Should stay in normal mode
			const state = await getGameState(page);
			expect(state?.mode).toBe('normal');
			// Gold should be unchanged
			expect(state?.gold).toBe(initialGold);
		});
	});

	// ─── Tower Selection Filtering by Stage ─────────────────────

	test.describe('Tower Selection Filtering by Stage', () => {
		test('should only allow Arrow tower (1) on Stage 1', async ({ page }) => {
			await startStage(page, 1);

			const initialGold = (await getGameState(page))?.gold ?? 200;

			// Move to empty cell
			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k');
			await enterInsertMode(page);

			// Try placing Cannon (2) - should fail, gold unchanged
			await pressKey(page, '2');
			let state = await getGameState(page);
			expect(state?.gold).toBe(initialGold);

			// Try placing Frost (3) - should fail
			await pressKey(page, '3');
			state = await getGameState(page);
			expect(state?.gold).toBe(initialGold);

			// Try placing Lightning (4) - should fail
			await pressKey(page, '4');
			state = await getGameState(page);
			expect(state?.gold).toBe(initialGold);

			// Arrow (1) should work
			await pressKey(page, '1');
			state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 50);

			await exitInsertMode(page);
		});

		test('should allow Arrow and Cannon towers on Stage 2', async ({ page }) => {
			await setProgressData(page, {
				unlockedStages: 2,
				scores: {}
			});

			await startStage(page, 2);

			const initialGold = (await getGameState(page))?.gold ?? 250;

			// Move to empty cell
			await moveCursor(page, 'l', 5);
			await moveCursor(page, 'k');
			await enterInsertMode(page);

			// Try placing Frost (3) - should fail
			await pressKey(page, '3');
			let state = await getGameState(page);
			expect(state?.gold).toBe(initialGold);

			// Try placing Lightning (4) - should fail
			await pressKey(page, '4');
			state = await getGameState(page);
			expect(state?.gold).toBe(initialGold);

			// Arrow (1) should work
			await pressKey(page, '1');
			state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 50);

			// Move and place Cannon (2)
			await moveCursor(page, 'l', 2);
			await pressKey(page, '2');
			state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 50 - 100);

			await exitInsertMode(page);
		});

		test('should allow Arrow, Cannon, and Frost towers on Stage 3', async ({ page }) => {
			await setProgressData(page, {
				unlockedStages: 3,
				scores: {}
			});

			await startStage(page, 3);

			const initialGold = (await getGameState(page))?.gold ?? 300;

			// Move to empty cell
			await moveCursor(page, 'l', 1);
			await moveCursor(page, 'j');
			await enterInsertMode(page);

			// Try placing Lightning (4) - should fail
			await pressKey(page, '4');
			let state = await getGameState(page);
			expect(state?.gold).toBe(initialGold);

			// Frost (3) should work
			await pressKey(page, '3');
			state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 75);

			await exitInsertMode(page);
		});

		test('should allow all tower types on Stage 4', async ({ page }) => {
			await setProgressData(page, {
				unlockedStages: 4,
				scores: {}
			});

			await startStage(page, 4);

			const initialGold = (await getGameState(page))?.gold ?? 400;

			// Move to empty cell
			await moveCursor(page, 'l', 8);
			await moveCursor(page, 'j', 2);
			await enterInsertMode(page);

			// Lightning (4) should work
			await pressKey(page, '4');
			const state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 125);

			await exitInsertMode(page);
		});
	});

	// ─── Invalid Placement Rejection ────────────────────────────

	test.describe('Invalid Placement Rejection', () => {
		test('should reject placement on path cells', async ({ page }) => {
			await startStage(page, 1);

			const initialGold = (await getGameState(page))?.gold ?? 200;

			// Path is at y=3 in Stage 1 (0-indexed)
			// Move to a path cell
			await moveCursor(page, 'j', 3); // Move to path row
			await moveCursor(page, 'l', 4); // Move along path

			await enterInsertMode(page);
			await pressKey(page, '1');

			const state = await getGameState(page);
			// Gold should be unchanged - placement rejected
			expect(state?.gold).toBe(initialGold);
			// Should still be in insert mode
			expect(state?.mode).toBe('insert');

			await exitInsertMode(page);
		});

		test('should reject placement on spawn cell', async ({ page }) => {
			await startStage(page, 1);

			const initialGold = (await getGameState(page))?.gold ?? 200;

			// Spawn is at (0, 3) in Stage 1
			await moveCursor(page, 'j', 3); // Move to spawn row

			await enterInsertMode(page);
			await pressKey(page, '1');

			const state = await getGameState(page);
			// Gold should be unchanged - placement rejected
			expect(state?.gold).toBe(initialGold);

			await exitInsertMode(page);
		});

		test('should reject placement on exit cell', async ({ page }) => {
			await startStage(page, 1);

			const initialGold = (await getGameState(page))?.gold ?? 200;

			// Exit is at (9, 3) in Stage 1
			await moveCursor(page, 'j', 3); // Move to exit row
			await moveCursor(page, 'l', 9); // Move to exit column

			await enterInsertMode(page);
			await pressKey(page, '1');

			const state = await getGameState(page);
			// Gold should be unchanged - placement rejected
			expect(state?.gold).toBe(initialGold);

			await exitInsertMode(page);
		});

		test('should reject placement on occupied cell', async ({ page }) => {
			await startStage(page, 1);

			const initialGold = (await getGameState(page))?.gold ?? 200;

			// Move to empty cell
			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k');

			await enterInsertMode(page);

			// Place first tower
			await pressKey(page, '1');
			let state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 50);

			// Try to place another tower on same cell
			await pressKey(page, '1');
			state = await getGameState(page);
			// Gold should not have changed further
			expect(state?.gold).toBe(initialGold - 50);

			await exitInsertMode(page);
		});

		test('should reject placement when not enough gold', async ({ page }) => {
			await startStage(page, 1);

			// Place enough towers to run out of gold
			// Starting gold is 200, arrow costs 50
			await moveCursor(page, 'k'); // Move above path
			await enterInsertMode(page);

			// Place 4 towers (4 * 50 = 200 gold)
			await moveCursor(page, 'l', 2);
			await pressKey(page, '1');
			await moveCursor(page, 'l', 2);
			await pressKey(page, '1');
			await moveCursor(page, 'l', 2);
			await pressKey(page, '1');
			await moveCursor(page, 'l', 2);
			await pressKey(page, '1');

			let state = await getGameState(page);
			expect(state?.gold).toBe(0);

			// Try to place another tower
			await moveCursor(page, 'j', 4); // Move below path
			await moveCursor(page, 'h', 8); // Go back
			await pressKey(page, '1');

			state = await getGameState(page);
			expect(state?.gold).toBe(0); // Should still be 0

			await exitInsertMode(page);
		});
	});

	// ─── Gold Deduction ─────────────────────────────────────────

	test.describe('Gold Deduction', () => {
		test('should deduct correct cost for Arrow tower (50g)', async ({ page }) => {
			await startStage(page, 1);

			const initialGold = (await getGameState(page))?.gold ?? 200;

			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k');
			await enterInsertMode(page);
			await pressKey(page, '1');

			const state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 50);

			await exitInsertMode(page);
		});

		test('should deduct correct cost for Cannon tower (100g)', async ({ page }) => {
			await setProgressData(page, {
				unlockedStages: 2,
				scores: {}
			});

			await startStage(page, 2);

			const initialGold = (await getGameState(page))?.gold ?? 250;

			await moveCursor(page, 'l', 5);
			await moveCursor(page, 'k');
			await enterInsertMode(page);
			await pressKey(page, '2');

			const state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 100);

			await exitInsertMode(page);
		});

		test('should deduct correct cost for Frost tower (75g)', async ({ page }) => {
			await setProgressData(page, {
				unlockedStages: 3,
				scores: {}
			});

			await startStage(page, 3);

			const initialGold = (await getGameState(page))?.gold ?? 300;

			await moveCursor(page, 'l', 1);
			await moveCursor(page, 'j');
			await enterInsertMode(page);
			await pressKey(page, '3');

			const state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 75);

			await exitInsertMode(page);
		});

		test('should deduct correct cost for Lightning tower (125g)', async ({ page }) => {
			await setProgressData(page, {
				unlockedStages: 4,
				scores: {}
			});

			await startStage(page, 4);

			const initialGold = (await getGameState(page))?.gold ?? 400;

			await moveCursor(page, 'l', 8);
			await moveCursor(page, 'j', 2);
			await enterInsertMode(page);
			await pressKey(page, '4');

			const state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 125);

			await exitInsertMode(page);
		});

		test('should accumulate gold deductions for multiple towers', async ({ page }) => {
			await startStage(page, 1);

			const initialGold = (await getGameState(page))?.gold ?? 200;

			await moveCursor(page, 'k');
			await enterInsertMode(page);

			// Place first tower
			await moveCursor(page, 'l', 2);
			await pressKey(page, '1');
			let state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 50);

			// Place second tower
			await moveCursor(page, 'l', 2);
			await pressKey(page, '1');
			state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 100);

			// Place third tower
			await moveCursor(page, 'l', 2);
			await pressKey(page, '1');
			state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 150);

			await exitInsertMode(page);
		});
	});

	// ─── Cursor Movement in Insert Mode ─────────────────────────

	test.describe('Cursor Movement in Insert Mode', () => {
		test('should support h/j/k/l movement while in insert mode', async ({ page }) => {
			await startStage(page, 1);

			await enterInsertMode(page);

			// Move around
			await moveCursor(page, 'l');
			await moveCursor(page, 'j');
			await moveCursor(page, 'k');
			await moveCursor(page, 'h');

			// Should still be in insert mode
			const state = await getGameState(page);
			expect(state?.mode).toBe('insert');

			await exitInsertMode(page);
		});

		test('should allow placing towers at different positions in insert mode', async ({ page }) => {
			await startStage(page, 1);

			const initialGold = (await getGameState(page))?.gold ?? 200;

			// Move to first position and enter insert mode
			await moveCursor(page, 'k');
			await moveCursor(page, 'l', 2);
			await enterInsertMode(page);

			// Place tower
			await pressKey(page, '1');
			let state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 50);
			expect(state?.mode).toBe('insert');

			// Move to new position (still in insert mode)
			await moveCursor(page, 'l', 2);

			// Place another tower
			await pressKey(page, '1');
			state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 100);
			expect(state?.mode).toBe('insert');

			await exitInsertMode(page);
		});

		test('should allow cursor movement after tower placement', async ({ page }) => {
			await startStage(page, 1);

			const initialGold = (await getGameState(page))?.gold ?? 200;

			// Enter insert mode
			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k');
			await enterInsertMode(page);

			// Place tower
			await pressKey(page, '1');
			let state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 50);

			// Move cursor after placing
			await moveCursor(page, 'l', 2);
			await moveCursor(page, 'j');

			// Should still be in insert mode
			state = await getGameState(page);
			expect(state?.mode).toBe('insert');

			await exitInsertMode(page);
		});

		test('should stay in insert mode after failed placement', async ({ page }) => {
			await startStage(page, 1);

			// Move to path cell
			await moveCursor(page, 'j', 3);
			await moveCursor(page, 'l', 4);

			await enterInsertMode(page);

			// Try to place tower on path (should fail)
			await pressKey(page, '1');

			// Should still be in insert mode
			const state = await getGameState(page);
			expect(state?.mode).toBe('insert');

			// Should be able to move and place elsewhere
			await moveCursor(page, 'k'); // Move above path
			await pressKey(page, '1');

			const finalState = await getGameState(page);
			expect(finalState?.mode).toBe('insert');
			expect(finalState?.gold).toBeLessThan(200);

			await exitInsertMode(page);
		});

		test('should not support count prefixes in insert mode', async ({ page }) => {
			await startStage(page, 1);

			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k');
			await enterInsertMode(page);

			// In insert mode, pressing a number should try to place a tower, not act as a count prefix
			// After pressing '1', it places an Arrow tower
			await pressKey(page, '1');

			const state = await getGameState(page);
			// Tower should have been placed (gold reduced)
			expect(state?.gold).toBeLessThan(200);
			expect(state?.mode).toBe('insert');

			await exitInsertMode(page);
		});
	});

	// ─── Tower Placement During Different Game Phases ───────────

	test.describe('Tower Placement During Different Phases', () => {
		test('should allow tower placement during planning phase', async ({ page }) => {
			await startStage(page, 1);

			const state = await getGameState(page);
			expect(state?.phase).toBe('planning');

			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k');
			await enterInsertMode(page);
			await placeTower(page, 1);

			const finalState = await getGameState(page);
			expect(finalState?.gold).toBeLessThan(200);

			await exitInsertMode(page);
		});

		test('should allow tower placement during combat phase', async ({ page }) => {
			await startStage(page, 1);

			// Place initial tower
			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k');
			await enterInsertMode(page);
			await placeTower(page, 1);
			await exitInsertMode(page);

			// Start combat
			await pressKey(page, ':');
			await waitForMode(page, 'command', { timeout: 2000 });
			await pressKey(page, 'w');
			await pressKey(page, 'Enter');

			// Wait for combat phase
			await expect(async () => {
				const state = await getGameState(page);
				expect(state?.phase).toBe('combat');
			}).toPass({ timeout: 5000 });

			// Now try to place another tower during combat
			await moveCursor(page, 'l', 2);
			await enterInsertMode(page);

			const goldBefore = (await getGameState(page))?.gold ?? 0;
			await pressKey(page, '1');

			const goldAfter = (await getGameState(page))?.gold ?? 0;
			// Should be able to place tower during combat
			expect(goldAfter).toBe(goldBefore - 50);

			await exitInsertMode(page);
		});
	});

	// ─── Insert Mode Variants ───────────────────────────────────

	test.describe('Insert Mode Variants', () => {
		test('should enter insert mode with i', async ({ page }) => {
			await startStage(page, 1);

			await pressKey(page, 'i');
			await waitForMode(page, 'insert', { timeout: 2000 });

			const state = await getGameState(page);
			expect(state?.mode).toBe('insert');

			await exitInsertMode(page);
		});

		test('should enter insert mode with a', async ({ page }) => {
			await startStage(page, 1);

			await pressKey(page, 'a');
			await waitForMode(page, 'insert', { timeout: 2000 });

			const state = await getGameState(page);
			expect(state?.mode).toBe('insert');

			await exitInsertMode(page);
		});

		test('should enter insert mode with o', async ({ page }) => {
			await startStage(page, 1);

			await pressKey(page, 'o');
			await waitForMode(page, 'insert', { timeout: 2000 });

			const state = await getGameState(page);
			expect(state?.mode).toBe('insert');

			await exitInsertMode(page);
		});

		test('should enter insert mode with O', async ({ page }) => {
			await startStage(page, 1);

			await pressKey(page, 'O');
			await waitForMode(page, 'insert', { timeout: 2000 });

			const state = await getGameState(page);
			expect(state?.mode).toBe('insert');

			await exitInsertMode(page);
		});

		test('should allow tower placement with any insert mode variant', async ({ page }) => {
			await startStage(page, 1);

			const initialGold = (await getGameState(page))?.gold ?? 200;

			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k');

			// Use 'a' variant instead of 'i'
			await pressKey(page, 'a');
			await waitForMode(page, 'insert', { timeout: 2000 });

			await pressKey(page, '1');

			const state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 50);

			await exitInsertMode(page);
		});
	});

	// ─── Edge Cases ─────────────────────────────────────────────

	test.describe('Edge Cases', () => {
		test('should handle placement at grid corners', async ({ page }) => {
			await startStage(page, 1);

			// Move to top-left corner
			await typeVimSequence(page, 'gg');
			await enterInsertMode(page);
			await pressKey(page, '1');

			let state = await getGameState(page);
			expect(state?.gold).toBe(150); // 200 - 50

			// Move to bottom-left and place
			await exitInsertMode(page);
			await pressKey(page, 'G');
			await pressKey(page, '0');
			await enterInsertMode(page);
			await pressKey(page, '1');

			state = await getGameState(page);
			expect(state?.gold).toBe(100); // 150 - 50

			await exitInsertMode(page);
		});

		test('should handle rapid tower placement', async ({ page }) => {
			await startStage(page, 1);

			const initialGold = (await getGameState(page))?.gold ?? 200;

			await moveCursor(page, 'k');
			await enterInsertMode(page);

			// Rapidly place multiple towers
			await moveCursor(page, 'l', 1);
			await pressKey(page, '1');
			await moveCursor(page, 'l', 2);
			await pressKey(page, '1');
			await moveCursor(page, 'l', 2);
			await pressKey(page, '1');

			const state = await getGameState(page);
			expect(state?.gold).toBe(initialGold - 150);

			await exitInsertMode(page);
		});

		test('should handle tower key when unavailable tower type', async ({ page }) => {
			await startStage(page, 1);

			const initialGold = (await getGameState(page))?.gold ?? 200;

			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k');
			await enterInsertMode(page);

			// Try keys 5-9 which don't map to towers
			await pressKey(page, '5');
			await pressKey(page, '6');
			await pressKey(page, '7');
			await pressKey(page, '8');
			await pressKey(page, '9');

			const state = await getGameState(page);
			// Gold should be unchanged
			expect(state?.gold).toBe(initialGold);

			await exitInsertMode(page);
		});

		test('should increment keystroke count for tower placement', async ({ page }) => {
			await startStage(page, 1);

			const initialState = await getGameState(page);
			const initialKeystrokes = initialState?.keystrokeCount ?? 0;

			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k');
			await enterInsertMode(page);
			await pressKey(page, '1');

			const state = await getGameState(page);
			// Keystroke count should have increased (movement + enter insert + place tower)
			expect(state?.keystrokeCount).toBeGreaterThan(initialKeystrokes);

			await exitInsertMode(page);
		});
	});
});
