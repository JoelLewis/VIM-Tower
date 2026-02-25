/**
 * Tutorial manager — guides the player through step-by-step prompts.
 *
 * Each tutorial step has a message, an optional required action (command type
 * the player must execute), and an optional cell to highlight.
 * Steps advance when the required action is performed or any key is pressed.
 */

import type { TutorialStep } from '$lib/stages/stage-data.js';
import type { Command } from '$lib/types/game.js';

export type TutorialManager = {
	readonly steps: TutorialStep[];
	currentStep: number;
	active: boolean;
	/** The current message to display */
	message: string;
};

export function createTutorial(steps: TutorialStep[] | null): TutorialManager {
	if (!steps || steps.length === 0) {
		return { steps: [], currentStep: 0, active: false, message: '' };
	}
	return {
		steps,
		currentStep: 0,
		active: true,
		message: steps[0].message
	};
}

/** Check if a command satisfies the current tutorial step's required action. */
export function checkTutorialProgress(mgr: TutorialManager, command: Command | null): boolean {
	if (!mgr.active) return false;
	if (mgr.currentStep >= mgr.steps.length) return false;

	const step = mgr.steps[mgr.currentStep];

	// If no required action, any command advances
	if (step.requiredAction === null) {
		if (command !== null) {
			advanceTutorial(mgr);
			return true;
		}
		return false;
	}

	// Check if the command type matches
	if (command && command.type === step.requiredAction) {
		advanceTutorial(mgr);
		return true;
	}

	return false;
}

function advanceTutorial(mgr: TutorialManager): void {
	mgr.currentStep++;
	if (mgr.currentStep >= mgr.steps.length) {
		mgr.active = false;
		mgr.message = '';
	} else {
		mgr.message = mgr.steps[mgr.currentStep].message;
	}
}

/** Get the cell that should be highlighted for the current step. */
export function getTutorialHighlight(mgr: TutorialManager): { x: number; y: number } | null {
	if (!mgr.active || mgr.currentStep >= mgr.steps.length) return null;
	return mgr.steps[mgr.currentStep].highlightCell;
}

/** Check if the tutorial is complete. */
export function isTutorialComplete(mgr: TutorialManager): boolean {
	return !mgr.active || mgr.currentStep >= mgr.steps.length;
}
