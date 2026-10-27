<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button, TextField } from 'svelte-ux';

	let {
		label,
		buttonLabel = 'Add',
		url,
		field
	}: {
		label: string;
		buttonLabel?: string;
		url: string;
		field: string;
	} = $props();

	let value = $state('');
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (loading || !value.trim()) return;
		loading = true;
		errorMessage = null;

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ [field]: value })
			});

			if (!response.ok) {
				errorMessage = (await response.text()) || `Request failed with status ${response.status}`;
				return;
			}

			value = '';
			await invalidateAll();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Request failed';
		} finally {
			loading = false;
		}
	}
</script>

<form class="flex w-full flex-col gap-1" onsubmit={submit}>
	<div class="flex gap-2">
		<TextField {label} bind:value class="flex-1" />
		<Button
			type="submit"
			variant="fill"
			color="primary"
			{loading}
			disabled={loading || !value.trim()}
		>
			{buttonLabel}
		</Button>
	</div>
	{#if errorMessage}
		<p class="text-error text-sm">{errorMessage}</p>
	{/if}
</form>
