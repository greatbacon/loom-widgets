<script lang="ts">
	let { data } = $props();
</script>

<div class="flex flex-col items-center gap-4 p-6">
	<h1 class="text-2xl font-bold">Todo</h1>

	{#if data.error}
		<p class="text-error">{data.error}</p>
	{:else if data.lists.length === 0}
		<p>No lists yet.</p>
	{:else}
		<div class="grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.lists as list (list.id)}
				<section class="rounded-lg border border-surface-content/20 p-4">
					<h2 class="mb-2 text-lg font-semibold">{list.name}</h2>
					{#if list.items.length === 0}
						<p class="text-sm opacity-60">No items.</p>
					{:else}
						<ul class="flex flex-col gap-1">
							{#each list.items as item (item.id)}
								<li class="flex items-center gap-2">
									<input type="checkbox" checked={item.completed} disabled />
									<span class:line-through={item.completed} class:opacity-60={item.completed}>
										{item.content}
									</span>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/each}
		</div>
	{/if}
</div>
