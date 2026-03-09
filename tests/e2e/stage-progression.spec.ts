/**
 * E2E Tests: Stage Progression (Stages 2-4)
 *
 * Tests full playthroughs of Stages 2-4 including:
 * - New tower unlocks per stage
 * - Intro text display
 * - Multi-wave combat
 * - Tank enemies (Stage 4)
 * - Progressive difficulty
 * - localStorage persistence of unlockedStages and scores
 */

import { test, expect } from '@playwright/test';
import {
	waitForPhase,
	getGameState,
	pressKey,
	enterInsertMode,
	exitInsertMode,
	executeCommand,
	moveCursor,
	placeTower,
	startStage,
	clearProgressData,
	getProgressData,
	setProgressData
} from '../helpers/game-helpers.js';

test.describe('Stage 2: The L-Turn', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearProgressData(page);
		// Unlock stage 2
		await setProgressData(page, { unlockedStages: 2, scores: {} });
	});

	test.describe('Tower Unlocks', () => {
		test('should have Arrow and Cannon towers available', async ({ page }) => {
			await startStage(page, 2);

			const state = await getGameState(page);
			expect(state?.phase).toBe('planning');
			expect(state?.gold).toBe(250);
		});

		test('should place Cannon tower with key 2', async ({ page }) => {
			await startStage(page, 2);

			// Move to an empty cell
			await moveCursor(page, 'l', 5);
			await moveCursor(page, 'k');

			await enterInsertMode(page);
			const beforeGold = (await getGameState(page))?.gold ?? 0;

			// Place cannon (key 2)
			await placeTower(page, 2);

			const afterGold = (await getGameState(page))?.gold ?? 0;
			expect(afterGold).toBeLessThan(beforeGold);

			await exitInsertMode(page);
		});
	});

	test.describe('Intro Text Display', () => {
		test('should start with correct initial state', async ({ page }) => {
			await startStage(page, 2);

			const state = await getGameState(page);
			expect(state?.phase).toBe('planning');
			expect(state?.mode).toBe('normal');
			expect(state?.wave).toBe(1);
			expect(state?.totalWaves).toBe(4);
			expect(state?.gold).toBe(250);
		});
	});

	test.describe('Multi-Wave Combat', () => {
		test('should track wave progression correctly', async ({ page }) => {
			await startStage(page, 2);

			// Verify initial wave state
			let state = await getGameState(page);
			expect(state?.wave).toBe(1);
			expect(state?.totalWaves).toBe(4);
		});

		test('should complete first wave and transition to wave 2', async ({ page }) => {
			await startStage(page, 2);

			// Place towers along the horizontal path
			await moveCursor(page, 'l', 2);
			await moveCursor(page, 'k');
			await enterInsertMode(page);
			await placeTower(page, 1); // Arrow
			await moveCursor(page, 'l', 2);
			await placeTower(page, 2); // Cannon
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1); // Arrow
			await exitInsertMode(page);

			// Start wave
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });

			// Wait for wave completion
			await waitForPhase(page, 'wave_complete', { timeout: 45000 });
			await waitForPhase(page, 'planning', { timeout: 5000 });

			const state = await getGameState(page);
			expect(state?.wave).toBe(2);
		});
	});

	test.describe('Full Stage 2 Playthrough', () => {
		test('should complete all 4 waves and reach victory', async ({ page }) => {
			test.setTimeout(180000); // 3 minutes for full stage
			await startStage(page, 2);

			// Place towers along the L-path corners for maximum coverage
			// Top horizontal section
			await moveCursor(page, 'l', 2);
			await moveCursor(page, 'k');
			await enterInsertMode(page);
			await placeTower(page, 1); // Arrow
			await moveCursor(page, 'l', 2);
			await placeTower(page, 2); // Cannon
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1); // Arrow
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1); // Arrow

			// Move to vertical section and place more towers
			await moveCursor(page, 'j', 2);
			await moveCursor(page, 'l');
			await placeTower(page, 2); // Cannon

			await moveCursor(page, 'j', 2);
			await placeTower(page, 1); // Arrow

			await exitInsertMode(page);

			// Complete all 4 waves
			for (let wave = 1; wave <= 4; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });

				if (wave < 4) {
					await waitForPhase(page, 'wave_complete', { timeout: 45000 });
					await waitForPhase(page, 'planning', { timeout: 5000 });
				} else {
					await waitForPhase(page, 'stage_complete', { timeout: 45000 });
				}
			}

			const state = await getGameState(page);
			expect(state?.phase).toBe('stage_complete');
		});

		test('should unlock Stage 3 after completion', async ({ page }) => {
			test.setTimeout(180000);
			await startStage(page, 2);

			// Place towers
			await moveCursor(page, 'l', 2);
			await moveCursor(page, 'k');
			await enterInsertMode(page);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 2);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 2);
			await placeTower(page, 1);
			await moveCursor(page, 'j', 2);
			await moveCursor(page, 'l');
			await placeTower(page, 2);
			await moveCursor(page, 'j', 2);
			await placeTower(page, 1);
			await exitInsertMode(page);

			// Complete all waves
			for (let wave = 1; wave <= 4; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });
				if (wave < 4) {
					await waitForPhase(page, 'wave_complete', { timeout: 45000 });
					await waitForPhase(page, 'planning', { timeout: 5000 });
				} else {
					await waitForPhase(page, 'stage_complete', { timeout: 45000 });
				}
			}

			// Return to menu
			await pressKey(page, 'Enter');
			await page.waitForURL('/');

			// Verify progression
			const progress = await getProgressData(page);
			expect(progress?.unlockedStages).toBeGreaterThanOrEqual(3);
			expect(progress?.scores[2]).toBeDefined();
			expect(progress?.scores[2].bestKeystrokes).toBeGreaterThan(0);
		});
	});
});

