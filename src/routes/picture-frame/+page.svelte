<script lang="ts">
	import { Button } from 'svelte-ux';
	import type { PictureFramePushResult } from '$lib/system/immich/pictureFrame';

	let { data } = $props();

	let loading = $state(false);
	let result = $state<PictureFramePushResult | null>(null);
	let errorMessage = $state<string | null>(null);
	let selectedAssetId = $state<string | null>(null);

	async function pushPhoto(assetId?: string) {
		loading = true;
		errorMessage = null;
		result = null;

		try {
			const response = await fetch('/picture-frame', {
				method: 'POST',
				...(assetId
					? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId }) }
					: {})
			});

			if (!response.ok) {
				const body = await response.text();
				errorMessage = body || `Request failed with status ${response.status}`;
				return;
			}

			result = await response.json();
			selectedAssetId = null;
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to push photo';
		} finally {
			loading = false;
		}
	}

	function toggleSelect(assetId: string) {
		selectedAssetId = selectedAssetId === assetId ? null : assetId;
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

	<div class="flex gap-2">
		<Button
			variant="fill"
			color="primary"
			{loading}
			disabled={loading || !selectedAssetId}
			on:click={() => pushPhoto(selectedAssetId ?? undefined)}
		>
			Push selected photo
		</Button>
		<Button
			variant="outline"
			color="primary"
			{loading}
			disabled={loading}
			on:click={() => pushPhoto()}
		>
			Push random photo
		</Button>
	</div>

	{#if result}
		<p>Pushed "{result.asset.filename}" ({result.device.width}x{result.device.height})</p>
	{/if}

	{#if errorMessage}
		<p class="text-error">{errorMessage}</p>
	{/if}

	{#if data.album}
		<div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
			{#each data.album.assets as asset (asset.id)}
				<button
					type="button"
					onclick={() => toggleSelect(asset.id)}
					class="aspect-square overflow-hidden rounded {selectedAssetId === asset.id
						? 'ring-4 ring-primary'
						: ''}"
				>
					<img
						src={asset.thumbnailUrl}
						alt={asset.filename}
						loading="lazy"
						class="h-full w-full object-cover"
					/>
				</button>
			{/each}
		</div>
	{:else if data.albumError}
		<p class="text-error">{data.albumError}</p>
	{/if}
</div>
