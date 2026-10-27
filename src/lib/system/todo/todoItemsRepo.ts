import { Repo } from '$lib/db/repo';
import type { TodoItem } from '$lib/system/todo/todo';

const log = console;

export class TodoItemsRepo extends Repo {
	async findByList(listId: string): Promise<TodoItem[]> {
		log.debug(`[findByList] todo items for list ${listId}`);
		return this.sql<TodoItem[]>`
			SELECT id, list_id, author_sub, content, position, completed, created_at, updated_at
			FROM todo_items
			WHERE list_id = ${listId}
			ORDER BY position
		`;
	}

	async findById(listId: string, itemId: string): Promise<TodoItem | undefined> {
		log.debug(`[findById] todo item ${itemId} in list ${listId}`);
		const data = await this.sql<TodoItem[]>`
			SELECT id, list_id, author_sub, content, position, completed, created_at, updated_at
			FROM todo_items
			WHERE list_id = ${listId} AND id = ${itemId}
		`;
		return data[0];
	}

	async create(listId: string, authorSub: string, content: string): Promise<TodoItem | undefined> {
		log.debug(`[create] todo item in list ${listId} for ${authorSub}`);
		return this.sql.begin(async (sql) => {
			const list = await sql`SELECT id FROM todo_lists WHERE id = ${listId} FOR UPDATE`;
			if (list.length === 0) return undefined;
			const data = await sql<TodoItem[]>`
				INSERT INTO todo_items (list_id, author_sub, content, position)
				VALUES (
					${listId},
					${authorSub},
					${content},
					(SELECT coalesce(max(position) + 1, 0) FROM todo_items WHERE list_id = ${listId})
				)
				RETURNING id, list_id, author_sub, content, position, completed, created_at, updated_at
			`;
			return data[0];
		});
	}

	async update(
		listId: string,
		itemId: string,
		changes: { content?: string; completed?: boolean; position?: number }
	): Promise<TodoItem | undefined> {
		log.debug(`[update] todo item ${itemId} in list ${listId}`, changes);
		return this.sql.begin(async (sql) => {
			const list = await sql`SELECT id FROM todo_lists WHERE id = ${listId} FOR UPDATE`;
			if (list.length === 0) return undefined;
			const current = (
				await sql<TodoItem[]>`
					SELECT id, list_id, author_sub, content, position, completed, created_at, updated_at
					FROM todo_items
					WHERE list_id = ${listId} AND id = ${itemId}
				`
			)[0];
			if (!current) return undefined;

			if (changes.content !== undefined) {
				await sql`
					UPDATE todo_items SET content = ${changes.content}, updated_at = now() WHERE id = ${itemId}
				`;
			}
			if (changes.completed !== undefined) {
				await sql`
					UPDATE todo_items SET completed = ${changes.completed}, updated_at = now() WHERE id = ${itemId}
				`;
			}

			if (changes.position !== undefined) {
				const [{ count }] = await sql<{ count: number }[]>`
					SELECT count(*)::int AS count FROM todo_items WHERE list_id = ${listId}
				`;
				const next = Math.min(Math.max(changes.position, 0), count - 1);
				const old = current.position;
				if (next > old) {
					await sql`
						UPDATE todo_items SET position = position - 1
						WHERE list_id = ${listId} AND position > ${old} AND position <= ${next} AND id != ${itemId}
					`;
				} else if (next < old) {
					await sql`
						UPDATE todo_items SET position = position + 1
						WHERE list_id = ${listId} AND position >= ${next} AND position < ${old} AND id != ${itemId}
					`;
				}
				if (next !== old) {
					await sql`
						UPDATE todo_items SET position = ${next}, updated_at = now() WHERE id = ${itemId}
					`;
				}
			}

			const data = await sql<TodoItem[]>`
				SELECT id, list_id, author_sub, content, position, completed, created_at, updated_at
				FROM todo_items
				WHERE id = ${itemId}
			`;
			return data[0];
		});
	}

	async delete(listId: string, itemId: string): Promise<boolean> {
		log.debug(`[delete] todo item ${itemId} in list ${listId}`);
		return this.sql.begin(async (sql) => {
			const list = await sql`SELECT id FROM todo_lists WHERE id = ${listId} FOR UPDATE`;
			if (list.length === 0) return false;
			const deleted = await sql<{ position: number }[]>`
				DELETE FROM todo_items WHERE list_id = ${listId} AND id = ${itemId} RETURNING position
			`;
			if (deleted.length === 0) return false;
			await sql`
				UPDATE todo_items SET position = position - 1
				WHERE list_id = ${listId} AND position > ${deleted[0].position}
			`;
			return true;
		});
	}
}
