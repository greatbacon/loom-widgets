export const TICKET_STATUSES = ['backlog', 'todo', 'in_progress', 'done'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export interface Ticket {
	id: string;
	creator_sub: string;
	owner_sub: string | null;
	title: string;
	body: string;
	status: TicketStatus;
	created_at: Date;
	updated_at: Date | null;
}

export interface TicketChanges {
	title?: string;
	body?: string;
	status?: TicketStatus;
	owner_sub?: string | null;
}
