<script lang="ts">
	import { sendRequest } from '$lib/sendRequest';
	import type { Ticket, TicketStatus } from '$lib/system/tickets/ticket';
	import TicketCard from './TicketCard.svelte';
	import { STATUS_LABELS, type UserOption } from './ticketLabels';

	let {
		status,
		tickets,
		users,
		ownerNames
	}: {
		status: TicketStatus;
		tickets: Ticket[];
		users: UserOption[];
		ownerNames: Map<string, string>;
	} = $props();

	let over = $state(false);
	let errorMessage = $state<string | null>(null);

	function dragover(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		over = true;
	}

	async function drop(event: DragEvent) {
		event.preventDefault();
		over = false;
		const id = event.dataTransfer?.getData('text/plain');
		if (!id || tickets.some((ticket) => ticket.id === id)) return;
		errorMessage = null;
		const error = await sendRequest(`/kanban/${id}`, 'PATCH', { status });
		if (error) errorMessage = error;
	}
</script>

<section
	class="flex min-h-32 flex-col gap-2 rounded-lg border border-surface-content/20 p-3 transition-colors"
	class:bg-primary={over}
	class:bg-opacity-10={over}
	aria-label={STATUS_LABELS[status]}
	ondragover={dragover}
	ondragleave={() => (over = false)}
	ondrop={drop}
>
	<h2 class="font-bold">
		{STATUS_LABELS[status]}
		<span class="text-sm font-normal opacity-60">({tickets.length})</span>
	</h2>
	{#if errorMessage}
		<p class="text-error text-sm">{errorMessage}</p>
	{/if}
	{#each tickets as ticket (ticket.id)}
		<TicketCard
			{ticket}
			{users}
			ownerName={ticket.owner_sub ? (ownerNames.get(ticket.owner_sub) ?? null) : null}
		/>
	{/each}
</section>