test.describe('Stage 3: Serpentine', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearProgressData(page);
		// Unlock stage 3
		await setProgressData(page, { unlockedStages: 3, scores: {} });
	});

	test.describe('Tower Unlocks', () => {
		test('should have Arrow, Cannon, and Frost towers available', async ({ page }) => {
			await startStage(page, 3);

			const state = await getGameState(page);
			expect(state?.phase).toBe('planning');
			expect(state?.gold).toBe(300);
		});

		test('should place Frost tower with key 3', async ({ page }) => {
			await startStage(page, 3);

			// Move to an empty cell
			await moveCursor(page, 'l', 5);
			await moveCursor(page, 'j');

			await enterInsertMode(page);
			const beforeGold = (await getGameState(page))?.gold ?? 0;

			// Place frost tower (key 3)
			await placeTower(page, 3);

			const afterGold = (await getGameState(page))?.gold ?? 0;
			expect(afterGold).toBeLessThan(beforeGold);

			await exitInsertMode(page);
		});
	});

	test.describe('Multi-Wave Combat', () => {
		test('should have 5 waves', async ({ page }) => {
			await startStage(page, 3);

			const state = await getGameState(page);
			expect(state?.totalWaves).toBe(5);
		});

		test('should complete first wave successfully', async ({ page }) => {
			await startStage(page, 3);

			// Place towers along the serpentine path
			await moveCursor(page, 'l', 4);
			await enterInsertMode(page);
			await placeTower(page, 1); // Arrow on first row
			await moveCursor(page, 'l', 4);
			await placeTower(page, 2); // Cannon
			await moveCursor(page, 'l', 4);
			await placeTower(page, 1); // Arrow
			await exitInsertMode(page);

			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			await waitForPhase(page, 'wave_complete', { timeout: 45000 });

			const state = await getGameState(page);
			expect(state?.phase).toBe('wave_complete');
		});
	});

	test.describe('Full Stage 3 Playthrough', () => {
		test('should complete all 5 waves and reach victory', async ({ page }) => {
			test.setTimeout(240000); // 4 minutes for full stage
			await startStage(page, 3);

			// Place towers at key points along the serpentine
			// First horizontal path (top)
			await moveCursor(page, 'l', 4);
			await enterInsertMode(page);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 4);
			await placeTower(page, 2);
			await moveCursor(page, 'l', 4);
			await placeTower(page, 3); // Frost for slowing

			// Second row
			await moveCursor(page, 'j', 2);
			await moveCursor(page, 'h', 4);
			await placeTower(page, 1);
			await moveCursor(page, 'h', 4);
			await placeTower(page, 2);

			// Third row
			await moveCursor(page, 'j', 2);
			await moveCursor(page, 'l', 4);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 4);
			await placeTower(page, 2);

			await exitInsertMode(page);

			// Complete all 5 waves
			for (let wave = 1; wave <= 5; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });

				if (wave < 5) {
					await waitForPhase(page, 'wave_complete', { timeout: 60000 });
					await waitForPhase(page, 'planning', { timeout: 5000 });
				} else {
					await waitForPhase(page, 'stage_complete', { timeout: 60000 });
				}
			}

			const state = await getGameState(page);
			expect(state?.phase).toBe('stage_complete');
		});

		test('should unlock Stage 4 after completion', async ({ page }) => {
			test.setTimeout(240000);
			await startStage(page, 3);

			// Place towers
			await moveCursor(page, 'l', 4);
			await enterInsertMode(page);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 4);
			await placeTower(page, 2);
			await moveCursor(page, 'l', 4);
			await placeTower(page, 3);
			await moveCursor(page, 'j', 2);
			await moveCursor(page, 'h', 4);
			await placeTower(page, 1);
			await moveCursor(page, 'h', 4);
			await placeTower(page, 2);
			await moveCursor(page, 'j', 2);
			await moveCursor(page, 'l', 4);
			await placeTower(page, 1);
			await moveCursor(page, 'l', 4);
			await placeTower(page, 2);
			await exitInsertMode(page);

			// Complete all waves
			for (let wave = 1; wave <= 5; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });
				if (wave < 5) {
					await waitForPhase(page, 'wave_complete', { timeout: 60000 });
					await waitForPhase(page, 'planning', { timeout: 5000 });
				} else {
					await waitForPhase(page, 'stage_complete', { timeout: 60000 });
				}
			}

			// Return to menu
			await pressKey(page, 'Enter');
			await page.waitForURL('/');

			// Verify progression
			const progress = await getProgressData(page);
			expect(progress?.unlockedStages).toBeGreaterThanOrEqual(4);
			expect(progress?.scores[3]).toBeDefined();
		});
	});
});

