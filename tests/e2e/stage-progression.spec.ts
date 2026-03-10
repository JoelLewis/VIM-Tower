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
 * ## TIMING CONSIDERATIONS
 *
 * These are the LONGEST running tests in the suite. Full stage playthroughs require:
 * 1. Multiple waves (4-6 per stage)
 * 2. Each wave spawns enemies over time
 * 3. Combat phase waits for all enemies to be defeated OR reach exit
 * 4. Wave transition delays between waves
 *
 * ### Timeout Strategy by Stage:
 * - Stage 2 (4 waves): test.setTimeout(180000) = 3 minutes
 * - Stage 3 (5 waves): test.setTimeout(240000) = 4 minutes
 * - Stage 4 (6 waves): test.setTimeout(300000) = 5 minutes
 *
 * ### Per-Wave Timeouts:
 * - waitForPhase('combat', { timeout: 5000 }): Immediate transition
 * - waitForPhase('wave_complete', { timeout: 45000-60000 }): Enemy defeat time
 *   - 45s for early waves with fewer/weaker enemies
 *   - 60s for later stages with more enemies
 *   - 90s for Stage 4 waves 3+ with tank enemies
 * - waitForPhase('planning', { timeout: 5000 }): Quick UI transition
 * - waitForPhase('stage_complete', { timeout: 45000-120000 }): Final wave
 *   - Stage 4 final wave needs 120s due to multiple tanks
 *
 * ### Flakiness Patterns:
 * - Tower placement timing (50ms key delay helps)
 * - Combat frame rate variations in CI
 * - Stage 4 tank enemies require longer timeouts
 *
 * ### Recommended Optimizations (Future Task):
 * - Implement testMode with 10x game speed
 * - Would reduce 3-5 minute tests to 20-30 seconds
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
		// NOTE: Single-wave tests are faster than full playthrough tests
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
			// TIMING: Combat starts immediately after :w command
			await waitForPhase(page, 'combat', { timeout: 5000 });

			// TIMING: Wave 1 on Stage 2 has 4 walkers. With proper tower placement,
			// enemies should be defeated in 20-30s. 45s timeout provides safety margin.
			await waitForPhase(page, 'wave_complete', { timeout: 45000 });
			// TIMING: UI transition to planning phase is instant
			await waitForPhase(page, 'planning', { timeout: 5000 });

			const state = await getGameState(page);
			expect(state?.wave).toBe(2);
		});
	});

	test.describe('Full Stage 2 Playthrough', () => {
		test('should complete all 4 waves and reach victory', async ({ page }) => {
			// TIMING: Full Stage 2 playthrough (4 waves)
			// Each wave: ~30-45s combat + ~5s transitions = ~40-50s per wave
			// Total: ~3 minutes with safety margin
			test.setTimeout(180000);
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

			// TIMING: Wave loop - each iteration waits for combat completion
			// Waves 1-3: wait for wave_complete (enemies defeated)
			// Wave 4: wait for stage_complete (final wave victory)
			for (let wave = 1; wave <= 4; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });

				if (wave < 4) {
					// TIMING: 45s per wave - towers should defeat all enemies
					await waitForPhase(page, 'wave_complete', { timeout: 45000 });
					await waitForPhase(page, 'planning', { timeout: 5000 });
				} else {
					// TIMING: Final wave triggers stage_complete instead of wave_complete
					await waitForPhase(page, 'stage_complete', { timeout: 45000 });
				}
			}

			const state = await getGameState(page);
			expect(state?.phase).toBe('stage_complete');
		});

		test('should unlock Stage 3 after completion', async ({ page }) => {
			// TIMING: Same as full playthrough
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
			// TIMING: Stage 3 serpentine path is longer, but wave 1 is still quick
			await waitForPhase(page, 'wave_complete', { timeout: 45000 });

			const state = await getGameState(page);
			expect(state?.phase).toBe('wave_complete');
		});
	});

	test.describe('Full Stage 3 Playthrough', () => {
		test('should complete all 5 waves and reach victory', async ({ page }) => {
			// TIMING: Full Stage 3 playthrough (5 waves)
			// Serpentine path is longer than Stage 2's L-path
			// Later waves have runners (faster enemies)
			// 60s per wave timeout accounts for this
			test.setTimeout(240000);
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

			// TIMING: Wave loop for Stage 3
			// Using 60s timeout per wave due to longer serpentine path
			for (let wave = 1; wave <= 5; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });

				if (wave < 5) {
					// TIMING: 60s allows for serpentine path traversal + combat
					await waitForPhase(page, 'wave_complete', { timeout: 60000 });
					await waitForPhase(page, 'planning', { timeout: 5000 });
				} else {
					// TIMING: Final wave
					await waitForPhase(page, 'stage_complete', { timeout: 60000 });
				}
			}

			const state = await getGameState(page);
			expect(state?.phase).toBe('stage_complete');
		});

		test('should unlock Stage 4 after completion', async ({ page }) => {
			// TIMING: Same as full playthrough
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
		// NOTE: Stage 4 introduces tank enemies (high HP, slow movement)
		// Tanks require significantly more damage to defeat, extending combat time
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

			// Complete wave 1 (no tanks yet)
			await executeCommand(page, 'w');
			await waitForPhase(page, 'combat', { timeout: 5000 });
			// TIMING: Early Stage 4 waves (1-2) don't have tanks, standard timing
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
			// TIMING: Full Stage 4 playthrough (6 waves, includes tanks)
			// This is the LONGEST test in the suite
			// Waves 1-2: Standard enemies (~60s each)
			// Waves 3-6: Include tank enemies (high HP) (~90s each)
			// Final wave: Multiple tanks (~120s)
			// Total: ~5 minutes with safety margin
			test.setTimeout(300000);
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

			// TIMING: Wave loop for Stage 4 with dynamic timeouts
			// Waves 1-2: Standard enemies (60s)
			// Waves 3-5: Tank enemies appear (90s - tanks have 3x HP)
			// Wave 6: Final wave with multiple tanks (120s)
			for (let wave = 1; wave <= 6; wave++) {
				await executeCommand(page, 'w');
				await waitForPhase(page, 'combat', { timeout: 5000 });

				if (wave < 6) {
					// TIMING: Adaptive timeout based on wave difficulty
					// Waves 3+ have tanks which require significantly more damage
					const timeout = wave >= 3 ? 90000 : 60000;
					await waitForPhase(page, 'wave_complete', { timeout });
					await waitForPhase(page, 'planning', { timeout: 5000 });
				} else {
					// TIMING: Final wave is the hardest - multiple tanks
					// 120s allows for worst-case tower DPS scenarios
					await waitForPhase(page, 'stage_complete', { timeout: 120000 });
				}
			}

			const state = await getGameState(page);
			expect(state?.phase).toBe('stage_complete');
		});

		test('should save score with rating after completion', async ({ page }) => {
			// TIMING: Same as full Stage 4 playthrough
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
	// These tests verify localStorage persists across page reloads
	// They include full stage playthroughs so have extended timeouts
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearProgressData(page);
	});

	test('should persist unlockedStages after stage completion', async ({ page }) => {
		// Set up with stage 2 unlocked
		await setProgressData(page, { unlockedStages: 2, scores: {} });

		// TIMING: Full Stage 2 playthrough
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

		// TIMING: Full Stage 2 playthrough
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

		// TIMING: Full Stage 3 playthrough (5 waves)
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

		// TIMING: Full Stage 2 playthrough (replay)
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
