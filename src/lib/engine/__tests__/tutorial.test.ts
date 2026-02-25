import { describe, it, expect } from 'vitest';
import {
	createTutorial,
	checkTutorialProgress,
	getTutorialHighlight,
	isTutorialComplete
} from '../tutorial.js';
import type { TutorialStep } from '$lib/stages/stage-data.js';
import type { Command } from '$lib/types/game.js';

const testSteps: TutorialStep[] = [
	{ message: 'Step 1: Move the cursor', requiredAction: 'move_cursor', highlightCell: null },
	{ message: 'Step 2: Place a tower', requiredAction: 'place_tower', highlightCell: { x: 3, y: 2 } },
	{ message: 'Step 3: Any action', requiredAction: null, highlightCell: null }
];

describe('createTutorial', () => {
	it('creates an active tutorial from steps', () => {
		const mgr = createTutorial(testSteps);
		expect(mgr.active).toBe(true);
		expect(mgr.currentStep).toBe(0);
		expect(mgr.message).toBe('Step 1: Move the cursor');
	});

	it('creates an inactive tutorial from null', () => {
		const mgr = createTutorial(null);
		expect(mgr.active).toBe(false);
	});

	it('creates an inactive tutorial from empty array', () => {
		const mgr = createTutorial([]);
		expect(mgr.active).toBe(false);
	});
});

describe('checkTutorialProgress', () => {
	it('advances when correct command type is given', () => {
		const mgr = createTutorial(testSteps);
		const moveCmd: Command = { type: 'move_cursor', dx: 1, dy: 0, count: 1 };
		const advanced = checkTutorialProgress(mgr, moveCmd);
		expect(advanced).toBe(true);
		expect(mgr.currentStep).toBe(1);
		expect(mgr.message).toBe('Step 2: Place a tower');
	});

	it('does not advance on wrong command type', () => {
		const mgr = createTutorial(testSteps);
		const wrongCmd: Command = { type: 'enter_insert_mode', variant: 'i' };
		const advanced = checkTutorialProgress(mgr, wrongCmd);
		expect(advanced).toBe(false);
		expect(mgr.currentStep).toBe(0);
	});

	it('does not advance on null command', () => {
		const mgr = createTutorial(testSteps);
		const advanced = checkTutorialProgress(mgr, null);
		expect(advanced).toBe(false);
	});

	it('advances on any command when requiredAction is null', () => {
		const mgr = createTutorial(testSteps);
		// Advance past first two steps
		checkTutorialProgress(mgr, { type: 'move_cursor', dx: 1, dy: 0, count: 1 });
		checkTutorialProgress(mgr, { type: 'place_tower', towerType: 'arrow' });

		// Step 3 has null requiredAction — any command advances
		const advanced = checkTutorialProgress(mgr, { type: 'enter_normal_mode' });
		expect(advanced).toBe(true);
		expect(mgr.active).toBe(false);
	});

	it('completes tutorial after all steps', () => {
		const mgr = createTutorial(testSteps);
		checkTutorialProgress(mgr, { type: 'move_cursor', dx: 1, dy: 0, count: 1 });
		checkTutorialProgress(mgr, { type: 'place_tower', towerType: 'arrow' });
		checkTutorialProgress(mgr, { type: 'enter_normal_mode' });
		expect(isTutorialComplete(mgr)).toBe(true);
		expect(mgr.active).toBe(false);
		expect(mgr.message).toBe('');
	});

	it('returns false when tutorial is inactive', () => {
		const mgr = createTutorial(null);
		const advanced = checkTutorialProgress(mgr, { type: 'move_cursor', dx: 1, dy: 0, count: 1 });
		expect(advanced).toBe(false);
	});
});

describe('getTutorialHighlight', () => {
	it('returns highlight cell for current step', () => {
		const mgr = createTutorial(testSteps);
		expect(getTutorialHighlight(mgr)).toBeNull(); // Step 1 has no highlight

		// Advance to step 2
		checkTutorialProgress(mgr, { type: 'move_cursor', dx: 1, dy: 0, count: 1 });
		expect(getTutorialHighlight(mgr)).toEqual({ x: 3, y: 2 });
	});

	it('returns null when tutorial is complete', () => {
		const mgr = createTutorial(testSteps);
		checkTutorialProgress(mgr, { type: 'move_cursor', dx: 1, dy: 0, count: 1 });
		checkTutorialProgress(mgr, { type: 'place_tower', towerType: 'arrow' });
		checkTutorialProgress(mgr, { type: 'enter_normal_mode' });
		expect(getTutorialHighlight(mgr)).toBeNull();
	});
});

describe('isTutorialComplete', () => {
	it('returns false while steps remain', () => {
		const mgr = createTutorial(testSteps);
		expect(isTutorialComplete(mgr)).toBe(false);
	});

	it('returns true for null tutorial', () => {
		const mgr = createTutorial(null);
		expect(isTutorialComplete(mgr)).toBe(true);
	});
});
