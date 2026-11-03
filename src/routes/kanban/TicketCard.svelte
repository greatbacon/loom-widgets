<script lang="ts">
	import { Button } from 'svelte-ux';
	import IconMdiPencil from '~icons/mdi/pencil';
	import IconMdiDelete from '~icons/mdi/delete';
	import { sendRequest } from '$lib/sendRequest';
	import type { Ticket } from '$lib/system/tickets/ticket';
	import TicketForm from './TicketForm.svelte';
	import type { UserOption } from './ticketLabels';

	let {
		ticket,
		users,
		ownerName
	}: { ticket: Ticket; users: UserOption[]; ownerName: string | null } = $props();

	let editing = $state(false);
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

	function dragstart(event: DragEvent) {
		if (!event.dataTransfer) return;
		event.dataTransfer.setData('text/plain', ticket.id);
		event.dataTransfer.effectAllowed = 'move';
	}

	async function remove() {
		if (loading) return;
		loading = true;
		errorMessage = null;
		const error = await sendRequest(`/kanban/${ticket.id}`, 'DELETE');
		if (error) errorMessage = error;
		loading = false;
	}
</script>

<div
	class="rounded-lg border border-surface-content/20 bg-surface-100 p-3"
	draggable={!editing}
	ondragstart={dragstart}
	role="group"
	aria-label={ticket.title}
>
	{#if editing}
		<TicketForm {users} {ticket} onDone={() => (editing = false)} />
	{:else}
		<div class="flex items-start gap-2">
			<h3 class="flex-1 font-bold">{ticket.title}</h3>
			<Button
				icon={IconMdiPencil}
				size="sm"
				aria-label="Edit ticket"
				disabled={loading}
				on:click={() => {
					errorMessage = null;
					editing = true;
				}}
			/>
			<Button
				icon={IconMdiDelete}
				size="sm"
				aria-label="Delete ticket"
				disabled={loading}
				on:click={remove}
			/>
		</div>
		{#if ticket.body}
			<p class="line-clamp-4 text-sm whitespace-pre-wrap opacity-80">{ticket.body}</p>
		{/if}
		<p class="mt-2 text-xs opacity-60">{ownerName ?? 'Unassigned'}</p>
	{/if}
	{#if errorMessage}
		<p class="text-error text-sm">{errorMessage}</p>
	{/if}
</div>
