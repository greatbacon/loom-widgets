import type { TodoList, TodoListWithItems } from './todo';
import { TodoListsRepo } from '$lib/system/todo/todoListsRepo';
import { TodoItemsRepo } from '$lib/system/todo/todoItemsRepo';
import { parseId, parsePosition, parseText } from '$lib/system/todo/validation';
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

export class TodoListsService {
	todoListsRepo: TodoListsRepo;
	todoItemsRepo: TodoItemsRepo;

	constructor(todoListsRepo?: TodoListsRepo, todoItemsRepo?: TodoItemsRepo) {
		if (todoListsRepo && todoItemsRepo) {
			this.todoListsRepo = todoListsRepo;
			this.todoItemsRepo = todoItemsRepo;
		} else {
			const sql = postgres(defaultPostgresOptions);
			this.todoListsRepo = todoListsRepo || new TodoListsRepo(sql);
			this.todoItemsRepo = todoItemsRepo || new TodoItemsRepo(sql);
		}
	}

	async listLists(): Promise<Result<TodoList[]> | Error> {
		try {
			const lists = await this.todoListsRepo.findAll();
			return { ok: true, data: lists, code: 200 };
		} catch (error) {
			log.error('Error listing todo lists:', error);
			return { ok: false, error: 'Failed to list lists', code: 500 };
		}
	}

	async getList(id: string): Promise<Result<TodoListWithItems> | Error> {
		const validId = parseId(id, 'listId');
		if (!validId.ok) return { ok: false, error: validId.error, code: 400 };

		try {
			const list = await this.todoListsRepo.findById(validId.value);
			if (!list) return { ok: false, error: 'List not found', code: 404 };
			const items = await this.todoItemsRepo.findByList(validId.value);
			return { ok: true, data: { ...list, items }, code: 200 };
		} catch (error) {
			log.error('Error getting todo list:', error);
			return { ok: false, error: 'Failed to get list', code: 500 };
		}
	}

	async createList(authorSub: string, name: unknown): Promise<Result<TodoList> | Error> {
		if (!authorSub) {
			return { ok: false, error: 'authorSub is required', code: 400 };
		}
		const validName = parseText(name, 'name');
		if (!validName.ok) return { ok: false, error: validName.error, code: 400 };

		try {
			const list = await this.todoListsRepo.create(authorSub, validName.value);
			return { ok: true, data: list, code: 201 };
		} catch (error) {
			log.error('Error creating todo list:', error);
			return { ok: false, error: 'Failed to create list', code: 500 };
		}
	}

	async updateList(
		id: string,
		changes: { name?: unknown; position?: unknown }
	): Promise<Result<TodoList> | Error> {
		const validId = parseId(id, 'listId');
		if (!validId.ok) return { ok: false, error: validId.error, code: 400 };

		const update: { name?: string; position?: number } = {};
		if (changes.name !== undefined) {
			const validName = parseText(changes.name, 'name');
			if (!validName.ok) return { ok: false, error: validName.error, code: 400 };
			update.name = validName.value;
		}
		if (changes.position !== undefined) {
			const validPosition = parsePosition(changes.position);
			if (!validPosition.ok) return { ok: false, error: validPosition.error, code: 400 };
			update.position = validPosition.value;
		}
		if (update.name === undefined && update.position === undefined) {
			return { ok: false, error: 'name or position is required', code: 400 };
		}

		try {
			const list = await this.todoListsRepo.update(validId.value, update);
			if (!list) return { ok: false, error: 'List not found', code: 404 };
			return { ok: true, data: list, code: 200 };
		} catch (error) {
			log.error('Error updating todo list:', error);
			return { ok: false, error: 'Failed to update list', code: 500 };
		}
	}

	async deleteList(id: string): Promise<Result<null> | Error> {
		const validId = parseId(id, 'listId');
		if (!validId.ok) return { ok: false, error: validId.error, code: 400 };

		try {
			const deleted = await this.todoListsRepo.delete(validId.value);
			if (!deleted) return { ok: false, error: 'List not found', code: 404 };
			return { ok: true, data: null, code: 204 };
		} catch (error) {
			log.error('Error deleting todo list:', error);
			return { ok: false, error: 'Failed to delete list', code: 500 };
		}
	}
}
