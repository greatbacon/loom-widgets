import { describe, it, expect, beforeEach } from 'vitest';
import sinon from 'sinon';
import { TodoListsService } from './todoListsService.server';
import type { TodoListsRepo } from './todoListsRepo';
import type { TodoItemsRepo } from './todoItemsRepo';
import type { TodoItem, TodoList } from './todo';

const LIST_ID = '123e4567-e89b-12d3-a456-426614174000';

const makeList = (overrides: Partial<TodoList> = {}): TodoList => ({
	id: LIST_ID,
	author_sub: 'kc-user-1',
	name: 'Groceries',
	position: 0,
	created_at: new Date('2026-01-01T00:00:00Z'),
	updated_at: null,
	...overrides
});

const makeItem = (overrides: Partial<TodoItem> = {}): TodoItem => ({
	id: '223e4567-e89b-12d3-a456-426614174000',
	list_id: LIST_ID,
	author_sub: 'kc-user-1',
	content: 'milk',
	position: 0,
	completed: false,
	created_at: new Date('2026-01-01T00:00:00Z'),
	updated_at: null,
	...overrides
});

describe('TodoListsService', () => {
	let listsRepo: Record<'findAll' | 'findById' | 'create' | 'update' | 'delete', sinon.SinonStub>;
	let itemsRepo: Record<'findAll' | 'findByList', sinon.SinonStub>;
	let service: TodoListsService;

	beforeEach(() => {
		listsRepo = {
			findAll: sinon.stub(),
			findById: sinon.stub(),
			create: sinon.stub(),
			update: sinon.stub(),
			delete: sinon.stub()
		};
		itemsRepo = { findAll: sinon.stub(), findByList: sinon.stub() };
		service = new TodoListsService(
			listsRepo as unknown as TodoListsRepo,
			itemsRepo as unknown as TodoItemsRepo
		);
	});

	describe('listLists', () => {
		it('returns lists', async () => {
			const lists = [makeList()];
			listsRepo.findAll.resolves(lists);

			expect(await service.listLists()).toEqual({ ok: true, data: lists, code: 200 });
		});

		it('maps repo failure to 500', async () => {
			listsRepo.findAll.rejects(new Error('select * from secrets'));

			expect(await service.listLists()).toEqual({
				ok: false,
				error: 'Failed to list lists',
				code: 500
			});
		});
	});

	describe('listListsWithItems', () => {
		const OTHER_LIST_ID = '323e4567-e89b-12d3-a456-426614174000';

		it('groups items under their list in repo order', async () => {
			const listA = makeList();
			const listB = makeList({ id: OTHER_LIST_ID, name: 'Chores', position: 1 });
			const a0 = makeItem({ id: 'a0', position: 0 });
			const b0 = makeItem({ id: 'b0', list_id: OTHER_LIST_ID, position: 0 });
			const a1 = makeItem({ id: 'a1', position: 1 });
			listsRepo.findAll.resolves([listA, listB]);
			itemsRepo.findAll.resolves([a0, a1, b0]);

			expect(await service.listListsWithItems()).toEqual({
				ok: true,
				data: [
					{ ...listA, items: [a0, a1] },
					{ ...listB, items: [b0] }
				],
				code: 200
			});
		});

		it('gives a list with no items an empty array', async () => {
			const list = makeList();
			listsRepo.findAll.resolves([list]);
			itemsRepo.findAll.resolves([]);

			expect(await service.listListsWithItems()).toEqual({
				ok: true,
				data: [{ ...list, items: [] }],
				code: 200
			});
		});

		it('preserves list order', async () => {
			const first = makeList({ id: OTHER_LIST_ID, name: 'First', position: 0 });
			const second = makeList({ name: 'Second', position: 1 });
			listsRepo.findAll.resolves([first, second]);
			itemsRepo.findAll.resolves([]);

			const result = await service.listListsWithItems();

			expect(result.ok && result.data.map((l) => l.name)).toEqual(['First', 'Second']);
		});

		it('maps repo failure to 500', async () => {
			listsRepo.findAll.resolves([]);
			itemsRepo.findAll.rejects(new Error('boom'));

			expect(await service.listListsWithItems()).toEqual({
				ok: false,
				error: 'Failed to list lists',
				code: 500
			});
		});
	});

	describe('getList', () => {
		it('rejects a non-uuid id', async () => {
			const result = await service.getList('nope');

			expect(result).toMatchObject({ ok: false, code: 400 });
			expect(listsRepo.findById.called).toBe(false);
		});

		it('returns 404 when missing', async () => {
			listsRepo.findById.resolves(undefined);

			expect(await service.getList(LIST_ID)).toEqual({
				ok: false,
				error: 'List not found',
				code: 404
			});
			expect(itemsRepo.findByList.called).toBe(false);
		});

		it('combines the list with its items', async () => {
			const list = makeList();
			const items = [makeItem()];
			listsRepo.findById.resolves(list);
			itemsRepo.findByList.resolves(items);

			expect(await service.getList(LIST_ID)).toEqual({
				ok: true,
				data: { ...list, items },
				code: 200
			});
			expect(itemsRepo.findByList.calledWith(LIST_ID)).toBe(true);
		});

		it('maps repo failure to 500', async () => {
			listsRepo.findById.rejects(new Error('boom'));

			expect(await service.getList(LIST_ID)).toMatchObject({ ok: false, code: 500 });
		});
	});

	describe('createList', () => {
		it('rejects a missing author', async () => {
			const result = await service.createList('', 'Groceries');

			expect(result).toEqual({ ok: false, error: 'authorSub is required', code: 400 });
			expect(listsRepo.create.called).toBe(false);
		});

		it.each([['   '], [''], [42], [undefined]])('rejects name %j', async (name) => {
			const result = await service.createList('sub', name);

			expect(result).toMatchObject({ ok: false, code: 400 });
			expect(listsRepo.create.called).toBe(false);
		});

		it('creates with a trimmed name and returns 201', async () => {
			const list = makeList();
			listsRepo.create.resolves(list);

			const result = await service.createList('kc-user-1', '  Groceries  ');

			expect(result).toEqual({ ok: true, data: list, code: 201 });
			expect(listsRepo.create.calledWith('kc-user-1', 'Groceries')).toBe(true);
		});

		it('maps repo failure to 500', async () => {
			listsRepo.create.rejects(new Error('boom'));

			expect(await service.createList('sub', 'x')).toEqual({
				ok: false,
				error: 'Failed to create list',
				code: 500
			});
		});
	});

	describe('updateList', () => {
		it('rejects a non-uuid id', async () => {
			expect(await service.updateList('nope', { name: 'x' })).toMatchObject({ code: 400 });
			expect(listsRepo.update.called).toBe(false);
		});

		it('rejects an empty body', async () => {
			expect(await service.updateList(LIST_ID, {})).toMatchObject({ ok: false, code: 400 });
			expect(await service.updateList(LIST_ID, { other: 1 } as object)).toMatchObject({
				code: 400
			});
			expect(listsRepo.update.called).toBe(false);
		});

		it('rejects a blank name', async () => {
			expect(await service.updateList(LIST_ID, { name: ' ' })).toMatchObject({ code: 400 });
			expect(listsRepo.update.called).toBe(false);
		});

		it.each([[-1], [1.5], ['1'], [null]])('rejects position %j', async (position) => {
			expect(await service.updateList(LIST_ID, { position })).toMatchObject({ code: 400 });
			expect(listsRepo.update.called).toBe(false);
		});

		it('passes validated changes to the repo', async () => {
			const list = makeList({ name: 'New', position: 2 });
			listsRepo.update.resolves(list);

			const result = await service.updateList(LIST_ID, { name: ' New ', position: 2 });

			expect(result).toEqual({ ok: true, data: list, code: 200 });
			expect(listsRepo.update.calledWith(LIST_ID, { name: 'New', position: 2 })).toBe(true);
		});

		it('accepts position 0', async () => {
			listsRepo.update.resolves(makeList());

			expect(await service.updateList(LIST_ID, { position: 0 })).toMatchObject({ ok: true });
			expect(listsRepo.update.calledWith(LIST_ID, { position: 0 })).toBe(true);
		});

		it('returns 404 when missing', async () => {
			listsRepo.update.resolves(undefined);

			expect(await service.updateList(LIST_ID, { name: 'x' })).toEqual({
				ok: false,
				error: 'List not found',
				code: 404
			});
		});

		it('maps repo failure to 500', async () => {
			listsRepo.update.rejects(new Error('boom'));

			expect(await service.updateList(LIST_ID, { name: 'x' })).toEqual({
				ok: false,
				error: 'Failed to update list',
				code: 500
			});
		});
	});

	describe('deleteList', () => {
		it('rejects a non-uuid id', async () => {
			expect(await service.deleteList('nope')).toMatchObject({ code: 400 });
			expect(listsRepo.delete.called).toBe(false);
		});

		it('returns 204 on success', async () => {
			listsRepo.delete.resolves(true);

			expect(await service.deleteList(LIST_ID)).toEqual({ ok: true, data: null, code: 204 });
		});

		it('returns 404 when missing', async () => {
			listsRepo.delete.resolves(false);

			expect(await service.deleteList(LIST_ID)).toMatchObject({ ok: false, code: 404 });
		});

		it('maps repo failure to 500', async () => {
			listsRepo.delete.rejects(new Error('boom'));

			expect(await service.deleteList(LIST_ID)).toEqual({
				ok: false,
				error: 'Failed to delete list',
				code: 500
			});
		});
	});
});
