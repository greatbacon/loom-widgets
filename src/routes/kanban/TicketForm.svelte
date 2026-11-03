<script lang="ts">
	import { Button, TextField } from 'svelte-ux';
	import { sendRequest } from '$lib/sendRequest';
	import { TICKET_STATUSES, type Ticket, type TicketStatus } from '$lib/system/tickets/ticket';
	import { STATUS_LABELS, type UserOption } from './ticketLabels';

	let {
		users,
		ticket,
		onDone,
		submitLabel = ticket ? 'Save' : 'Add ticket'
	}: {
		users: UserOption[];
		ticket?: Ticket;
		onDone: () => void;
		submitLabel?: string;
	} = $props();

	let title = $state(ticket?.title ?? '');
	let body = $state(ticket?.body ?? '');
	let owner = $state<string>(ticket?.owner_sub ?? '');
	let status = $state<TicketStatus>(ticket?.status ?? 'backlog');
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (loading) return;
		if (!ticket && !title.trim()) return;
		const owner_sub = owner === '' ? null : owner;

		let error: string | null = null;
		loading = true;
		errorMessage = null;
		if (ticket) {
			const changes: Record<string, unknown> = {};
			if (title !== ticket.title) changes.title = title;
			if (body !== ticket.body) changes.body = body;
			if (status !== ticket.status) changes.status = status;
			if (owner_sub !== ticket.owner_sub) changes.owner_sub = owner_sub;
			if (Object.keys(changes).length === 0) {
				loading = false;
				onDone();
				return;
			}
			error = await sendRequest(`/kanban/${ticket.id}`, 'PATCH', changes);
		} else {
			error = await sendRequest('/kanban', 'POST', { title, body, status, owner_sub });
		}
		loading = false;
		if (error) {
			errorMessage = error;
			return;
		}
		if (!ticket) {
			title = '';
			body = '';
			owner = '';
			status = 'backlog';
		}
		onDone();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
	class="flex w-full flex-col gap-2"
	onsubmit={submit}
	onkeydown={(event) => {
		if (event.key === 'Escape') onDone();
	}}
>
	<TextField label="Title" bind:value={title} required />
	<TextField label="Body" bind:value={body} multiline />
	<label class="flex flex-col gap-1 text-sm">
		Owner
		<select class="rounded border border-surface-content/30 bg-surface-100 p-2" bind:value={owner}>
			<option value="">Unassigned</option>
			{#each users as user (user.sub)}
				<option value={user.sub}>{user.username}</option>
			{/each}
		</select>
	</label>
	<label class="flex flex-col gap-1 text-sm">
		Status
		<select class="rounded border border-surface-content/30 bg-surface-100 p-2" bind:value={status}>
			{#each TICKET_STATUSES as value (value)}
				<option {value}>{STATUS_LABELS[value]}</option>
			{/each}
		</select>
	</label>
	<div class="flex gap-2">
		<Button type="submit" variant="fill" color="primary" {loading} disabled={loading}>
			{submitLabel}
		</Button>
		<Button type="button" disabled={loading} on:click={onDone}>Cancel</Button>
	</div>
	{#if errorMessage}
		<p class="text-error text-sm">{errorMessage}</p>
	{/if}
</form>
