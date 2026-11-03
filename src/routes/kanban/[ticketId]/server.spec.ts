import { describe, it, expect, vi, beforeEach } from 'vitest';

const getTicket = vi.hoisted(() => vi.fn());
const updateTicket = vi.hoisted(() => vi.fn());
const deleteTicket = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/tickets/ticketsService.server', () => ({
	TicketsService: vi.fn().mockImplementation(function TicketsService() {
		return { getTicket, updateTicket, deleteTicket };
	})
}));

const { GET, PATCH, DELETE } = await import('./+server');

function event(method: string, body?: string) {
	return {
		params: { ticketId: 't-1' },
		request: new Request('http://localhost/kanban/t-1', { method, body })
	} as unknown as Parameters<typeof PATCH>[0];
}

describe('/kanban/[ticketId]', () => {
	beforeEach(() => {
		getTicket.mockReset();
		updateTicket.mockReset();
		deleteTicket.mockReset();
	});

	it('GET returns 200 with the ticket', async () => {
		getTicket.mockResolvedValue({ ok: true, data: { id: 't-1' }, code: 200 });

		const response = await GET(event('GET'));

		expect(getTicket).toHaveBeenCalledWith('t-1');
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ id: 't-1' });
	});

	it('GET propagates 404', async () => {
		getTicket.mockResolvedValue({ ok: false, error: 'Ticket not found', code: 404 });

		await expect(GET(event('GET'))).rejects.toMatchObject({ status: 404 });
	});

	it('PATCH passes the id and body', async () => {
		updateTicket.mockResolvedValue({ ok: true, data: { id: 't-1' }, code: 200 });

		const response = await PATCH(event('PATCH', '{"status":"done"}'));

		expect(updateTicket).toHaveBeenCalledWith('t-1', { status: 'done' });
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ id: 't-1' });
	});

	it('PATCH propagates 400', async () => {
		updateTicket.mockResolvedValue({ ok: false, error: 'no changes provided', code: 400 });

		await expect(PATCH(event('PATCH', '{}'))).rejects.toMatchObject({
			status: 400,
			body: { message: 'no changes provided' }
		});
	});

	it('PATCH propagates 404', async () => {
		updateTicket.mockResolvedValue({ ok: false, error: 'Ticket not found', code: 404 });

		await expect(PATCH(event('PATCH', '{"title":"x"}'))).rejects.toMatchObject({ status: 404 });
	});

	it('DELETE returns 204', async () => {
		deleteTicket.mockResolvedValue({ ok: true, data: undefined, code: 204 });

		const response = await DELETE(event('DELETE'));

		expect(deleteTicket).toHaveBeenCalledWith('t-1');
		expect(response.status).toBe(204);
	});

	it('DELETE propagates 404', async () => {
		deleteTicket.mockResolvedValue({ ok: false, error: 'Ticket not found', code: 404 });

		await expect(DELETE(event('DELETE'))).rejects.toMatchObject({ status: 404 });
	});
});
