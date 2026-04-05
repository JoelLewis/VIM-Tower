<script lang="ts">
	import { page } from '$app/state';
	import Game from '$lib/ui/Game.svelte';
	import { getStage, STAGE_1 } from '$lib/stages/stage-data.js';

	// Read stage from URL query param (?stage=2), default to 1
	const stageParam = Number(page.url.searchParams.get('stage')) || 1;
	const stage = getStage(stageParam) ?? STAGE_1;

	// Read testMode from URL query param (?testMode=true) for E2E tests
	// When enabled, game runs at 10x speed for faster test execution
	const testMode = page.url.searchParams.get('testMode') === 'true';
</script>

<svelte:head>
	<title>:wq! — {stage.name}</title>
</svelte:head>

<Game stageConfig={stage} stageId={stage.id} parKeystrokes={stage.parKeystrokes} {testMode} />
