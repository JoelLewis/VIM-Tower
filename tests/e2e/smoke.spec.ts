/**
 * E2E Smoke Tests
 *
 * Fast smoke tests verifying app loads, menu renders, Stage 1 starts,
 * basic keybinding works, and no console errors.
 *
 * These tests are designed to run quickly as a pre-commit check.
 *
 * ## TIMING CONSIDERATIONS
 *
 * Smoke tests are intentionally FAST and should complete in <30 seconds total.
 * They verify critical paths without running combat simulation.
 *
 * ### Timeout Strategy:
 * - waitForMenuReady(): Default 10s - app should load quickly
 * - waitForGameReady(): Default 10s - game init should be quick
 * - waitForMode(): 2000ms - mode transitions are instant
 *
 * ### Flakiness Prevention:
 * - Serial mode prevents parallel worker state interference
 * - No combat waits = no timing-dependent assertions
 * - Console error capture is passive (doesn't add latency)
 *
 * ### Pre-commit Suitability:
 * - Total runtime: <30s on typical hardware
 * - No extended timeouts or wave simulations
 * - Catches critical regressions without slowing dev workflow
 */

import { test, expect } from '@playwright/test';
import {
	waitForMenuReady,
	waitForGameReady,
	waitForMode,
	getMenuState,
	getGameState,
	pressKey,
	clearProgressData,
	setupConsoleErrorCapture
} from '../helpers/game-helpers.js';

// Tag all tests in this file as smoke tests
// Run serially to avoid flakiness from parallel workers sharing state
test.describe.configure({ mode: 'serial' });

