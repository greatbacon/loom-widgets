import type { TodoItem } from './todo';
import { TodoListsRepo } from '$lib/system/todo/todoListsRepo';
import { TodoItemsRepo } from '$lib/system/todo/todoItemsRepo';
import { parseBoolean, parseId, parsePosition, parseText } from '$lib/system/todo/validation';
import postgres from 'postgres';
import { defaultPostgresOptions } from '$lib/db/postgres.server';

export interface Result<T> {
	ok: true;
	data: T;
	code: number;
}

export interface Error {
	ok: false;
	error: string;
	code: number;
}

const log = console;

export class TodoItemsService {
	todoItemsRepo: TodoItemsRepo;
	todoListsRepo: TodoListsRepo;

	constructor(todoItemsRepo?: TodoItemsRepo, todoListsRepo?: TodoListsRepo) {
		if (todoItemsRepo && todoListsRepo) {
			this.todoItemsRepo = todoItemsRepo;
			this.todoListsRepo = todoListsRepo;
		} else {
			const sql = postgres(defaultPostgresOptions);
			this.todoItemsRepo = todoItemsRepo || new TodoItemsRepo(sql);
			this.todoListsRepo = todoListsRepo || new TodoListsRepo(sql);
		}
	}

	async listItems(listId: string): Promise<Result<TodoItem[]> | Error> {
		const validListId = parseId(listId, 'listId');
		if (!validListId.ok) return { ok: false, error: validListId.error, code: 400 };

		try {
			const list = await this.todoListsRepo.findById(validListId.value);
			if (!list) return { ok: false, error: 'List not found', code: 404 };
			const items = await this.todoItemsRepo.findByList(validListId.value);
			return { ok: true, data: items, code: 200 };
		} catch (error) {
			log.error('Error listing todo items:', error);
			return { ok: false, error: 'Failed to list items', code: 500 };
		}
	}

	async createItem(
		listId: string,
		authorSub: string,
		content: unknown
	): Promise<Result<TodoItem> | Error> {
		if (!authorSub) {
			return { ok: false, error: 'authorSub is required', code: 400 };
		}
		const validListId = parseId(listId, 'listId');
		if (!validListId.ok) return { ok: false, error: validListId.error, code: 400 };
		const validContent = parseText(content, 'content');
		if (!validContent.ok) return { ok: false, error: validContent.error, code: 400 };

		try {
			const item = await this.todoItemsRepo.create(
				validListId.value,
				authorSub,
				validContent.value
			);
			if (!item) return { ok: false, error: 'List not found', code: 404 };
			return { ok: true, data: item, code: 201 };
		} catch (error) {
			log.error('Error creating todo item:', error);
			return { ok: false, error: 'Failed to create item', code: 500 };
		}
	}

	async updateItem(
		listId: string,
		itemId: string,
		changes: { content?: unknown; completed?: unknown; position?: unknown }
	): Promise<Result<TodoItem> | Error> {
		const validListId = parseId(listId, 'listId');
		if (!validListId.ok) return { ok: false, error: validListId.error, code: 400 };
		const validItemId = parseId(itemId, 'itemId');
		if (!validItemId.ok) return { ok: false, error: validItemId.error, code: 400 };

		const update: { content?: string; completed?: boolean; position?: number } = {};
		if (changes.content !== undefined) {
			const validContent = parseText(changes.content, 'content');
			if (!validContent.ok) return { ok: false, error: validContent.error, code: 400 };
			update.content = validContent.value;
		}
		if (changes.completed !== undefined) {
			const validCompleted = parseBoolean(changes.completed, 'completed');
			if (!validCompleted.ok) return { ok: false, error: validCompleted.error, code: 400 };
			update.completed = validCompleted.value;
		}
		if (changes.position !== undefined) {
			const validPosition = parsePosition(changes.position);
			if (!validPosition.ok) return { ok: false, error: validPosition.error, code: 400 };
			update.position = validPosition.value;
		}
		if (Object.keys(update).length === 0) {
			return { ok: false, error: 'content, completed or position is required', code: 400 };
		}

		try {
			const item = await this.todoItemsRepo.update(validListId.value, validItemId.value, update);
			if (!item) return { ok: false, error: 'Item not found', code: 404 };
			return { ok: true, data: item, code: 200 };
		} catch (error) {
			log.error('Error updating todo item:', error);
			return { ok: false, error: 'Failed to update item', code: 500 };
		}
	}

	async deleteItem(listId: string, itemId: string): Promise<Result<null> | Error> {
		const validListId = parseId(listId, 'listId');
		if (!validListId.ok) return { ok: false, error: validListId.error, code: 400 };
		const validItemId = parseId(itemId, 'itemId');
		if (!validItemId.ok) return { ok: false, error: validItemId.error, code: 400 };

		try {
			const deleted = await this.todoItemsRepo.delete(validListId.value, validItemId.value);
			if (!deleted) return { ok: false, error: 'Item not found', code: 404 };
			return { ok: true, data: null, code: 204 };
		} catch (error) {
			log.error('Error deleting todo item:', error);
			return { ok: false, error: 'Failed to delete item', code: 500 };
		}
	}
}
