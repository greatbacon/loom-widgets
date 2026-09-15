<script lang="ts">
	import { Button } from 'svelte-ux';
	import type { PictureFramePushResult } from '$lib/system/immich/pictureFrame';

	let { data } = $props();

	let loading = $state(false);
	let result = $state<PictureFramePushResult | null>(null);
	let errorMessage = $state<string | null>(null);

	async function pushRandomPhoto() {
		loading = true;
		errorMessage = null;
		result = null;

		try {
			const response = await fetch('/picture-frame', { method: 'POST' });

			if (!response.ok) {
				const body = await response.text();
				errorMessage = body || `Request failed with status ${response.status}`;
				return;
			}

			result = await response.json();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to push photo';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
	<h1 class="text-2xl font-bold">Picture Frame</h1>

	{#if data.device}
		<div class="flex flex-col items-center gap-1 text-sm">
			<p>{data.device.name} ({data.device.type})</p>
			<p>Firmware {data.device.version} &middot; Battery {data.device.battery}%</p>
		</div>
	{:else if data.deviceError}
		<p class="text-error">{data.deviceError}</p>
	{/if}

	<Button variant="fill" color="primary" {loading} disabled={loading} on:click={pushRandomPhoto}>
		Push random photo
	</Button>

	{#if result}
		<p>Pushed "{result.asset.filename}" ({result.device.width}x{result.device.height})</p>
	{/if}

	{#if errorMessage}
		<p class="text-error">{errorMessage}</p>
	{/if}
</div>
