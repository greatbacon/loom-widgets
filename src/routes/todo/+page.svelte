<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { Button } from 'svelte-ux';
	import IconMdiRefresh from '~icons/mdi/refresh';
	import AddForm from './AddForm.svelte';
	import ListHeader from './ListHeader.svelte';
	import TodoItem from './TodoItem.svelte';

	const STORAGE_KEY = 'todo-expanded-lists';

	let { data } = $props();

	let refreshing = $state(false);
	let expanded = $state<string[]>([]);

	function save() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(expanded));
		} catch {
			// storage unavailable; state stays in memory
		}
	}

	onMount(() => {
		try {
			const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
			if (!Array.isArray(stored)) return;
			const ids = stored.filter((id): id is string => typeof id === 'string');
			if (data.error) {
				expanded = ids;
				return;
			}
			const known = new Set(data.lists.map((list) => list.id));
			expanded = ids.filter((id) => known.has(id));
			if (expanded.length !== ids.length) save();
		} catch {
			// unreadable storage or bad JSON; keep default (all collapsed)
		}
	});

	function toggle(id: string) {
		expanded = expanded.includes(id) ? expanded.filter((e) => e !== id) : [...expanded, id];
		save();
	}

	async function refresh() {
		if (refreshing) return;
		refreshing = true;
		try {
			await invalidateAll();
		} finally {
			refreshing = false;
		}
	}
</script>

<div class="flex flex-col items-center gap-4 p-6">
	<div class="flex items-center gap-2">
		<h1 class="text-2xl font-bold">Todo</h1>
		<Button
			icon={IconMdiRefresh}
			size="sm"
			aria-label="Refresh"
			loading={refreshing}
			disabled={refreshing}
			on:click={refresh}
		/>
	</div>

	{#if data.error}
		<p class="text-error">{data.error}</p>
	{:else}
		<div class="w-full max-w-5xl">
			<AddForm label="New list" buttonLabel="Add list" url="/todo/lists" field="name" />
		</div>

		{#if data.lists.length === 0}
			<p>No lists yet.</p>
		{:else}
			<div class="grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.lists as list (list.id)}
					{@const open = expanded.includes(list.id)}
					<section class="rounded-lg border border-surface-content/20 p-4">
						<ListHeader {list} {open} ontoggle={() => toggle(list.id)} />
						{#if open}
							<div id={`todo-list-${list.id}`}>
								{#if list.items.length === 0}
									<p class="text-sm opacity-60">No items.</p>
								{:else}
									<ul class="flex flex-col gap-1">
										{#each list.items as item (item.id)}
											<li>
												<TodoItem {item} listId={list.id} />
											</li>
										{/each}
									</ul>
								{/if}
								<div class="mt-3">
									<AddForm label="Add item" url={`/todo/lists/${list.id}/items`} field="content" />
								</div>
							</div>
						{/if}
					</section>
				{/each}
			</div>
		{/if}
	{/if}
</div>
