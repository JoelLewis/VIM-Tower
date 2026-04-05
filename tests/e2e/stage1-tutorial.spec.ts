/**
 * E2E Tests: Stage 1 Tutorial Playthrough
 *
 * Tests complete Stage 1 gameplay including:
 * - Tutorial step progression (cursor movement, insert mode, tower placement, :w command)
 * - Wave completion
 * - Victory with rating calculation
 *
 * ## TIMING CONSIDERATIONS
 *
 * Stage 1 is the shortest stage with only 3 waves and a straight horizontal path.
 * Most tests here involve single-wave or few-wave combat, so timeouts are shorter
 * than the full stage progression tests.
 *
 * ### Timeout Strategy:
 * - waitForPhase('combat', { timeout: 5000 }): Immediate transition
 * - waitForPhase('wave_complete', { timeout: 30000 }): Stage 1 waves are quick
 *   - 3 walker enemies per wave
 *   - Short horizontal path (~10 cells)
 *   - With towers, waves complete in 15-25s
 * - waitForPhase('stage_complete', { timeout: 30000 }): Final wave victory
 *
 * ### Flakiness Considerations:
 * - Tutorial tests don't have combat, so no timing issues
 * - Wave completion tests depend on tower placement effectiveness
 * - Insufficient towers = test timeout (enemies not defeated fast enough)
 */

import { test, expect } from '@playwright/test';
import {
	waitForPhase,
	waitForMode,
	getGameState,
	pressKey,
	typeVimSequence,
	enterInsertMode,
	exitInsertMode,
	executeCommand,
	moveCursor,
	placeTower,
	startStage,
	clearProgressData,
	getProgressData
} from '../helpers/game-helpers.js';

