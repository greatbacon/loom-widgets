import type { Ticket, TicketChanges, TicketStatus } from './ticket';
import { TicketsRepo } from '$lib/system/tickets/ticketsRepo';
import { parseBody, parseId, parseText } from '$lib/system/util/validation';
import { parseOwnerSub, parseStatus } from '$lib/system/tickets/validation';
import postgres from 'postgres';
import { defaultPostgresOptions } from '$lib/db/postgres.server';

export interface Result<T> {
	ok: true;
	data: T;
	code: number;
}

export interface Error {
	ok: false;
	error: string;
	code: number;
}

const log = console;

const FK_VIOLATION = '23503';

function isForeignKeyViolation(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		(error as { code?: unknown }).code === FK_VIOLATION
	);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class TicketsService {
	ticketsRepo: TicketsRepo;

	constructor(ticketsRepo?: TicketsRepo) {
		this.ticketsRepo = ticketsRepo ?? new TicketsRepo(postgres(defaultPostgresOptions));
	}

	async listTickets(): Promise<Result<Ticket[]> | Error> {
		try {
			const tickets = await this.ticketsRepo.findAll();
			return { ok: true, data: tickets, code: 200 };
		} catch (error) {
			log.error('Error listing tickets:', error);
			return { ok: false, error: 'Failed to list tickets', code: 500 };
		}
	}

	async getTicket(id: string): Promise<Result<Ticket> | Error> {
		const validId = parseId(id, 'ticketId');
		if (!validId.ok) return { ok: false, error: validId.error, code: 400 };

		try {
			const ticket = await this.ticketsRepo.findById(validId.value);
			if (!ticket) return { ok: false, error: 'Ticket not found', code: 404 };
			return { ok: true, data: ticket, code: 200 };
		} catch (error) {
			log.error('Error getting ticket:', error);
			return { ok: false, error: 'Failed to get ticket', code: 500 };
		}
	}

	async createTicket(creatorSub: string, input: unknown): Promise<Result<Ticket> | Error> {
		if (!creatorSub) {
			return { ok: false, error: 'creatorSub is required', code: 400 };
		}
		if (!isObject(input)) {
			return { ok: false, error: 'request body must be an object', code: 400 };
		}
		const validTitle = parseText(input.title, 'title');
		if (!validTitle.ok) return { ok: false, error: validTitle.error, code: 400 };

		const create: {
			title: string;
			body?: string;
			status?: TicketStatus;
			owner_sub?: string | null;
		} = { title: validTitle.value };
		if (input.body !== undefined) {
			const validBody = parseBody(input.body);
			if (!validBody.ok) return { ok: false, error: validBody.error, code: 400 };
			create.body = validBody.value;
		}
		if (input.status !== undefined) {
			const validStatus = parseStatus(input.status);
			if (!validStatus.ok) return { ok: false, error: validStatus.error, code: 400 };
			create.status = validStatus.value;
		}
		if (input.owner_sub !== undefined) {
			const validOwner = parseOwnerSub(input.owner_sub);
			if (!validOwner.ok) return { ok: false, error: validOwner.error, code: 400 };
			create.owner_sub = validOwner.value;
		}

		try {
			const ticket = await this.ticketsRepo.create(creatorSub, create);
			return { ok: true, data: ticket, code: 201 };
		} catch (error) {
			if (isForeignKeyViolation(error)) {
				return { ok: false, error: 'owner does not exist', code: 400 };
			}
			log.error('Error creating ticket:', error);
			return { ok: false, error: 'Failed to create ticket', code: 500 };
		}
	}

	async updateTicket(id: string, input: unknown): Promise<Result<Ticket> | Error> {
		const validId = parseId(id, 'ticketId');
		if (!validId.ok) return { ok: false, error: validId.error, code: 400 };
		if (!isObject(input)) {
			return { ok: false, error: 'request body must be an object', code: 400 };
		}

		const changes: TicketChanges = {};
		if (input.title !== undefined) {
			const validTitle = parseText(input.title, 'title');
			if (!validTitle.ok) return { ok: false, error: validTitle.error, code: 400 };
			changes.title = validTitle.value;
		}
		if (input.body !== undefined) {
			const validBody = parseBody(input.body);
			if (!validBody.ok) return { ok: false, error: validBody.error, code: 400 };
			changes.body = validBody.value;
		}
		if (input.status !== undefined) {
			const validStatus = parseStatus(input.status);
			if (!validStatus.ok) return { ok: false, error: validStatus.error, code: 400 };
			changes.status = validStatus.value;
		}
		if (input.owner_sub !== undefined) {
			const validOwner = parseOwnerSub(input.owner_sub);
			if (!validOwner.ok) return { ok: false, error: validOwner.error, code: 400 };
			changes.owner_sub = validOwner.value;
		}
		if (Object.keys(changes).length === 0) {
			return { ok: false, error: 'no changes provided', code: 400 };
		}

		try {
			const ticket = await this.ticketsRepo.update(validId.value, changes);
			if (!ticket) return { ok: false, error: 'Ticket not found', code: 404 };
			return { ok: true, data: ticket, code: 200 };
		} catch (error) {
			if (isForeignKeyViolation(error)) {
				return { ok: false, error: 'owner does not exist', code: 400 };
			}
			log.error('Error updating ticket:', error);
			return { ok: false, error: 'Failed to update ticket', code: 500 };
		}
	}

	async deleteTicket(id: string): Promise<Result<null> | Error> {
		const validId = parseId(id, 'ticketId');
		if (!validId.ok) return { ok: false, error: validId.error, code: 400 };

		try {
			const deleted = await this.ticketsRepo.delete(validId.value);
			if (!deleted) return { ok: false, error: 'Ticket not found', code: 404 };
			return { ok: true, data: null, code: 204 };
		} catch (error) {
			log.error('Error deleting ticket:', error);
			return { ok: false, error: 'Failed to delete ticket', code: 500 };
		}
	}
}
