<script lang="ts">
	import { buildCategoryTree } from '$lib/system/wiki/categoryTree';
	import type { WikiCategory } from '$lib/system/wiki/wiki';

	let {
		categories,
		value = $bindable(''),
		disabled = false
	}: { categories: WikiCategory[]; value?: string; disabled?: boolean } = $props();

	let path = $state<string[]>([]);

	const tree = $derived(buildCategoryTree(categories));
	const options = $derived(path.length ? (tree.children.get(path.at(-1)!) ?? []) : tree.roots);

	const itemClass =
		'rounded border border-surface-content/30 bg-surface-100 px-2 py-1 text-sm hover:bg-surface-200 disabled:opacity-50';

	function goTo(depth: number) {
		path = path.slice(0, depth);
		value = '';
	}

	function choose(name: string) {
		if (tree.children.get(name)?.length) {
			path = [...path, name];
			value = '';
		} else {
			value = name;
		}
	}
</script>

<div role="group" aria-label="Destination category" class="flex flex-col gap-2">
	<nav aria-label="Category path" class="flex flex-wrap items-center gap-1 text-sm">
		<button type="button" class="underline" {disabled} onclick={() => goTo(0)}>All</button>
		{#each path as segment, i (i)}
			<span aria-hidden="true">›</span>
			<button type="button" class="underline" {disabled} onclick={() => goTo(i + 1)}>
				{segment}
			</button>
		{/each}
	</nav>

	{#if categories.length === 0}
		<p class="text-sm opacity-70">No categories available</p>
	{:else}
		<div class="flex max-h-64 flex-wrap gap-2 overflow-auto">
			{#each options as name (name)}
				{@const isLeaf = !tree.children.get(name)?.length}
				<button
					type="button"
					class="{itemClass} {value === name ? 'border-primary bg-primary/20 font-semibold' : ''}"
					aria-pressed={isLeaf ? value === name : undefined}
					{disabled}
					onclick={() => choose(name)}
				>
					{name}{#if !isLeaf}<span aria-hidden="true"> ›</span>{/if}
				</button>
			{/each}
		</div>
	{/if}

	<p class="text-sm">{value ? `Selected: ${value}` : 'No category selected'}</p>
</div>
