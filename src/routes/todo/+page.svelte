<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button } from 'svelte-ux';
	import IconMdiRefresh from '~icons/mdi/refresh';
	import AddForm from './AddForm.svelte';
	import ListHeader from './ListHeader.svelte';
	import TodoItem from './TodoItem.svelte';

	let { data } = $props();

	let refreshing = $state(false);

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
					<section class="rounded-lg border border-surface-content/20 p-4">
						<ListHeader {list} />
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
					</section>
				{/each}
			</div>
		{/if}
	{/if}
</div>
