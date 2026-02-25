<script lang="ts">
	import { page } from '$app/state';
	import Game from '$lib/ui/Game.svelte';
	import { getStage, STAGE_1 } from '$lib/stages/stage-data.js';

	// Read stage from URL query param (?stage=2), default to 1
	const stageParam = Number(page.url.searchParams.get('stage')) || 1;
	const stage = getStage(stageParam) ?? STAGE_1;
</script>

<svelte:head>
	<title>:wq! — {stage.name}</title>
</svelte:head>

<Game stageConfig={stage} />
