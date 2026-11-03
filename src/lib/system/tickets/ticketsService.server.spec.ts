import { describe, it, expect, beforeEach } from 'vitest';
import sinon from 'sinon';
import { TicketsService } from './ticketsService.server';
import type { TicketsRepo } from './ticketsRepo';
import type { Ticket } from './ticket';

const TICKET_ID = '123e4567-e89b-12d3-a456-426614174000';

const makeTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
	id: TICKET_ID,
	creator_sub: 'kc-user-1',
	owner_sub: null,
	title: 'Fix bug',
	body: '',
	status: 'backlog',
	created_at: new Date('2026-01-01T00:00:00Z'),
	updated_at: null,
	...overrides
});

const fkError = () => Object.assign(new Error('fk'), { code: '23503' });

describe('TicketsService', () => {
	let repo: Record<'findAll' | 'findById' | 'create' | 'update' | 'delete', sinon.SinonStub>;
	let service: TicketsService;

	beforeEach(() => {
		repo = {
			findAll: sinon.stub(),
			findById: sinon.stub(),
			create: sinon.stub(),
			update: sinon.stub(),
			delete: sinon.stub()
		};
		service = new TicketsService(repo as unknown as TicketsRepo);
	});

	describe('listTickets', () => {
		it('returns tickets', async () => {
			const tickets = [makeTicket()];
			repo.findAll.resolves(tickets);
			expect(await service.listTickets()).toEqual({ ok: true, data: tickets, code: 200 });
		});

		it('maps repo failure to 500', async () => {
			repo.findAll.rejects(new Error('boom'));
			expect(await service.listTickets()).toEqual({
				ok: false,
				error: 'Failed to list tickets',
				code: 500
			});
		});
	});

	describe('getTicket', () => {
		it('rejects an invalid id with 400', async () => {
			const result = await service.getTicket('nope');
			expect(result).toEqual({ ok: false, error: 'ticketId must be a valid id', code: 400 });
			expect(repo.findById.called).toBe(false);
		});

		it('returns 404 when missing', async () => {
			repo.findById.resolves(undefined);
			expect(await service.getTicket(TICKET_ID)).toEqual({
				ok: false,
				error: 'Ticket not found',
				code: 404
			});
		});

		it('returns the ticket', async () => {
			const ticket = makeTicket();
			repo.findById.resolves(ticket);
			expect(await service.getTicket(TICKET_ID)).toEqual({ ok: true, data: ticket, code: 200 });
		});
	});

	describe('createTicket', () => {
		it('creates with 201 and trims title', async () => {
			const ticket = makeTicket();
			repo.create.resolves(ticket);
			const result = await service.createTicket('kc-user-1', { title: '  Fix bug  ' });
			expect(result).toEqual({ ok: true, data: ticket, code: 201 });
			expect(repo.create.calledOnceWithExactly('kc-user-1', { title: 'Fix bug' })).toBe(true);
		});

		it('passes through optional fields when provided', async () => {
			repo.create.resolves(makeTicket());
			await service.createTicket('kc-user-1', {
				title: 'T',
				body: 'details',
				status: 'todo',
				owner_sub: 'kc-user-2'
			});
			expect(
				repo.create.calledOnceWithExactly('kc-user-1', {
					title: 'T',
					body: 'details',
					status: 'todo',
					owner_sub: 'kc-user-2'
				})
			).toBe(true);
		});

		it('rejects missing or blank title', async () => {
			for (const input of [{}, { title: '   ' }]) {
				const result = await service.createTicket('kc-user-1', input);
				expect(result).toMatchObject({ ok: false, code: 400 });
			}
			expect(repo.create.called).toBe(false);
		});

		it('rejects non-object input and missing creator', async () => {
			expect(await service.createTicket('kc-user-1', 'x')).toMatchObject({ code: 400 });
			expect(await service.createTicket('', { title: 'T' })).toMatchObject({ code: 400 });
		});

		it('rejects a bad status', async () => {
			const result = await service.createTicket('kc-user-1', { title: 'T', status: 'nope' });
			expect(result).toMatchObject({ ok: false, code: 400 });
			expect(repo.create.called).toBe(false);
		});

		it('maps FK violation to 400', async () => {
			repo.create.rejects(fkError());
			expect(await service.createTicket('kc-user-1', { title: 'T', owner_sub: 'ghost' })).toEqual({
				ok: false,
				error: 'owner does not exist',
				code: 400
			});
		});

		it('maps other failures to 500', async () => {
			repo.create.rejects(new Error('boom'));
			expect(await service.createTicket('kc-user-1', { title: 'T' })).toEqual({
				ok: false,
				error: 'Failed to create ticket',
				code: 500
			});
		});
	});

	describe('updateTicket', () => {
		it('updates and returns 200', async () => {
			const ticket = makeTicket({ status: 'done' });
			repo.update.resolves(ticket);
			const result = await service.updateTicket(TICKET_ID, { status: 'done' });
			expect(result).toEqual({ ok: true, data: ticket, code: 200 });
			expect(repo.update.calledOnceWithExactly(TICKET_ID, { status: 'done' })).toBe(true);
		});

		it('rejects empty changes', async () => {
			expect(await service.updateTicket(TICKET_ID, {})).toEqual({
				ok: false,
				error: 'no changes provided',
				code: 400
			});
			expect(repo.update.called).toBe(false);
		});

		it('forwards owner_sub null to unassign', async () => {
			repo.update.resolves(makeTicket());
			await service.updateTicket(TICKET_ID, { owner_sub: null });
			expect(repo.update.firstCall.args[1]).toEqual({ owner_sub: null });
		});

		it('returns 404 when missing', async () => {
			repo.update.resolves(undefined);
			expect(await service.updateTicket(TICKET_ID, { title: 'x' })).toEqual({
				ok: false,
				error: 'Ticket not found',
				code: 404
			});
		});

		it('rejects a bad status, bad id, and non-object input', async () => {
			expect(await service.updateTicket(TICKET_ID, { status: 'nope' })).toMatchObject({
				code: 400
			});
			expect(await service.updateTicket('bad', { title: 'x' })).toMatchObject({ code: 400 });
			expect(await service.updateTicket(TICKET_ID, null)).toMatchObject({ code: 400 });
		});

		it('maps FK violation to 400 and other failures to 500', async () => {
			repo.update.rejects(fkError());
			expect(await service.updateTicket(TICKET_ID, { owner_sub: 'ghost' })).toEqual({
				ok: false,
				error: 'owner does not exist',
				code: 400
			});
			repo.update.rejects(new Error('boom'));
			expect(await service.updateTicket(TICKET_ID, { title: 'x' })).toEqual({
				ok: false,
				error: 'Failed to update ticket',
				code: 500
			});
		});
	});

	describe('deleteTicket', () => {
		it('returns 204 on delete', async () => {
			repo.delete.resolves(true);
			expect(await service.deleteTicket(TICKET_ID)).toEqual({ ok: true, data: null, code: 204 });
		});

		it('returns 404 when missing', async () => {
			repo.delete.resolves(false);
			expect(await service.deleteTicket(TICKET_ID)).toEqual({
				ok: false,
				error: 'Ticket not found',
				code: 404
			});
		});

		it('rejects an invalid id', async () => {
			expect(await service.deleteTicket('bad')).toMatchObject({ ok: false, code: 400 });
		});
	});
});
