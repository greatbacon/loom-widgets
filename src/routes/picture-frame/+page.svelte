<script lang="ts">
	import { Button } from 'svelte-ux';
	import { invalidateAll } from '$app/navigation';
	import type { CropRect, PictureFramePushResult } from '$lib/system/immich/pictureFrame';
	import CropEditor from './CropEditor.svelte';

	let { data } = $props();

	let loading = $state(false);
	let processing = $state(false);
	let showCropEditor = $state(false);
	let result = $state<PictureFramePushResult | null>(null);
	let errorMessage = $state<string | null>(null);
	let selectedAssetId = $state<string | null>(null);
	// Optimistic guess at which asset is now on the frame, set on a successful
	// push. Reset whenever fresh load data arrives, deferring back to the
	// server-derived `asset.active` (the DB's stored active flag, set when a
	// push to the frame succeeds).
	let pushedActiveId = $state<string | null>(null);

	$effect(() => {
		void data;
		pushedActiveId = null;
	});

	let selectedAsset = $derived(data.album?.assets.find((a) => a.id === selectedAssetId) ?? null);
	let hasProcessedAssets = $derived(data.album?.assets.some((a) => a.processed) ?? false);
	let hasUnprocessedAssets = $derived(data.album?.assets.some((a) => !a.processed) ?? false);
	let autoProcessing = $state(false);

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

			const pushResult: PictureFramePushResult = await response.json();
			result = pushResult;
			pushedActiveId = pushResult.asset.id;
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

	async function handleCropConfirm(crop: CropRect) {
		if (!selectedAssetId) return;
		processing = true;
		errorMessage = null;
		try {
			const response = await fetch('/picture-frame/process', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ assetId: selectedAssetId, crop })
			});
			if (!response.ok) {
				errorMessage = (await response.text()) || `Request failed with status ${response.status}`;
				return;
			}
			showCropEditor = false;
			await invalidateAll();
		} finally {
			processing = false;
		}
	}

	async function processNewPhotos() {
		autoProcessing = true;
		errorMessage = null;
		try {
			const response = await fetch('/picture-frame/process-all', { method: 'POST' });
			if (!response.ok) {
				errorMessage = (await response.text()) || `Request failed with status ${response.status}`;
				return;
			}
			await invalidateAll();
		} finally {
			autoProcessing = false;
		}
	}
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
	<h1 class="text-2xl font-bold">Picture Frame</h1>

	{#if data.device}
		<div class="flex flex-col items-center gap-1 text-sm">
			<p>{data.device.name} ({data.device.type})</p>
			<p>
				{data.device.width}x{data.device.height} &middot; Firmware {data.device.version} &middot; Battery
				{data.device.battery}%
			</p>
		</div>
	{:else if data.deviceError}
		<p class="text-error">{data.deviceError}</p>
	{/if}

	<div class="flex gap-2">
		<Button
			variant="fill"
			color="primary"
			{loading}
			disabled={loading || !selectedAssetId || !selectedAsset?.processed}
			on:click={() => pushPhoto(selectedAssetId ?? undefined)}
		>
			Push selected photo
		</Button>
		<Button
			variant="outline"
			color="primary"
			{loading}
			disabled={loading || !hasProcessedAssets}
			on:click={() => pushPhoto()}
		>
			Push random photo
		</Button>
		<Button
			variant="outline"
			color="secondary"
			loading={processing}
			disabled={loading || processing || !selectedAssetId || !data.device}
			on:click={() => (showCropEditor = true)}
		>
			Process
		</Button>
		<Button
			variant="outline"
			color="secondary"
			loading={autoProcessing}
			disabled={loading || processing || autoProcessing || !hasUnprocessedAssets}
			on:click={processNewPhotos}
		>
			Process new photos
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
					class="relative aspect-square overflow-hidden rounded {selectedAssetId === asset.id
						? 'ring-4 ring-primary'
						: ''}"
				>
					<img
						src={asset.thumbnailUrl}
						alt={asset.filename}
						loading="lazy"
						class="h-full w-full object-cover"
					/>
					{#if asset.processed}
						<span
							class="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white"
							title="Processed"
						>
							✓
						</span>
					{/if}
					{#if pushedActiveId ? asset.id === pushedActiveId : asset.active}
						<span
							class="pointer-events-none absolute top-0 left-0 h-1/3 w-1/3 bg-success"
							style="clip-path: polygon(0 0, 100% 0, 0 100%);"
							title="Currently on frame"
						></span>
					{/if}
				</button>
			{/each}
		</div>
	{:else if data.albumError}
		<p class="text-error">{data.albumError}</p>
	{/if}

	{#if selectedAssetId && data.device}
		<CropEditor
			bind:open={showCropEditor}
			assetId={selectedAssetId}
			aspectRatio={data.device.width / data.device.height}
			onconfirm={handleCropConfirm}
			oncancel={() => (showCropEditor = false)}
		/>
	{/if}
</div>