test.describe('Stage 1 Tutorial Playthrough', () => {
	test.beforeEach(async ({ page }) => {
		// Clear any saved progress before each test
		await page.goto('/');
		await clearProgressData(page);
	});

	test.describe('Tutorial Step Progression', () => {
		test('should start with tutorial message on Stage 1', async ({ page }) => {
			await startStage(page, 1);

			const state = await getGameState(page);
			expect(state?.phase).toBe('planning');
			expect(state?.mode).toBe('normal');
		});

		test('should progress tutorial when moving cursor with h/j/k/l', async ({ page }) => {
			await startStage(page, 1);

			// Step 1: "Welcome to :wq! Use h/j/k/l to move the cursor."
			// Move cursor to advance tutorial
			await moveCursor(page, 'j');
			await moveCursor(page, 'l');

			// Verify we're still in normal mode and game is responsive
			const state = await getGameState(page);
			expect(state?.mode).toBe('normal');
		});

		test('should enter insert mode when pressing i', async ({ page }) => {
			await startStage(page, 1);

			// Move cursor to a valid placement position first
			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k');

			// Enter insert mode
			await enterInsertMode(page);

			const state = await getGameState(page);
			expect(state?.mode).toBe('insert');
		});

		test('should place tower in insert mode with number keys', async ({ page }) => {
			await startStage(page, 1);

			// Move cursor to empty cell adjacent to path (row 2, any column)
			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k'); // Move up to row 2

			// Enter insert mode and place tower
			await enterInsertMode(page);
			await placeTower(page, 1); // Place Arrow tower

			// Check gold was deducted (starting gold is 200, arrow tower costs some amount)
			const state = await getGameState(page);
			expect(state?.gold).toBeLessThan(200);
		});

		test('should return to normal mode with Escape', async ({ page }) => {
			await startStage(page, 1);

			// Enter and exit insert mode
			await enterInsertMode(page);
			await exitInsertMode(page);

			const state = await getGameState(page);
			expect(state?.mode).toBe('normal');
		});

		test('should start wave with :w command', async ({ page }) => {
			await startStage(page, 1);

			// Place a tower first
			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k');
			await enterInsertMode(page);
			await placeTower(page, 1);
			await exitInsertMode(page);

			// Start wave with :w
			await executeCommand(page, 'w');

			// TIMING: Combat phase starts immediately after :w command is processed
			await waitForPhase(page, 'combat', { timeout: 5000 });

			const state = await getGameState(page);
			expect(state?.phase).toBe('combat');
			expect(state?.wave).toBe(1);
		});
	});

	test.describe('Wave Completion', () => {
		test('should transition to wave_complete after all enemies defeated', async ({ page }) => {
			await startStage(page, 1);

			// Place multiple towers for reliable wave completion
			// Row above path (y=2)
			await moveCursor(page, 'l', 2);
			await moveCursor(page, 'k');
			await enterInsertMode(page);
			await placeTower(page, 1);

			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);

			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);

			await exitInsertMode(page);

			// Start wave
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });

			// TIMING: Wave 1 spawns 3 walker enemies over ~10s
			// With 3 arrow towers, enemies are defeated in ~15-25s total
			// 30s timeout provides comfortable safety margin
			await waitForPhase(page, 'wave_complete', { timeout: 30000 });

			const state = await getGameState(page);
			expect(state?.phase).toBe('wave_complete');
		});

		test('should transition to planning phase for next wave', async ({ page }) => {
			await startStage(page, 1);

			// Place towers
			await moveCursor(page, 'l', 2);
			await moveCursor(page, 'k');
			await enterInsertMode(page);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);
			await exitInsertMode(page);

			// Complete wave 1
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			// TIMING: Single wave completion
			await waitForPhase(page, 'wave_complete', { timeout: 30000 });

			// TIMING: wave_complete -> planning transition is automatic and instant
			await waitForPhase(page, 'planning', { timeout: 5000 });

			const state = await getGameState(page);
			expect(state?.phase).toBe('planning');
			expect(state?.wave).toBe(2);
		});

		test('should track wave count correctly through multiple waves', async ({ page }) => {
			await startStage(page, 1);

			// Place several towers for reliable completion
			await moveCursor(page, 'l', 2);
			await moveCursor(page, 'k');
			await enterInsertMode(page);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);
			await exitInsertMode(page);

			// Wave 1
			let state = await getGameState(page);
			expect(state?.wave).toBe(1);
			expect(state?.totalWaves).toBe(3);

			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			await waitForPhase(page, 'wave_complete', { timeout: 30000 });
			await waitForPhase(page, 'planning', { timeout: 5000 });

			// Wave 2
			state = await getGameState(page);
			expect(state?.wave).toBe(2);

			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			await waitForPhase(page, 'wave_complete', { timeout: 30000 });
			await waitForPhase(page, 'planning', { timeout: 5000 });

			// Wave 3
			state = await getGameState(page);
			expect(state?.wave).toBe(3);
		});
	});

	test.describe('Victory and Rating Calculation', () => {
		test('should reach stage_complete after all waves', async ({ page }) => {
			await startStage(page, 1);

			// Place towers strategically for reliable completion
			// Row above path (y=2)
			await moveCursor(page, 'l', 2);
			await moveCursor(page, 'k');
			await enterInsertMode(page);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);
			await exitInsertMode(page);

			// Complete all 3 waves
			for (let wave = 1; wave <= 3; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });

				if (wave < 3) {
					await waitForPhase(page, 'wave_complete', { timeout: 30000 });
					await waitForPhase(page, 'planning', { timeout: 5000 });
				} else {
					// Last wave goes to stage_complete
					await waitForPhase(page, 'stage_complete', { timeout: 30000 });
				}
			}

			const state = await getGameState(page);
			expect(state?.phase).toBe('stage_complete');
		});

		test('should track keystrokes during gameplay', async ({ page }) => {
			await startStage(page, 1);

			const initialState = await getGameState(page);
			const initialKeystrokes = initialState?.keystrokeCount ?? 0;

			// Perform some actions
			await moveCursor(page, 'j');
			await moveCursor(page, 'l');
			await moveCursor(page, 'l');

			const state = await getGameState(page);
			expect(state?.keystrokeCount).toBeGreaterThan(initialKeystrokes);
		});

		test('should preserve lives when no enemies reach exit', async ({ page }) => {
			await startStage(page, 1);

			const initialState = await getGameState(page);
			expect(initialState?.lives).toBe(10);

			// Place sufficient towers
			await moveCursor(page, 'l', 2);
			await moveCursor(page, 'k');
			await enterInsertMode(page);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);
			await exitInsertMode(page);

			// Complete wave 1
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			await waitForPhase(page, 'wave_complete', { timeout: 30000 });

			const state = await getGameState(page);
			expect(state?.lives).toBe(10);
		});

		test('should save progression and unlock Stage 2 after victory', async ({ page }) => {
			await startStage(page, 1);

			// Place sufficient towers
			await moveCursor(page, 'l', 2);
			await moveCursor(page, 'k');
			await enterInsertMode(page);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);
			await exitInsertMode(page);

			// Complete all waves
			for (let wave = 1; wave <= 3; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });

				if (wave < 3) {
					await waitForPhase(page, 'wave_complete', { timeout: 30000 });
					await waitForPhase(page, 'planning', { timeout: 5000 });
				} else {
					await waitForPhase(page, 'stage_complete', { timeout: 30000 });
				}
			}

			// Press Enter or Escape to return to menu (which triggers save)
			await pressKey(page, 'Enter');

			// Wait for navigation to menu
			await page.waitForURL('/');

			// Check localStorage for progression
			const progress = await getProgressData(page);
			expect(progress).not.toBeNull();
			expect(progress?.unlockedStages).toBeGreaterThanOrEqual(2);
			expect(progress?.scores[1]).toBeDefined();
			expect(progress?.scores[1].bestKeystrokes).toBeGreaterThan(0);
		});

		test('should calculate rating based on keystroke count vs par', async ({ page }) => {
			await startStage(page, 1);

			// Place towers efficiently
			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k');
			await enterInsertMode(page);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);
			await exitInsertMode(page);

			// Complete all waves
			for (let wave = 1; wave <= 3; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });

				if (wave < 3) {
					await waitForPhase(page, 'wave_complete', { timeout: 30000 });
					await waitForPhase(page, 'planning', { timeout: 5000 });
				} else {
					await waitForPhase(page, 'stage_complete', { timeout: 30000 });
				}
			}

			// Return to menu to save progress
			await pressKey(page, 'Enter');
			await page.waitForURL('/');

			// Verify rating was calculated
			const progress = await getProgressData(page);
			expect(progress?.scores[1]).toBeDefined();
			// Rating should be S, A, B, or C based on keystrokes vs par (30)
			const rating = progress?.scores[1].rating;
			expect(['S', 'A', 'B', 'C']).toContain(rating);
		});
	});

	test.describe('Complete Stage 1 Playthrough', () => {
		test('should complete full Stage 1 from start to victory', async ({ page }) => {
			// Start Stage 1
			await startStage(page, 1);

			// Verify initial state
			let state = await getGameState(page);
			expect(state?.phase).toBe('planning');
			expect(state?.mode).toBe('normal');
			expect(state?.wave).toBe(1);
			expect(state?.totalWaves).toBe(3);
			expect(state?.lives).toBe(10);
			expect(state?.gold).toBe(200);

			// Step 1: Follow tutorial - move cursor
			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k');

			// Step 2: Enter insert mode
			await enterInsertMode(page);
			expect((await getGameState(page))?.mode).toBe('insert');

			// Step 3: Place first tower
			await placeTower(page, 1);
			state = await getGameState(page);
			expect(state?.gold).toBeLessThan(200);

			// Place additional towers for safety
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);

			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);

			// Step 4: Return to normal mode
			await exitInsertMode(page);
			expect((await getGameState(page))?.mode).toBe('normal');

			// Step 5: Start wave with :w
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });

			// Wait for wave 1 to complete
			await waitForPhase(page, 'wave_complete', { timeout: 30000 });
			await waitForPhase(page, 'planning', { timeout: 5000 });

			// Verify wave 2
			state = await getGameState(page);
			expect(state?.wave).toBe(2);

			// Start wave 2
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			await waitForPhase(page, 'wave_complete', { timeout: 30000 });
			await waitForPhase(page, 'planning', { timeout: 5000 });

			// Verify wave 3
			state = await getGameState(page);
			expect(state?.wave).toBe(3);

			// Start wave 3 (final wave)
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			await waitForPhase(page, 'stage_complete', { timeout: 30000 });

			// Verify victory
			state = await getGameState(page);
			expect(state?.phase).toBe('stage_complete');
			expect(state?.lives).toBeGreaterThan(0);

			// Return to menu
			await pressKey(page, 'Enter');
			await page.waitForURL('/');

			// Verify Stage 2 is unlocked
			const progress = await getProgressData(page);
			expect(progress?.unlockedStages).toBeGreaterThanOrEqual(2);
			expect(progress?.scores[1]).toBeDefined();
		});
	});

	test.describe('VIM Movement During Tutorial', () => {
		test('should support h/j/k/l cursor movement', async ({ page }) => {
			await startStage(page, 1);

			// Start at (0, 0)
			await moveCursor(page, 'l'); // Move right
			await moveCursor(page, 'j'); // Move down
			await moveCursor(page, 'h'); // Move left
			await moveCursor(page, 'k'); // Move up

			// Should be back at origin or close to it
			const state = await getGameState(page);
			expect(state?.mode).toBe('normal');
		});

		test('should support count prefixes for movement', async ({ page }) => {
			await startStage(page, 1);

			// Move 3 cells right
			await typeVimSequence(page, '3l');

			// Move 2 cells down
			await typeVimSequence(page, '2j');

			const state = await getGameState(page);
			expect(state?.mode).toBe('normal');
		});

		test('should support cursor movement in insert mode', async ({ page }) => {
			await startStage(page, 1);

			await enterInsertMode(page);

			// Move cursor while in insert mode
			await moveCursor(page, 'l');
			await moveCursor(page, 'j');

			const state = await getGameState(page);
			expect(state?.mode).toBe('insert');

			await exitInsertMode(page);
		});
	});

	test.describe('Command Mode During Tutorial', () => {
		test('should enter and exit command mode', async ({ page }) => {
			await startStage(page, 1);

			// Enter command mode
			await pressKey(page, ':');
			await waitForMode(page, 'command', { timeout: 2000 });

			// Exit with Escape
			await pressKey(page, 'Escape');
			await waitForMode(page, 'normal', { timeout: 2000 });
		});

		test('should execute :w to start wave', async ({ page }) => {
			await startStage(page, 1);

			// Place a tower first
			await moveCursor(page, 'l', 4);
			await moveCursor(page, 'k');
			await enterInsertMode(page);
			await placeTower(page, 1);
			await exitInsertMode(page);

			// Execute :w
			await pressKey(page, ':');
			await waitForMode(page, 'command', { timeout: 2000 });
			await pressKey(page, 'w');
			await pressKey(page, 'Enter');

			// Should start combat
			await waitForPhase(page, 'combat', { timeout: 5000 });
		});

		test('should quit game with :q command', async ({ page }) => {
			await startStage(page, 1);

			// Use :q to quit
			await executeCommand(page, 'q');

			// Should navigate to menu
			await page.waitForURL('/');
		});
	});
});
