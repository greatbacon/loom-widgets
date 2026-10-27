import { describe, it, expect, beforeEach } from 'vitest';
import sinon from 'sinon';
import { TodoItemsService } from './todoItemsService.server';
import type { TodoListsRepo } from './todoListsRepo';
import type { TodoItemsRepo } from './todoItemsRepo';
import type { TodoItem, TodoList } from './todo';

const LIST_ID = '123e4567-e89b-12d3-a456-426614174000';
const ITEM_ID = '223e4567-e89b-12d3-a456-426614174000';

const makeList = (): TodoList => ({
	id: LIST_ID,
	author_sub: 'kc-user-1',
	name: 'Groceries',
	position: 0,
	created_at: new Date('2026-01-01T00:00:00Z'),
	updated_at: null
});

const makeItem = (overrides: Partial<TodoItem> = {}): TodoItem => ({
	id: ITEM_ID,
	list_id: LIST_ID,
	author_sub: 'kc-user-1',
	content: 'milk',
	position: 0,
	completed: false,
	created_at: new Date('2026-01-01T00:00:00Z'),
	updated_at: null,
	...overrides
});

describe('TodoItemsService', () => {
	let itemsRepo: Record<'findByList' | 'create' | 'update' | 'delete', sinon.SinonStub>;
	let listsRepo: { findById: sinon.SinonStub };
	let service: TodoItemsService;

	beforeEach(() => {
		itemsRepo = {
			findByList: sinon.stub(),
			create: sinon.stub(),
			update: sinon.stub(),
			delete: sinon.stub()
		};
		listsRepo = { findById: sinon.stub() };
		service = new TodoItemsService(
			itemsRepo as unknown as TodoItemsRepo,
			listsRepo as unknown as TodoListsRepo
		);
	});

	describe('listItems', () => {
		it('rejects a non-uuid list id', async () => {
			expect(await service.listItems('nope')).toMatchObject({ ok: false, code: 400 });
			expect(listsRepo.findById.called).toBe(false);
		});

		it('returns 404 when the list is missing', async () => {
			listsRepo.findById.resolves(undefined);

			expect(await service.listItems(LIST_ID)).toEqual({
				ok: false,
				error: 'List not found',
				code: 404
			});
			expect(itemsRepo.findByList.called).toBe(false);
		});

		it('returns the items', async () => {
			const items = [makeItem()];
			listsRepo.findById.resolves(makeList());
			itemsRepo.findByList.resolves(items);

			expect(await service.listItems(LIST_ID)).toEqual({ ok: true, data: items, code: 200 });
		});

		it('maps repo failure to 500', async () => {
			listsRepo.findById.rejects(new Error('boom'));

			expect(await service.listItems(LIST_ID)).toEqual({
				ok: false,
				error: 'Failed to list items',
				code: 500
			});
		});
	});

	describe('createItem', () => {
		it('rejects a missing author', async () => {
			expect(await service.createItem(LIST_ID, '', 'milk')).toMatchObject({ code: 400 });
			expect(itemsRepo.create.called).toBe(false);
		});

		it('rejects a non-uuid list id', async () => {
			expect(await service.createItem('nope', 'sub', 'milk')).toMatchObject({ code: 400 });
			expect(itemsRepo.create.called).toBe(false);
		});

		it.each([['  '], [''], [5], [undefined]])('rejects content %j', async (content) => {
			expect(await service.createItem(LIST_ID, 'sub', content)).toMatchObject({ code: 400 });
			expect(itemsRepo.create.called).toBe(false);
		});

		it('creates with trimmed content and returns 201', async () => {
			const item = makeItem();
			itemsRepo.create.resolves(item);

			const result = await service.createItem(LIST_ID, 'kc-user-1', ' milk ');

			expect(result).toEqual({ ok: true, data: item, code: 201 });
			expect(itemsRepo.create.calledWith(LIST_ID, 'kc-user-1', 'milk')).toBe(true);
		});

		it('returns 404 when the list is missing', async () => {
			itemsRepo.create.resolves(undefined);

			expect(await service.createItem(LIST_ID, 'sub', 'milk')).toEqual({
				ok: false,
				error: 'List not found',
				code: 404
			});
		});

		it('maps repo failure to 500', async () => {
			itemsRepo.create.rejects(new Error('boom'));

			expect(await service.createItem(LIST_ID, 'sub', 'milk')).toEqual({
				ok: false,
				error: 'Failed to create item',
				code: 500
			});
		});
	});

	describe('updateItem', () => {
		it('rejects non-uuid ids', async () => {
			expect(await service.updateItem('nope', ITEM_ID, { content: 'x' })).toMatchObject({
				code: 400
			});
			expect(await service.updateItem(LIST_ID, 'nope', { content: 'x' })).toMatchObject({
				code: 400
			});
			expect(itemsRepo.update.called).toBe(false);
		});

		it('rejects an empty body or unknown fields only', async () => {
			expect(await service.updateItem(LIST_ID, ITEM_ID, {})).toMatchObject({ code: 400 });
			expect(await service.updateItem(LIST_ID, ITEM_ID, { foo: 1 } as object)).toMatchObject({
				code: 400
			});
			expect(itemsRepo.update.called).toBe(false);
		});

		it('rejects invalid field values', async () => {
			expect(await service.updateItem(LIST_ID, ITEM_ID, { content: ' ' })).toMatchObject({
				code: 400
			});
			expect(await service.updateItem(LIST_ID, ITEM_ID, { completed: 'yes' })).toMatchObject({
				code: 400
			});
			expect(await service.updateItem(LIST_ID, ITEM_ID, { position: -1 })).toMatchObject({
				code: 400
			});
			expect(itemsRepo.update.called).toBe(false);
		});

		it('passes validated changes to the repo', async () => {
			const item = makeItem({ content: 'oat milk', completed: true, position: 2 });
			itemsRepo.update.resolves(item);

			const result = await service.updateItem(LIST_ID, ITEM_ID, {
				content: ' oat milk ',
				completed: true,
				position: 2
			});

			expect(result).toEqual({ ok: true, data: item, code: 200 });
			expect(
				itemsRepo.update.calledWith(LIST_ID, ITEM_ID, {
					content: 'oat milk',
					completed: true,
					position: 2
				})
			).toBe(true);
		});

		it('accepts completed false', async () => {
			itemsRepo.update.resolves(makeItem());

			expect(await service.updateItem(LIST_ID, ITEM_ID, { completed: false })).toMatchObject({
				ok: true
			});
			expect(itemsRepo.update.calledWith(LIST_ID, ITEM_ID, { completed: false })).toBe(true);
		});

		it('returns 404 when the item is missing or in another list', async () => {
			itemsRepo.update.resolves(undefined);

			expect(await service.updateItem(LIST_ID, ITEM_ID, { completed: true })).toEqual({
				ok: false,
				error: 'Item not found',
				code: 404
			});
		});

		it('maps repo failure to 500', async () => {
			itemsRepo.update.rejects(new Error('boom'));

			expect(await service.updateItem(LIST_ID, ITEM_ID, { completed: true })).toEqual({
				ok: false,
				error: 'Failed to update item',
				code: 500
			});
		});
	});

	describe('deleteItem', () => {
		it('rejects non-uuid ids', async () => {
			expect(await service.deleteItem('nope', ITEM_ID)).toMatchObject({ code: 400 });
			expect(await service.deleteItem(LIST_ID, 'nope')).toMatchObject({ code: 400 });
			expect(itemsRepo.delete.called).toBe(false);
		});

		it('returns 204 on success', async () => {
			itemsRepo.delete.resolves(true);

			expect(await service.deleteItem(LIST_ID, ITEM_ID)).toEqual({
				ok: true,
				data: null,
				code: 204
			});
		});

		it('returns 404 when missing', async () => {
			itemsRepo.delete.resolves(false);

			expect(await service.deleteItem(LIST_ID, ITEM_ID)).toMatchObject({ ok: false, code: 404 });
		});

		it('maps repo failure to 500', async () => {
			itemsRepo.delete.rejects(new Error('boom'));

			expect(await service.deleteItem(LIST_ID, ITEM_ID)).toEqual({
				ok: false,
				error: 'Failed to delete item',
				code: 500
			});
		});
	});
});
