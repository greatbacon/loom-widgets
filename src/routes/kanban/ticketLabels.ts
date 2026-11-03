import type { TicketStatus } from '$lib/system/tickets/ticket';

export const STATUS_LABELS: Record<TicketStatus, string> = {
	backlog: 'Backlog',
	todo: 'Todo',
	in_progress: 'In progress',
	done: 'Done'
};

export interface UserOption {
	sub: string;
	username: string;
}
