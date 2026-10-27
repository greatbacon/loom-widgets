import { Repo } from '$lib/db/repo';
import type { TodoList } from '$lib/system/todo/todo';

const log = console;

export class TodoListsRepo extends Repo {
	async findAll(): Promise<TodoList[]> {
		log.debug('[findAll] todo lists');
		return this.sql<TodoList[]>`
			SELECT id, author_sub, name, position, created_at, updated_at
			FROM todo_lists
			ORDER BY position
		`;
	}

	async findById(id: string): Promise<TodoList | undefined> {
		log.debug(`[findById] todo list ${id}`);
		const data = await this.sql<TodoList[]>`
			SELECT id, author_sub, name, position, created_at, updated_at
			FROM todo_lists
			WHERE id = ${id}
		`;
		return data[0];
	}

	async create(authorSub: string, name: string): Promise<TodoList> {
		log.debug(`[create] todo list for ${authorSub}`);
		return this.sql.begin(async (sql) => {
			await sql`SELECT pg_advisory_xact_lock(hashtext('todo_lists'))`;
			const data = await sql<TodoList[]>`
				INSERT INTO todo_lists (author_sub, name, position)
				VALUES (
					${authorSub},
					${name},
					(SELECT coalesce(max(position) + 1, 0) FROM todo_lists)
				)
				RETURNING id, author_sub, name, position, created_at, updated_at
			`;
			return data[0];
		});
	}

	async update(
		id: string,
		changes: { name?: string; position?: number }
	): Promise<TodoList | undefined> {
		log.debug(`[update] todo list ${id}`, changes);
		return this.sql.begin(async (sql) => {
			await sql`SELECT pg_advisory_xact_lock(hashtext('todo_lists'))`;
			const current = (
				await sql<TodoList[]>`
					SELECT id, author_sub, name, position, created_at, updated_at
					FROM todo_lists
					WHERE id = ${id}
				`
			)[0];
			if (!current) return undefined;

			if (changes.name !== undefined) {
				await sql`
					UPDATE todo_lists SET name = ${changes.name}, updated_at = now() WHERE id = ${id}
				`;
			}

			if (changes.position !== undefined) {
				const [{ count }] = await sql<{ count: number }[]>`
					SELECT count(*)::int AS count FROM todo_lists
				`;
				const next = Math.min(Math.max(changes.position, 0), count - 1);
				const old = current.position;
				if (next > old) {
					await sql`
						UPDATE todo_lists SET position = position - 1
						WHERE position > ${old} AND position <= ${next} AND id != ${id}
					`;
				} else if (next < old) {
					await sql`
						UPDATE todo_lists SET position = position + 1
						WHERE position >= ${next} AND position < ${old} AND id != ${id}
					`;
				}
				if (next !== old) {
					await sql`
						UPDATE todo_lists SET position = ${next}, updated_at = now() WHERE id = ${id}
					`;
				}
			}

			const data = await sql<TodoList[]>`
				SELECT id, author_sub, name, position, created_at, updated_at
				FROM todo_lists
				WHERE id = ${id}
			`;
			return data[0];
		});
	}

	async delete(id: string): Promise<boolean> {
		log.debug(`[delete] todo list ${id}`);
		return this.sql.begin(async (sql) => {
			await sql`SELECT pg_advisory_xact_lock(hashtext('todo_lists'))`;
			const deleted = await sql<{ position: number }[]>`
				DELETE FROM todo_lists WHERE id = ${id} RETURNING position
			`;
			if (deleted.length === 0) return false;
			await sql`
				UPDATE todo_lists SET position = position - 1 WHERE position > ${deleted[0].position}
			`;
			return true;
		});
	}
}
