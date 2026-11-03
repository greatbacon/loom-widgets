import { describe, it, expect, vi, beforeEach } from 'vitest';

const listTickets = vi.hoisted(() => vi.fn());
const createTicket = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/tickets/ticketsService.server', () => ({
	TicketsService: vi.fn().mockImplementation(function TicketsService() {
		return { listTickets, createTicket };
	})
}));

const { GET, POST } = await import('./+server');

function postEvent(body: string, locals: { keycloakSubject?: string }) {
	return {
		request: new Request('http://localhost/kanban', { method: 'POST', body }),
		locals
	} as unknown as Parameters<typeof POST>[0];
}

describe('/kanban', () => {
	beforeEach(() => {
		listTickets.mockReset();
		createTicket.mockReset();
	});

	it('GET returns the tickets', async () => {
		listTickets.mockResolvedValue({ ok: true, data: [{ id: 'a' }], code: 200 });

		const response = await GET({} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual([{ id: 'a' }]);
	});

	it('GET throws a SvelteKit error on a non-ok result', async () => {
		listTickets.mockResolvedValue({ ok: false, error: 'Failed to list tickets', code: 500 });

		await expect(GET({} as Parameters<typeof GET>[0])).rejects.toMatchObject({
			status: 500,
			body: { message: 'Failed to list tickets' }
		});
	});

	it('POST passes the creator and parsed body and returns 201', async () => {
		createTicket.mockResolvedValue({ ok: true, data: { id: 'a' }, code: 201 });

		const response = await POST(postEvent('{"title":"Fix"}', { keycloakSubject: 'sub-1' }));

		expect(createTicket).toHaveBeenCalledWith('sub-1', { title: 'Fix' });
		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ id: 'a' });
	});

	it('POST returns 401 without a keycloakSubject', async () => {
		await expect(POST(postEvent('{"title":"x"}', {}))).rejects.toMatchObject({ status: 401 });
		expect(createTicket).not.toHaveBeenCalled();
	});

	it('POST returns 400 on malformed JSON', async () => {
		await expect(POST(postEvent('{bad', { keycloakSubject: 'sub-1' }))).rejects.toMatchObject({
			status: 400,
			body: { message: 'Invalid JSON body' }
		});
	});

	it('POST propagates a service 400', async () => {
		createTicket.mockResolvedValue({ ok: false, error: 'title is required', code: 400 });

		await expect(
			POST(postEvent('{"title":" "}', { keycloakSubject: 'sub-1' }))
		).rejects.toMatchObject({ status: 400, body: { message: 'title is required' } });
	});
});
