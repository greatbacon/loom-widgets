<script lang="ts">
	import { Button, Switch, TextField } from 'svelte-ux';

	let url = $state('');
	let audioOnly = $state(false);
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

	function filenameFromContentDisposition(header: string | null): string | null {
		const match = header?.match(/filename="([^"]+)"/);
		return match ? match[1] : null;
	}

	async function downloadVideo() {
		loading = true;
		errorMessage = null;

		try {
			const response = await fetch('/yt-dlp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url, audioOnly })
			});

			if (!response.ok) {
				errorMessage = (await response.text()) || `Request failed with status ${response.status}`;
				return;
			}

			const blob = await response.blob();
			const filename =
				filenameFromContentDisposition(response.headers.get('content-disposition')) ?? 'download';
			const blobUrl = URL.createObjectURL(blob);

			const anchor = document.createElement('a');
			anchor.href = blobUrl;
			anchor.download = filename;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(blobUrl);
			url = '';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to download video';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
	<h1 class="text-2xl font-bold">YouTube DL</h1>

	<div class="flex w-full max-w-md gap-2">
		<TextField label="Video URL" bind:value={url} class="flex-1" />
		<Button
			variant="fill"
			color="primary"
			{loading}
			disabled={loading || !url}
			on:click={downloadVideo}
		>
			Download
		</Button>
	</div>

	<label class="flex w-full max-w-md items-center gap-2">
		<Switch bind:checked={audioOnly} />
		<span>Audio only (MP3)</span>
	</label>

	{#if errorMessage}
		<p class="text-error">{errorMessage}</p>
	{/if}
</div>
