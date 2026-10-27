import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateItem = vi.hoisted(() => vi.fn());
const deleteItem = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/todo/todoItemsService.server', () => ({
	TodoItemsService: vi.fn().mockImplementation(function TodoItemsService() {
		return { updateItem, deleteItem };
	})
}));

const { PATCH, DELETE } = await import('./+server');

const params = { listId: 'list-1', itemId: 'item-1' };

function patchEvent(body: string) {
	return {
		params,
		request: new Request('http://localhost/todo/lists/list-1/items/item-1', {
			method: 'PATCH',
			body
		})
	} as unknown as Parameters<typeof PATCH>[0];
}

describe('/todo/lists/[listId]/items/[itemId]', () => {
	beforeEach(() => {
		updateItem.mockReset();
		deleteItem.mockReset();
	});

	it('PATCH forwards params and only the editable fields', async () => {
		updateItem.mockResolvedValue({ ok: true, data: { id: 'item-1' }, code: 200 });

		const response = await PATCH(
			patchEvent('{"content":"c","completed":true,"position":1,"list_id":"other"}')
		);

		expect(updateItem).toHaveBeenCalledWith('list-1', 'item-1', {
			content: 'c',
			completed: true,
			position: 1
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ id: 'item-1' });
	});

	it('PATCH returns 400 on malformed JSON', async () => {
		await expect(PATCH(patchEvent('{bad'))).rejects.toMatchObject({
			status: 400,
			body: { message: 'Invalid JSON body' }
		});
		expect(updateItem).not.toHaveBeenCalled();
	});

	it('PATCH maps 404 for an item in another list', async () => {
		updateItem.mockResolvedValue({ ok: false, error: 'Item not found', code: 404 });

		await expect(PATCH(patchEvent('{"completed":true}'))).rejects.toMatchObject({
			status: 404,
			body: { message: 'Item not found' }
		});
	});

	it('DELETE returns 204', async () => {
		deleteItem.mockResolvedValue({ ok: true, data: null, code: 204 });

		const response = await DELETE({ params } as unknown as Parameters<typeof DELETE>[0]);

		expect(deleteItem).toHaveBeenCalledWith('list-1', 'item-1');
		expect(response.status).toBe(204);
	});

	it('DELETE maps 404', async () => {
		deleteItem.mockResolvedValue({ ok: false, error: 'Item not found', code: 404 });

		await expect(
			DELETE({ params } as unknown as Parameters<typeof DELETE>[0])
		).rejects.toMatchObject({ status: 404 });
	});
});
