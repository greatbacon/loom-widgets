import { describe, it, expect, vi, beforeEach } from 'vitest';

const listLists = vi.hoisted(() => vi.fn());
const createList = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/todo/todoListsService.server', () => ({
	TodoListsService: vi.fn().mockImplementation(function TodoListsService() {
		return { listLists, createList };
	})
}));

const { GET, POST } = await import('./+server');

function postEvent(body: string, locals: { keycloakSubject?: string }) {
	return {
		request: new Request('http://localhost/todo/lists', { method: 'POST', body }),
		locals
	} as unknown as Parameters<typeof POST>[0];
}

describe('/todo/lists', () => {
	beforeEach(() => {
		listLists.mockReset();
		createList.mockReset();
	});

	it('GET returns the lists', async () => {
		listLists.mockResolvedValue({ ok: true, data: [{ id: 'a' }], code: 200 });

		const response = await GET({} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual([{ id: 'a' }]);
	});

	it('GET throws a SvelteKit error on a non-ok result', async () => {
		listLists.mockResolvedValue({ ok: false, error: 'Failed to list lists', code: 500 });

		await expect(GET({} as Parameters<typeof GET>[0])).rejects.toMatchObject({
			status: 500,
			body: { message: 'Failed to list lists' }
		});
	});

	it('POST creates with the author from locals and returns 201', async () => {
		createList.mockResolvedValue({ ok: true, data: { id: 'a' }, code: 201 });

		const response = await POST(postEvent('{"name":"Groceries"}', { keycloakSubject: 'sub-1' }));

		expect(createList).toHaveBeenCalledWith('sub-1', 'Groceries');
		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ id: 'a' });
	});

	it('POST returns 401 without a keycloakSubject', async () => {
		await expect(POST(postEvent('{"name":"x"}', {}))).rejects.toMatchObject({ status: 401 });
		expect(createList).not.toHaveBeenCalled();
	});

	it('POST returns 400 on malformed JSON', async () => {
		await expect(POST(postEvent('{bad', { keycloakSubject: 'sub-1' }))).rejects.toMatchObject({
			status: 400,
			body: { message: 'Invalid JSON body' }
		});
	});

	it('POST returns 400 when the body is not an object', async () => {
		await expect(POST(postEvent('[1]', { keycloakSubject: 'sub-1' }))).rejects.toMatchObject({
			status: 400
		});
	});

	it('POST forwards service validation errors', async () => {
		createList.mockResolvedValue({
			ok: false,
			error: 'name must be a non-empty string',
			code: 400
		});

		await expect(
			POST(postEvent('{"name":" "}', { keycloakSubject: 'sub-1' }))
		).rejects.toMatchObject({ status: 400, body: { message: 'name must be a non-empty string' } });
	});
});