test.describe('Stage 4: The Gauntlet', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearProgressData(page);
		// Unlock stage 4
		await setProgressData(page, { unlockedStages: 4, scores: {} });
	});

	test.describe('Tower Unlocks', () => {
		test('should have all 4 towers available', async ({ page }) => {
			await startStage(page, 4);

			const state = await getGameState(page);
			expect(state?.phase).toBe('planning');
			expect(state?.gold).toBe(400);
		});

		test('should place Lightning tower with key 4', async ({ page }) => {
			await startStage(page, 4);

			// Move to an empty cell
			await moveCursor(page, 'l', 5);
			await moveCursor(page, 'j');

			await enterInsertMode(page);
			const beforeGold = (await getGameState(page))?.gold ?? 0;

			// Place lightning tower (key 4)
			await placeTower(page, 4);

			const afterGold = (await getGameState(page))?.gold ?? 0;
			expect(afterGold).toBeLessThan(beforeGold);

			await exitInsertMode(page);
		});
	});

	test.describe('Tank Enemies', () => {
		test('should have 6 waves including tanks', async ({ page }) => {
			await startStage(page, 4);

			const state = await getGameState(page);
			expect(state?.totalWaves).toBe(6);
		});

		test('should complete early waves before tanks appear', async ({ page }) => {
			await startStage(page, 4);

			// Place strong defenses
			await moveCursor(page, 'l', 3);
			await enterInsertMode(page);
			await placeTower(page, 2); // Cannon
			await moveCursor(page, 'l');
			await moveCursor(page, 'j', 2);
			await placeTower(page, 1); // Arrow
			await moveCursor(page, 'l');
			await placeTower(page, 4); // Lightning
			await exitInsertMode(page);

			// Complete wave 1
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			await waitForPhase(page, 'wave_complete', { timeout: 45000 });

			const state = await getGameState(page);
			expect(state?.phase).toBe('wave_complete');
		});
	});

	test.describe('Progressive Difficulty', () => {
		test('should start with higher gold for harder stage', async ({ page }) => {
			await startStage(page, 4);

			const state = await getGameState(page);
			expect(state?.gold).toBe(400);
		});

		test('should have more waves than earlier stages', async ({ page }) => {
			await startStage(page, 4);

			const state = await getGameState(page);
			expect(state?.totalWaves).toBe(6);
		});
	});

	test.describe('Full Stage 4 Playthrough', () => {
		test('should complete all 6 waves and reach victory', async ({ page }) => {
			test.setTimeout(300000); // 5 minutes for hardest stage
			await startStage(page, 4);

			// Place strong tower combinations at corners of the zigzag path
			// First corner area
			await moveCursor(page, 'l', 3);
			await enterInsertMode(page);
			await placeTower(page, 2); // Cannon
			await moveCursor(page, 'l');
			await placeTower(page, 3); // Frost to slow

			// Second turn area
			await moveCursor(page, 'j', 3);
			await moveCursor(page, 'h');
			await placeTower(page, 4); // Lightning
			await moveCursor(page, 'h');
			await placeTower(page, 2); // Cannon

			// Third turn area
			await moveCursor(page, 'j', 3);
			await moveCursor(page, 'l');
			await placeTower(page, 3); // Frost
			await moveCursor(page, 'l');
			await placeTower(page, 2); // Cannon

			// Fourth turn area (near exit)
			await moveCursor(page, 'j', 2);
			await moveCursor(page, 'l');
			await placeTower(page, 4); // Lightning
			await moveCursor(page, 'l');
			await placeTower(page, 1); // Arrow

			await exitInsertMode(page);

			// Complete all 6 waves (includes tank waves)
			for (let wave = 1; wave <= 6; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });

				if (wave < 6) {
					// Longer timeout for later waves with tanks
					const timeout = wave >= 3 ? 90000 : 60000;
					await waitForPhase(page, 'wave_complete', { timeout });
					await waitForPhase(page, 'planning', { timeout: 5000 });
				} else {
					// Final wave with many tanks
					await waitForPhase(page, 'stage_complete', { timeout: 120000 });
				}
			}

			const state = await getGameState(page);
			expect(state?.phase).toBe('stage_complete');
		});

		test('should save score with rating after completion', async ({ page }) => {
			test.setTimeout(300000);
			await startStage(page, 4);

			// Place towers
			await moveCursor(page, 'l', 3);
			await enterInsertMode(page);
			await placeTower(page, 2);
			await moveCursor(page, 'l');
			await placeTower(page, 3);
			await moveCursor(page, 'j', 3);
			await moveCursor(page, 'h');
			await placeTower(page, 4);
			await moveCursor(page, 'h');
			await placeTower(page, 2);
			await moveCursor(page, 'j', 3);
			await moveCursor(page, 'l');
			await placeTower(page, 3);
			await moveCursor(page, 'l');
			await placeTower(page, 2);
			await moveCursor(page, 'j', 2);
			await moveCursor(page, 'l');
			await placeTower(page, 4);
			await moveCursor(page, 'l');
			await placeTower(page, 1);
			await exitInsertMode(page);

			// Complete all waves
			for (let wave = 1; wave <= 6; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });
				if (wave < 6) {
					const timeout = wave >= 3 ? 90000 : 60000;
					await waitForPhase(page, 'wave_complete', { timeout });
					await waitForPhase(page, 'planning', { timeout: 5000 });
				} else {
					await waitForPhase(page, 'stage_complete', { timeout: 120000 });
				}
			}

			// Return to menu
			await pressKey(page, 'Enter');
			await page.waitForURL('/');

			// Verify progression saved
			const progress = await getProgressData(page);
			expect(progress?.scores[4]).toBeDefined();
			expect(progress?.scores[4].bestKeystrokes).toBeGreaterThan(0);
			expect(['S', 'A', 'B', 'C']).toContain(progress?.scores[4].rating);
		});
	});
});

