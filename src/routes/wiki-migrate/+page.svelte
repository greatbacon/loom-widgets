<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { Button, TextField } from 'svelte-ux';
	import type { WikiArticle } from '$lib/system/wiki/wiki';

	let { data } = $props();

	let startFrom = $state(page.url.searchParams.get('from') ?? '');
	let current = $state<WikiArticle | null>(null);
	let category = $state('');
	let loading = $state(false);
	let done = $state(false);
	let errorMessage = $state<string | null>(null);
	let uploadedCount = $state(0);
	let skippedCount = $state(0);

	// Keeps the field and the ?from= param in step; an empty value clears both.
	function setCursor(value: string) {
		startFrom = value;
		const url = new URL(page.url);
		if (value === '') url.searchParams.delete('from');
		else url.searchParams.set('from', value);
		replaceState(url, page.state);
	}

	async function readError(response: Response): Promise<string> {
		const text = await response.text();
		try {
			const parsed = JSON.parse(text);
			if (typeof parsed?.message === 'string') return parsed.message;
		} catch {
			// not JSON
		}
		return text || `Request failed with status ${response.status}`;
	}

	// Returns true when the article was loaded (or the list ended), false on error.
	async function load(from: string): Promise<boolean> {
		try {
			const response = await fetch(`/wiki-migrate/article?from=${encodeURIComponent(from)}`);
			if (!response.ok) {
				errorMessage = await readError(response);
				return false;
			}
			const article = (await response.json()) as WikiArticle | null;
			category = '';
			if (article === null) {
				current = null;
				done = true;
				setCursor('');
			} else {
				current = article;
				done = false;
				setCursor(article.title);
			}
			return true;
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Request failed';
			return false;
		}
	}

	async function advance() {
		const next = current?.nextTitle ?? null;
		if (next === null) {
			current = null;
			category = '';
			done = true;
			setCursor('');
			return;
		}
		await load(next);
	}

	async function begin(from: string) {
		if (loading) return;
		loading = true;
		errorMessage = null;
		uploadedCount = 0;
		skippedCount = 0;
		await load(from);
		loading = false;
	}

	function start(event: SubmitEvent) {
		event.preventDefault();
		return begin(startFrom.trim());
	}

	onMount(() => {
		const initial = startFrom.trim();
		if (initial !== '') void begin(initial);
	});

	async function skip() {
		if (loading || !current) return;
		loading = true;
		errorMessage = null;
		skippedCount++;
		await advance();
		loading = false;
	}

	async function upload() {
		if (loading || !current || category === '') return;
		loading = true;
		errorMessage = null;

		try {
			const response = await fetch('/wiki-migrate/upload', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: current.title, category })
			});
			if (!response.ok) {
				errorMessage = await readError(response);
			} else {
				uploadedCount++;
				await advance();
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Request failed';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex flex-col gap-4 p-4">
	{#if done}
		<p role="status" class="rounded bg-warning/20 p-2 text-sm font-semibold">
			end of list reached!
		</p>
	{/if}

	<h1 class="text-xl font-bold">Wiki Migrate</h1>

	<form class="flex gap-2" onsubmit={start}>
		<TextField label="Start from" bind:value={startFrom} class="flex-1" />
		<Button type="submit" variant="fill" color="primary" {loading} disabled={loading}>Start</Button>
	</form>

	{#if data.categoriesError}
		<p class="text-error text-sm">{data.categoriesError}</p>
	{/if}

	{#if current}
		<section class="flex flex-col gap-3">
			<h2 class="text-lg font-semibold">{current.title}</h2>
			<pre
				class="max-h-96 overflow-auto rounded border border-surface-content/20 p-2 text-sm whitespace-pre-wrap">{current.text}</pre>

			<div class="flex flex-wrap items-center gap-2">
				<select
					aria-label="Destination category"
					class="rounded border border-surface-content/30 bg-surface-100 px-2 py-2"
					bind:value={category}
					disabled={loading}
				>
					<option value="">Select a category…</option>
					{#each data.categories as name (name)}
						<option value={name}>{name}</option>
					{/each}
				</select>
				<Button
					variant="fill"
					color="primary"
					on:click={upload}
					disabled={loading || category === ''}
				>
					Upload with category
				</Button>
				<Button variant="outline" on:click={skip} disabled={loading}>Skip</Button>
			</div>
		</section>
	{/if}

	{#if errorMessage}
		<p class="text-error text-sm">{errorMessage}</p>
	{/if}

	<p class="text-sm opacity-70">Uploaded: {uploadedCount} · Skipped: {skippedCount}</p>
</div>
