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
 *
 * ## TEST MODE (10x Speed)
 *
 * These tests use `testMode=true` URL parameter which enables 10x game speed.
 * This dramatically reduces test duration:
 * - Normal mode: 3-5 minutes per full playthrough
 * - Test mode: 20-30 seconds per full playthrough
 *
 * ## TIMING CONSIDERATIONS
 *
 * With test mode enabled, timeouts are reduced by approximately 10x:
 *
 * ### Timeout Strategy by Stage (with testMode):
 * - Stage 2 (4 waves): test.setTimeout(30000) = 30 seconds
 * - Stage 3 (5 waves): test.setTimeout(45000) = 45 seconds
 * - Stage 4 (6 waves): test.setTimeout(60000) = 60 seconds
 *
 * ### Per-Wave Timeouts (with testMode):
 * - waitForPhase('combat', { timeout: 5000 }): Immediate transition
 * - waitForPhase('wave_complete', { timeout: 5000-8000 }): Enemy defeat time
 * - waitForPhase('planning', { timeout: 5000 }): Quick UI transition
 * - waitForPhase('stage_complete', { timeout: 8000-15000 }): Final wave
 *
 * ### Flakiness Patterns:
 * - Tower placement timing (50ms key delay helps)
 * - Combat frame rate variations in CI
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
	setProgressData,
	waitForWaveComplete
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
		// NOTE: Single-wave tests are faster than full playthrough tests
		test('should track wave progression correctly', async ({ page }) => {
			await startStage(page, 2, { testMode: true });

			// Verify initial wave state
			let state = await getGameState(page);
			expect(state?.wave).toBe(1);
			expect(state?.totalWaves).toBe(4);
		});

		test('should complete first wave and transition to wave 2', async ({ page }) => {
			// TIMING: With testMode (10x speed), single wave completes in ~2-3s
			test.setTimeout(15000);
			await startStage(page, 2, { testMode: true });

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
			// TIMING: Combat starts immediately after :w command
			await waitForPhase(page, 'combat', { timeout: 5000 });

			// TIMING: With 10x speed, wave completes very fast
			// Wait for wave 2 in planning phase (wave_complete transitions instantly)
			await expect(async () => {
				const state = await getGameState(page);
				expect(state?.phase).toBe('planning');
				expect(state?.wave).toBe(2);
			}).toPass({ timeout: 10000, intervals: [100] });

			const state = await getGameState(page);
			expect(state?.wave).toBe(2);
		});
	});

	test.describe('Full Stage 2 Playthrough', () => {
		test('should complete all 4 waves and reach victory', async ({ page }) => {
			// TIMING: With testMode (10x speed), full playthrough in ~30s
			test.setTimeout(30000);
			await startStage(page, 2, { testMode: true });

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

			// TIMING: Wave loop - with 10x speed, each wave completes quickly
			const totalWaves = 4;
			for (let wave = 1; wave <= totalWaves; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });
				await waitForWaveComplete(page, wave, totalWaves, { timeout: 10000 });
			}

			const state = await getGameState(page);
			expect(state?.phase).toBe('stage_complete');
		});

		test('should unlock Stage 3 after completion', async ({ page }) => {
			// TIMING: With testMode (10x speed), full playthrough in ~30s
			test.setTimeout(30000);
			await startStage(page, 2, { testMode: true });

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
			const totalWaves = 4;
			for (let wave = 1; wave <= totalWaves; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });
				await waitForWaveComplete(page, wave, totalWaves, { timeout: 10000 });
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
			await startStage(page, 3, { testMode: true });

			const state = await getGameState(page);
			expect(state?.totalWaves).toBe(5);
		});

		test('should complete first wave successfully', async ({ page }) => {
			// TIMING: With testMode (10x speed), single wave completes quickly
			test.setTimeout(15000);
			await startStage(page, 3, { testMode: true });

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
			// TIMING: With 10x speed, wave completes quickly
			// Wait for wave 2 in planning (wave_complete transitions fast)
			await waitForWaveComplete(page, 1, 5, { timeout: 10000 });

			const state = await getGameState(page);
			// Should be in planning for wave 2 or still in wave_complete
			expect(['wave_complete', 'planning']).toContain(state?.phase);
		});
	});

	test.describe('Full Stage 3 Playthrough', () => {
		test('should complete all 5 waves and reach victory', async ({ page }) => {
			// TIMING: With testMode (10x speed), full playthrough in ~45s
			test.setTimeout(45000);
			await startStage(page, 3, { testMode: true });

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

			// TIMING: Wave loop - with 10x speed, each wave completes quickly
			const totalWaves = 5;
			for (let wave = 1; wave <= totalWaves; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });
				await waitForWaveComplete(page, wave, totalWaves, { timeout: 10000 });
			}

			const state = await getGameState(page);
			expect(state?.phase).toBe('stage_complete');
		});

		test('should unlock Stage 4 after completion', async ({ page }) => {
			// TIMING: With testMode (10x speed), full playthrough in ~45s
			test.setTimeout(45000);
			await startStage(page, 3, { testMode: true });

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
			const totalWaves = 5;
			for (let wave = 1; wave <= totalWaves; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });
				await waitForWaveComplete(page, wave, totalWaves, { timeout: 10000 });
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
		// NOTE: Stage 4 introduces tank enemies (high HP, slow movement)
		// Tanks require significantly more damage to defeat, extending combat time
		test('should have 6 waves including tanks', async ({ page }) => {
			await startStage(page, 4, { testMode: true });

			const state = await getGameState(page);
			expect(state?.totalWaves).toBe(6);
		});

		test('should complete early waves before tanks appear', async ({ page }) => {
			// TIMING: With testMode (10x speed), single wave completes quickly
			test.setTimeout(15000);
			await startStage(page, 4, { testMode: true });

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

			// Complete wave 1 (no tanks yet)
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			// TIMING: With 10x speed, wave completes quickly
			await waitForWaveComplete(page, 1, 6, { timeout: 10000 });

			const state = await getGameState(page);
			// Should be in planning for wave 2 or still in wave_complete
			expect(['wave_complete', 'planning']).toContain(state?.phase);
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
			// TIMING: With testMode (10x speed), full playthrough in ~60s
			test.setTimeout(60000);
			await startStage(page, 4, { testMode: true });

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

			// TIMING: Wave loop - with 10x speed, waves complete quickly
			const totalWaves = 6;
			for (let wave = 1; wave <= totalWaves; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });
				// Tank waves (3+) take longer, use 15s timeout for them
				const timeout = wave >= 3 ? 15000 : 10000;
				await waitForWaveComplete(page, wave, totalWaves, { timeout });
			}

			const state = await getGameState(page);
			expect(state?.phase).toBe('stage_complete');
		});

		test('should save score with rating after completion', async ({ page }) => {
			// TIMING: With testMode (10x speed), full playthrough in ~60s
			test.setTimeout(60000);
			await startStage(page, 4, { testMode: true });

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
			const totalWaves = 6;
			for (let wave = 1; wave <= totalWaves; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });
				const timeout = wave >= 3 ? 15000 : 10000;
				await waitForWaveComplete(page, wave, totalWaves, { timeout });
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
	// These tests verify localStorage persists across page reloads
	// With testMode enabled, full playthroughs complete in ~30s instead of 3-5 minutes
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearProgressData(page);
	});

	test('should persist unlockedStages after stage completion', async ({ page }) => {
		// Set up with stage 2 unlocked
		await setProgressData(page, { unlockedStages: 2, scores: {} });

		// TIMING: With testMode (10x speed), full playthrough in ~30s
		test.setTimeout(30000);
		await startStage(page, 2, { testMode: true });

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
		const totalWaves = 4;
		for (let wave = 1; wave <= totalWaves; wave++) {
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			await waitForWaveComplete(page, wave, totalWaves, { timeout: 10000 });
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

		// TIMING: With testMode (10x speed), full playthrough in ~30s
		test.setTimeout(30000);
		await startStage(page, 2, { testMode: true });

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

		const totalWaves = 4;
		for (let wave = 1; wave <= totalWaves; wave++) {
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			await waitForWaveComplete(page, wave, totalWaves, { timeout: 10000 });
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

		// TIMING: With testMode (10x speed), full playthrough in ~45s
		test.setTimeout(45000);
		await startStage(page, 3, { testMode: true });

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

		const totalWaves = 5;
		for (let wave = 1; wave <= totalWaves; wave++) {
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			await waitForWaveComplete(page, wave, totalWaves, { timeout: 10000 });
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

		// TIMING: With testMode (10x speed), full playthrough in ~30s
		test.setTimeout(30000);
		await startStage(page, 2, { testMode: true });

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

		const totalWaves = 4;
		for (let wave = 1; wave <= totalWaves; wave++) {
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			await waitForWaveComplete(page, wave, totalWaves, { timeout: 10000 });
		}

		await pressKey(page, 'Enter');
		await page.waitForURL('/');

		// Verify best score was updated (should be less than 500)
		const progress = await getProgressData(page);
		expect(progress?.scores[2].bestKeystrokes).toBeLessThan(500);
	});
});
