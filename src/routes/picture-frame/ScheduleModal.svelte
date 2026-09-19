<script lang="ts">
	import { Dialog, Button, TextField, Switch } from 'svelte-ux';
	import type {
		Bloomin8PullSettings,
		Bloomin8PullSettingsInput
	} from '$lib/system/bloomin8/bloomin8Client.server';

	let {
		open = $bindable(false),
		settings,
		saving,
		onsave,
		oncancel
	}: {
		open?: boolean;
		settings: Bloomin8PullSettings | null;
		saving: boolean;
		onsave: (input: Bloomin8PullSettingsInput) => void;
		oncancel?: () => void;
	} = $props();

	let upstreamOn = $state(false);
	let upstreamUrl = $state('');
	let token = $state('');
	let cronTimeLocal = $state('');

	function unixSecondsToLocalInput(seconds: number): string {
		if (!seconds) return '';
		const date = new Date(seconds * 1000);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
	}

	function formatUnixSeconds(seconds: number): string {
		if (!seconds) return 'none';
		return new Date(seconds * 1000).toLocaleString();
	}

	$effect(() => {
		if (open && settings) {
			upstreamOn = settings.upstream_on;
			upstreamUrl = settings.upstream_url;
			token = settings.token;
			cronTimeLocal = unixSecondsToLocalInput(settings.next_cron_time);
		}
	});

	function handleClose() {
		oncancel?.();
	}

	function handleSave() {
		onsave({
			upstream_on: upstreamOn,
			upstream_url: upstreamUrl,
			token,
			...(cronTimeLocal ? { cron_time: new Date(cronTimeLocal).toISOString() } : {})
		});
	}
</script>

<Dialog bind:open on:close={handleClose} classes={{ dialog: 'max-w-md' }}>
	<div slot="title">Schedule pull</div>
	<div class="flex flex-col gap-4 p-4">
		{#if settings}
			<div class="text-sm text-surface-content/70">
				<p>Last pulled: {settings.pre_image || 'none'}</p>
				<p>Device time: {formatUnixSeconds(settings.time)}</p>
			</div>
		{/if}
		<div class="flex items-center gap-2 text-sm">
			<span>Enabled</span>
			<Switch bind:checked={upstreamOn} />
		</div>
		<TextField label="Upstream URL" bind:value={upstreamUrl} />
		<TextField label="Token" type="password" bind:value={token} />
		<label class="flex flex-col gap-1 text-sm">
			Next pull time
			<input type="datetime-local" class="rounded border p-2" bind:value={cronTimeLocal} />
		</label>
	</div>
	<div slot="actions" class="flex justify-end gap-2 p-4">
		<Button on:click={() => (open = false)}>Cancel</Button>
		<Button variant="fill" color="primary" loading={saving} on:click={handleSave}>Save</Button>
	</div>
</Dialog>
