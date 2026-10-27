import { describe, it, expect, vi, beforeEach } from 'vitest';

const listItems = vi.hoisted(() => vi.fn());
const createItem = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/todo/todoItemsService.server', () => ({
	TodoItemsService: vi.fn().mockImplementation(function TodoItemsService() {
		return { listItems, createItem };
	})
}));

const { GET, POST } = await import('./+server');

const params = { listId: 'list-1' };

function postEvent(body: string, locals: { keycloakSubject?: string }) {
	return {
		params,
		locals,
		request: new Request('http://localhost/todo/lists/list-1/items', { method: 'POST', body })
	} as unknown as Parameters<typeof POST>[0];
}

describe('/todo/lists/[listId]/items', () => {
	beforeEach(() => {
		listItems.mockReset();
		createItem.mockReset();
	});

	it('GET forwards the list id and returns items', async () => {
		listItems.mockResolvedValue({ ok: true, data: [{ id: 'i' }], code: 200 });

		const response = await GET({ params } as unknown as Parameters<typeof GET>[0]);

		expect(listItems).toHaveBeenCalledWith('list-1');
		expect(await response.json()).toEqual([{ id: 'i' }]);
	});

	it('GET maps 404', async () => {
		listItems.mockResolvedValue({ ok: false, error: 'List not found', code: 404 });

		await expect(GET({ params } as unknown as Parameters<typeof GET>[0])).rejects.toMatchObject({
			status: 404
		});
	});

	it('POST forwards params, author and content, returning 201', async () => {
		createItem.mockResolvedValue({ ok: true, data: { id: 'i' }, code: 201 });

		const response = await POST(postEvent('{"content":"milk"}', { keycloakSubject: 'sub-1' }));

		expect(createItem).toHaveBeenCalledWith('list-1', 'sub-1', 'milk');
		expect(response.status).toBe(201);
	});

	it('POST returns 401 without a keycloakSubject', async () => {
		await expect(POST(postEvent('{"content":"milk"}', {}))).rejects.toMatchObject({
			status: 401
		});
		expect(createItem).not.toHaveBeenCalled();
	});

	it('POST returns 400 on malformed JSON', async () => {
		await expect(POST(postEvent('{bad', { keycloakSubject: 'sub-1' }))).rejects.toMatchObject({
			status: 400
		});
	});

	it('POST forwards service errors', async () => {
		createItem.mockResolvedValue({ ok: false, error: 'List not found', code: 404 });

		await expect(
			POST(postEvent('{"content":"milk"}', { keycloakSubject: 'sub-1' }))
		).rejects.toMatchObject({ status: 404 });
	});
});