test.describe('Smoke Tests @smoke', () => {
	test.describe('App Loading', () => {
		test('should load the app without errors', async ({ page }) => {
			const { errors } = setupConsoleErrorCapture(page);

			await page.goto('/');
			await waitForMenuReady(page);

			// No console errors should occur during initial load
			expect(errors).toHaveLength(0);
		});

		test('should have correct page title', async ({ page }) => {
			await page.goto('/');
			await expect(page).toHaveTitle(/VIM Tower/i);
		});

		test('should respond within acceptable time', async ({ page }) => {
			const startTime = Date.now();
			await page.goto('/');
			await waitForMenuReady(page);
			const loadTime = Date.now() - startTime;

			// App should load within 5 seconds
			expect(loadTime).toBeLessThan(5000);
		});
	});

	test.describe('Menu Rendering', () => {
		test('should render menu container', async ({ page }) => {
			await page.goto('/');
			await waitForMenuReady(page);

			const menuContainer = page.locator('[data-testid="menu-container"]');
			await expect(menuContainer).toBeVisible();
		});

		test('should render menu canvas', async ({ page }) => {
			await page.goto('/');
			await waitForMenuReady(page);

			const canvas = page.locator('[data-testid="menu-container"] canvas');
			await expect(canvas).toBeVisible();

			// Canvas should have proper dimensions
			const width = await canvas.getAttribute('width');
			const height = await canvas.getAttribute('height');
			expect(parseInt(width ?? '0', 10)).toBeGreaterThan(0);
			expect(parseInt(height ?? '0', 10)).toBeGreaterThan(0);
		});

		test('should have valid menu state', async ({ page }) => {
			await page.goto('/');
			await waitForMenuReady(page);

			const state = await getMenuState(page);
			expect(state).not.toBeNull();
			expect(state?.selectedIndex).toBeGreaterThanOrEqual(0);
			expect(state?.unlockedStages).toBeGreaterThanOrEqual(1);
		});
	});

	test.describe('Stage 1 Start', () => {
		test.beforeEach(async ({ page }) => {
			await page.goto('/');
			await clearProgressData(page);
			await page.reload();
			await waitForMenuReady(page);
		});

		test('should start Stage 1 when pressing Enter', async ({ page }) => {
			const { errors } = setupConsoleErrorCapture(page);

			await pressKey(page, 'Enter');

			await page.waitForURL(/\/play\?stage=1/);
			await waitForGameReady(page);

			// No console errors during navigation
			expect(errors).toHaveLength(0);
		});

		test('should render game container after starting', async ({ page }) => {
			await pressKey(page, 'Enter');
			await page.waitForURL(/\/play\?stage=1/);
			await waitForGameReady(page);

			const gameContainer = page.locator('[data-testid="game-container"]');
			await expect(gameContainer).toBeVisible();
		});

		test('should render game canvas', async ({ page }) => {
			await pressKey(page, 'Enter');
			await page.waitForURL(/\/play\?stage=1/);
			await waitForGameReady(page);

			const canvas = page.locator('[data-testid="game-container"] canvas');
			await expect(canvas).toBeVisible();
		});

		test('should have valid initial game state', async ({ page }) => {
			await pressKey(page, 'Enter');
			await page.waitForURL(/\/play\?stage=1/);
			await waitForGameReady(page);

			const state = await getGameState(page);
			expect(state).not.toBeNull();
			expect(state?.phase).toBe('planning');
			expect(state?.mode).toBe('normal');
			expect(state?.lives).toBeGreaterThan(0);
			expect(state?.gold).toBeGreaterThanOrEqual(0);
		});
	});

	test.describe('Basic Keybinding', () => {
		test.beforeEach(async ({ page }) => {
			await page.goto('/');
			await clearProgressData(page);
			await page.reload();
			await waitForMenuReady(page);

			// Start Stage 1
			await pressKey(page, 'Enter');
			await page.waitForURL(/\/play\?stage=1/);
			await waitForGameReady(page);
		});

		test('should respond to h/j/k/l movement keys', async ({ page }) => {
			// These keys should be processed without error
			const { errors } = setupConsoleErrorCapture(page);

			await pressKey(page, 'j'); // Move down
			await pressKey(page, 'k'); // Move up
			await pressKey(page, 'l'); // Move right
			await pressKey(page, 'h'); // Move left

			expect(errors).toHaveLength(0);
		});

		test('should enter insert mode with i key', async ({ page }) => {
			await pressKey(page, 'i');
			await waitForMode(page, 'insert', { timeout: 2000 });

			const state = await getGameState(page);
			expect(state?.mode).toBe('insert');
		});

		test('should exit insert mode with Escape', async ({ page }) => {
			// Enter insert mode
			await pressKey(page, 'i');
			await waitForMode(page, 'insert', { timeout: 2000 });

			// Exit insert mode
			await pressKey(page, 'Escape');
			await waitForMode(page, 'normal', { timeout: 2000 });

			const state = await getGameState(page);
			expect(state?.mode).toBe('normal');
		});

		test('should enter command mode with : key', async ({ page }) => {
			await pressKey(page, ':');
			await waitForMode(page, 'command', { timeout: 2000 });

			const state = await getGameState(page);
			expect(state?.mode).toBe('command');
		});

		test('should cancel command mode with Escape', async ({ page }) => {
			// Enter command mode
			await pressKey(page, ':');
			await waitForMode(page, 'command', { timeout: 2000 });

			// Cancel with Escape
			await pressKey(page, 'Escape');
			await waitForMode(page, 'normal', { timeout: 2000 });

			const state = await getGameState(page);
			expect(state?.mode).toBe('normal');
		});
	});

	test.describe('No Console Errors', () => {
		test('should have no errors during menu navigation', async ({ page }) => {
			const { errors } = setupConsoleErrorCapture(page);

			// Load app
			await page.goto('/');
			await waitForMenuReady(page);

			// Navigate menu
			await pressKey(page, 'j');
			await pressKey(page, 'k');

			// Assert no console errors
			expect(errors).toHaveLength(0);
		});

		test('should have no errors during game interaction', async ({ page }) => {
			const { errors } = setupConsoleErrorCapture(page);

			// Start game directly
			await page.goto('/play?stage=1');
			await waitForGameReady(page);

			// Basic interactions
			await pressKey(page, 'j');
			await pressKey(page, 'k');
			await pressKey(page, 'h');
			await pressKey(page, 'l');

			// Mode transitions
			await pressKey(page, 'i');
			await waitForMode(page, 'insert', { timeout: 2000 });
			await pressKey(page, 'Escape');
			await waitForMode(page, 'normal', { timeout: 2000 });

			await pressKey(page, ':');
			await waitForMode(page, 'command', { timeout: 2000 });
			await pressKey(page, 'Escape');
			await waitForMode(page, 'normal', { timeout: 2000 });

			// Assert no console errors
			expect(errors).toHaveLength(0);
		});
	});

	test.describe('Direct URL Access', () => {
		test('should load game directly via URL', async ({ page }) => {
			const { errors } = setupConsoleErrorCapture(page);

			await page.goto('/play?stage=1');
			await waitForGameReady(page);

			const state = await getGameState(page);
			expect(state).not.toBeNull();
			expect(errors).toHaveLength(0);
		});
	});
});
