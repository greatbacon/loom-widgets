import { describe, it, expect, vi, beforeEach } from 'vitest';

const getList = vi.hoisted(() => vi.fn());
const updateList = vi.hoisted(() => vi.fn());
const deleteList = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/todo/todoListsService.server', () => ({
	TodoListsService: vi.fn().mockImplementation(function TodoListsService() {
		return { getList, updateList, deleteList };
	})
}));

const { GET, PATCH, DELETE } = await import('./+server');

const params = { listId: 'list-1' };

function patchEvent(body: string) {
	return {
		params,
		request: new Request('http://localhost/todo/lists/list-1', { method: 'PATCH', body })
	} as unknown as Parameters<typeof PATCH>[0];
}

describe('/todo/lists/[listId]', () => {
	beforeEach(() => {
		getList.mockReset();
		updateList.mockReset();
		deleteList.mockReset();
	});

	it('GET forwards the id and returns the list with items', async () => {
		getList.mockResolvedValue({ ok: true, data: { id: 'list-1', items: [] }, code: 200 });

		const response = await GET({ params } as unknown as Parameters<typeof GET>[0]);

		expect(getList).toHaveBeenCalledWith('list-1');
		expect(await response.json()).toEqual({ id: 'list-1', items: [] });
	});

	it('GET maps 404', async () => {
		getList.mockResolvedValue({ ok: false, error: 'List not found', code: 404 });

		await expect(GET({ params } as unknown as Parameters<typeof GET>[0])).rejects.toMatchObject({
			status: 404,
			body: { message: 'List not found' }
		});
	});

	it('PATCH forwards only name and position', async () => {
		updateList.mockResolvedValue({ ok: true, data: { id: 'list-1' }, code: 200 });

		const response = await PATCH(patchEvent('{"name":"N","position":2,"author_sub":"evil"}'));

		expect(updateList).toHaveBeenCalledWith('list-1', { name: 'N', position: 2 });
		expect(response.status).toBe(200);
	});

	it('PATCH returns 400 on malformed JSON', async () => {
		await expect(PATCH(patchEvent('{bad'))).rejects.toMatchObject({ status: 400 });
		expect(updateList).not.toHaveBeenCalled();
	});

	it('PATCH forwards service errors', async () => {
		updateList.mockResolvedValue({ ok: false, error: 'List not found', code: 404 });

		await expect(PATCH(patchEvent('{"name":"N"}'))).rejects.toMatchObject({ status: 404 });
	});

	it('DELETE returns 204', async () => {
		deleteList.mockResolvedValue({ ok: true, data: null, code: 204 });

		const response = await DELETE({ params } as unknown as Parameters<typeof DELETE>[0]);

		expect(deleteList).toHaveBeenCalledWith('list-1');
		expect(response.status).toBe(204);
	});

	it('DELETE maps 404', async () => {
		deleteList.mockResolvedValue({ ok: false, error: 'List not found', code: 404 });

		await expect(
			DELETE({ params } as unknown as Parameters<typeof DELETE>[0])
		).rejects.toMatchObject({ status: 404 });
	});
});
