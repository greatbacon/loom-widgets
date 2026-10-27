<script lang="ts">
	import { Button, TextField } from 'svelte-ux';
	import IconMdiPencil from '~icons/mdi/pencil';
	import IconMdiDelete from '~icons/mdi/delete';
	import type { TodoItem } from '$lib/system/todo/todo';
	import { sendRequest } from './sendRequest';

	let { item, listId }: { item: TodoItem; listId: string } = $props();

	const url = $derived(`/todo/lists/${listId}/items/${item.id}`);

	let completed = $derived(item.completed);
	let editing = $state(false);
	let draft = $state('');
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

	async function toggle(event: Event & { currentTarget: HTMLInputElement }) {
		completed = event.currentTarget.checked;
		errorMessage = null;
		const error = await sendRequest(url, 'PATCH', { completed });
		if (error) {
			completed = item.completed;
			errorMessage = error;
		}
	}

	function startEdit() {
		draft = item.content;
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
		const error = await sendRequest(url, 'PATCH', { content: draft });
		if (error) {
			errorMessage = error;
		} else {
			editing = false;
		}
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
		class="flex w-full items-center gap-2"
		onsubmit={save}
		onkeydown={(event) => {
			if (event.key === 'Escape') cancelEdit();
		}}
	>
		<TextField label="Edit item" bind:value={draft} class="flex-1" />
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
	<div class="flex w-full items-center gap-2">
		<input type="checkbox" checked={completed} onchange={toggle} />
		<span class="flex-1" class:line-through={completed} class:opacity-60={completed}>
			{item.content}
		</span>
		<Button
			icon={IconMdiPencil}
			size="sm"
			aria-label="Edit item"
			disabled={loading}
			on:click={startEdit}
		/>
		<Button
			icon={IconMdiDelete}
			size="sm"
			aria-label="Delete item"
			disabled={loading}
			on:click={remove}
		/>
	</div>
{/if}
{#if errorMessage}
	<p class="text-error text-sm">{errorMessage}</p>
{/if}
