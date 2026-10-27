import { describe, it, expect, vi, beforeEach } from 'vitest';

const listListsWithItems = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/todo/todoListsService.server', () => ({
	TodoListsService: vi.fn().mockImplementation(function TodoListsService() {
		return { listListsWithItems };
	})
}));

const { load } = await import('./+page.server');

describe('/todo +page.server', () => {
	beforeEach(() => {
		listListsWithItems.mockReset();
	});

	it('returns lists with their items', async () => {
		const lists = [{ id: 'a', name: 'Groceries', items: [{ id: 'i1', content: 'milk' }] }];
		listListsWithItems.mockResolvedValue({ ok: true, data: lists, code: 200 });

		const result = await load({} as Parameters<typeof load>[0]);

		expect(result).toEqual({ lists, error: null });
	});

	it('returns an empty list and the error on failure', async () => {
		listListsWithItems.mockResolvedValue({ ok: false, error: 'Failed to list lists', code: 500 });

		const result = await load({} as Parameters<typeof load>[0]);

		expect(result).toEqual({ lists: [], error: 'Failed to list lists' });
	});
});
