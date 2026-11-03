<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button } from 'svelte-ux';
	import IconMdiRefresh from '~icons/mdi/refresh';
	import { TICKET_STATUSES, type Ticket } from '$lib/system/tickets/ticket';
	import TicketColumn from './TicketColumn.svelte';
	import TicketForm from './TicketForm.svelte';
	import type { UserOption } from './ticketLabels';

	let { data }: { data: { tickets: Ticket[]; users: UserOption[]; error: string | null } } =
		$props();

	let refreshing = $state(false);
	let creating = $state(false);

	const ownerNames = $derived(new Map(data.users.map((user) => [user.sub, user.username])));
	const columns = $derived(
		TICKET_STATUSES.map((status) => ({
			status,
			tickets: data.tickets.filter((ticket) => ticket.status === status)
		}))
	);

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
		<h1 class="text-2xl font-bold">Kanban</h1>
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
	{/if}

	<div class="w-full max-w-7xl">
		{#if creating}
			<TicketForm users={data.users} onDone={() => (creating = false)} />
		{:else}
			<Button variant="fill" color="primary" on:click={() => (creating = true)}>New ticket</Button>
		{/if}
	</div>

	{#if data.tickets.length > 0 || !data.error}
		<div class="grid w-full max-w-7xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each columns as column (column.status)}
				<TicketColumn
					status={column.status}
					tickets={column.tickets}
					users={data.users}
					{ownerNames}
				/>
			{/each}
		</div>
	{/if}
</div>
