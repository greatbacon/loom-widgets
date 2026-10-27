<script lang="ts">
	import { Button, TextField } from 'svelte-ux';
	import IconMdiPencil from '~icons/mdi/pencil';
	import IconMdiDelete from '~icons/mdi/delete';
	import IconMdiBroom from '~icons/mdi/broom';
	import { sendRequest } from './sendRequest';

	let { list }: { list: { id: string; name: string; items: { completed: boolean }[] } } = $props();

	const url = $derived(`/todo/lists/${list.id}`);
	const hasCompleted = $derived(list.items.some((item) => item.completed));

	let editing = $state(false);
	let draft = $state('');
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

	function startEdit() {
		draft = list.name;
		errorMessage = null;
		editing = true;
	}

	function cancelEdit() {
		editing = false;
		errorMessage = null;
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (loading || !draft.trim()) return;
		loading = true;
		errorMessage = null;
		const error = await sendRequest(url, 'PATCH', { name: draft });
		if (error) {
			errorMessage = error;
		} else {
			editing = false;
		}
		loading = false;
	}

	async function clearCompleted() {
		if (loading) return;
		loading = true;
		errorMessage = null;
		const error = await sendRequest(`${url}/items`, 'DELETE');
		if (error) errorMessage = error;
		loading = false;
	}

	async function remove() {
		if (loading) return;
		loading = true;
		errorMessage = null;
		const error = await sendRequest(url, 'DELETE');
		if (error) errorMessage = error;
		loading = false;
	}
</script>

{#if editing}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<form
		class="mb-2 flex w-full flex-wrap items-center gap-2"
		onsubmit={save}
		onkeydown={(event) => {
			if (event.key === 'Escape') cancelEdit();
		}}
	>
		<TextField label="List name" bind:value={draft} class="min-w-0 flex-1" />
		<Button
			type="submit"
			variant="fill"
			color="primary"
			{loading}
			disabled={loading || !draft.trim()}
		>
			Save
		</Button>
		<Button type="button" disabled={loading} on:click={cancelEdit}>Cancel</Button>
	</form>
{:else}
	<div class="mb-2 flex items-center gap-2">
		<Button
			icon={IconMdiBroom}
			size="sm"
			aria-label="Clear completed items"
			disabled={loading || !hasCompleted}
			on:click={clearCompleted}
		/>
		<h2 class="flex-1 text-lg font-semibold">{list.name}</h2>
		<Button
			icon={IconMdiPencil}
			size="sm"
			aria-label="Rename list"
			disabled={loading}
			on:click={startEdit}
		/>
		<Button
			icon={IconMdiDelete}
			size="sm"
			aria-label="Delete list"
			disabled={loading}
			on:click={remove}
		/>
	</div>
{/if}
{#if errorMessage}
	<p class="text-error mb-2 text-sm">{errorMessage}</p>
{/if}
