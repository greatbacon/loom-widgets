import { describe, it, expect, vi, beforeEach } from 'vitest';

const listTickets = vi.hoisted(() => vi.fn());
const listUsers = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/tickets/ticketsService.server', () => ({
	TicketsService: vi.fn().mockImplementation(function TicketsService() {
		return { listTickets };
	})
}));
vi.mock('$lib/system/users/usersService.server', () => ({
	UsersService: vi.fn().mockImplementation(function UsersService() {
		return { listUsers };
	})
}));

const { load } = await import('./+page.server');

const run = () => load({} as Parameters<typeof load>[0]) as Promise<Record<string, unknown>>;

describe('/kanban load', () => {
	beforeEach(() => {
		listTickets.mockReset();
		listUsers.mockReset();
	});

	it('returns tickets and users trimmed to sub and username', async () => {
		listTickets.mockResolvedValue({ ok: true, data: [{ id: 't' }], code: 200 });
		listUsers.mockResolvedValue({
			ok: true,
			data: [{ sub: 's1', username: 'ann', email: 'ann@example.com', iss: 'x' }],
			code: 200
		});

		expect(await run()).toEqual({
			tickets: [{ id: 't' }],
			users: [{ sub: 's1', username: 'ann' }],
			error: null
		});
	});

	it('returns an empty board and the error when tickets fail', async () => {
		listTickets.mockResolvedValue({ ok: false, error: 'Failed to list tickets', code: 500 });
		listUsers.mockResolvedValue({ ok: true, data: [], code: 200 });

		expect(await run()).toMatchObject({ tickets: [], error: 'Failed to list tickets' });
	});

	it('keeps the tickets and sets the error when users fail', async () => {
		listTickets.mockResolvedValue({ ok: true, data: [{ id: 't' }], code: 200 });
		listUsers.mockResolvedValue({ ok: false, error: 'Failed to list users', code: 500 });

		expect(await run()).toEqual({
			tickets: [{ id: 't' }],
			users: [],
			error: 'Failed to list users'
		});
	});
});