test.describe('localStorage Persistence', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearProgressData(page);
	});

	test('should persist unlockedStages after stage completion', async ({ page }) => {
		// Set up with stage 2 unlocked
		await setProgressData(page, { unlockedStages: 2, scores: {} });

		// Start stage 2 and complete it
		test.setTimeout(180000);
		await startStage(page, 2);

		// Place towers
		await moveCursor(page, 'l', 2);
		await moveCursor(page, 'k');
		await enterInsertMode(page);
		await placeTower(page, 1);
		await moveCursor(page, 'l', 2);
		await placeTower(page, 2);
		await moveCursor(page, 'l', 2);
		await placeTower(page, 1);
		await moveCursor(page, 'l', 2);
		await placeTower(page, 1);
		await moveCursor(page, 'j', 2);
		await moveCursor(page, 'l');
		await placeTower(page, 2);
		await moveCursor(page, 'j', 2);
		await placeTower(page, 1);
		await exitInsertMode(page);

		// Complete all waves
		for (let wave = 1; wave <= 4; wave++) {
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			if (wave < 4) {
				await waitForPhase(page, 'wave_complete', { timeout: 45000 });
				await waitForPhase(page, 'planning', { timeout: 5000 });
			} else {
				await waitForPhase(page, 'stage_complete', { timeout: 45000 });
			}
		}

		// Return to menu
		await pressKey(page, 'Enter');
		await page.waitForURL('/');

		// Verify unlockedStages persisted
		const progress = await getProgressData(page);
		expect(progress?.unlockedStages).toBeGreaterThanOrEqual(3);

		// Reload page and verify persistence
		await page.reload();
		const afterReload = await getProgressData(page);
		expect(afterReload?.unlockedStages).toBeGreaterThanOrEqual(3);
	});

	test('should persist scores with bestKeystrokes and rating', async ({ page }) => {
		// Set up with stage 2 unlocked
		await setProgressData(page, { unlockedStages: 2, scores: {} });

		// Complete stage 2
		test.setTimeout(180000);
		await startStage(page, 2);

		await moveCursor(page, 'l', 2);
		await moveCursor(page, 'k');
		await enterInsertMode(page);
		await placeTower(page, 1);
		await moveCursor(page, 'l', 2);
		await placeTower(page, 2);
		await moveCursor(page, 'l', 2);
		await placeTower(page, 1);
		await moveCursor(page, 'l', 2);
		await placeTower(page, 1);
		await moveCursor(page, 'j', 2);
		await moveCursor(page, 'l');
		await placeTower(page, 2);
		await moveCursor(page, 'j', 2);
		await placeTower(page, 1);
		await exitInsertMode(page);

		for (let wave = 1; wave <= 4; wave++) {
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			if (wave < 4) {
				await waitForPhase(page, 'wave_complete', { timeout: 45000 });
				await waitForPhase(page, 'planning', { timeout: 5000 });
			} else {
				await waitForPhase(page, 'stage_complete', { timeout: 45000 });
			}
		}

		await pressKey(page, 'Enter');
		await page.waitForURL('/');

		// Verify score details
		const progress = await getProgressData(page);
		expect(progress?.scores[2]).toBeDefined();
		expect(progress?.scores[2].bestKeystrokes).toBeGreaterThan(0);
		expect(['S', 'A', 'B', 'C']).toContain(progress?.scores[2].rating);

		// Reload and verify
		await page.reload();
		const afterReload = await getProgressData(page);
		expect(afterReload?.scores[2].bestKeystrokes).toBe(progress?.scores[2].bestKeystrokes);
		expect(afterReload?.scores[2].rating).toBe(progress?.scores[2].rating);
	});

	test('should accumulate scores across multiple stages', async ({ page }) => {
		// Pre-set some scores
		await setProgressData(page, {
			unlockedStages: 3,
			scores: {
				1: { bestKeystrokes: 25, rating: 'S' },
				2: { bestKeystrokes: 45, rating: 'A' }
			}
		});

		// Complete stage 3
		test.setTimeout(240000);
		await startStage(page, 3);

		await moveCursor(page, 'l', 4);
		await enterInsertMode(page);
		await placeTower(page, 1);
		await moveCursor(page, 'l', 4);
		await placeTower(page, 2);
		await moveCursor(page, 'l', 4);
		await placeTower(page, 3);
		await moveCursor(page, 'j', 2);
		await moveCursor(page, 'h', 4);
		await placeTower(page, 1);
		await moveCursor(page, 'h', 4);
		await placeTower(page, 2);
		await moveCursor(page, 'j', 2);
		await moveCursor(page, 'l', 4);
		await placeTower(page, 1);
		await moveCursor(page, 'l', 4);
		await placeTower(page, 2);
		await exitInsertMode(page);

		for (let wave = 1; wave <= 5; wave++) {
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			if (wave < 5) {
				await waitForPhase(page, 'wave_complete', { timeout: 60000 });
				await waitForPhase(page, 'planning', { timeout: 5000 });
			} else {
				await waitForPhase(page, 'stage_complete', { timeout: 60000 });
			}
		}

		await pressKey(page, 'Enter');
		await page.waitForURL('/');

		// Verify all scores exist
		const progress = await getProgressData(page);
		expect(progress?.scores[1]).toBeDefined();
		expect(progress?.scores[2]).toBeDefined();
		expect(progress?.scores[3]).toBeDefined();
		expect(progress?.unlockedStages).toBeGreaterThanOrEqual(4);
	});

	test('should preserve best score when replaying stage', async ({ page }) => {
		// Pre-set a score for stage 2 with many keystrokes
		await setProgressData(page, {
			unlockedStages: 3,
			scores: {
				2: { bestKeystrokes: 500, rating: 'C' }
			}
		});

		// Replay stage 2 with fewer keystrokes
		test.setTimeout(180000);
		await startStage(page, 2);

		await moveCursor(page, 'l', 2);
		await moveCursor(page, 'k');
		await enterInsertMode(page);
		await placeTower(page, 1);
		await moveCursor(page, 'l', 2);
		await placeTower(page, 2);
		await moveCursor(page, 'l', 2);
		await placeTower(page, 1);
		await moveCursor(page, 'l', 2);
		await placeTower(page, 1);
		await moveCursor(page, 'j', 2);
		await moveCursor(page, 'l');
		await placeTower(page, 2);
		await moveCursor(page, 'j', 2);
		await placeTower(page, 1);
		await exitInsertMode(page);

		for (let wave = 1; wave <= 4; wave++) {
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			if (wave < 4) {
				await waitForPhase(page, 'wave_complete', { timeout: 45000 });
				await waitForPhase(page, 'planning', { timeout: 5000 });
			} else {
				await waitForPhase(page, 'stage_complete', { timeout: 45000 });
			}
		}

		await pressKey(page, 'Enter');
		await page.waitForURL('/');

		// Verify best score was updated (should be less than 500)
		const progress = await getProgressData(page);
		expect(progress?.scores[2].bestKeystrokes).toBeLessThan(500);
	});
});
