import { Repo } from '$lib/db/repo';
import type { Ticket, TicketChanges, TicketStatus } from '$lib/system/tickets/ticket';

const log = console;

export class TicketsRepo extends Repo {
	async findAll(): Promise<Ticket[]> {
		log.debug('[findAll] tickets');
		return this.sql<Ticket[]>`
			SELECT id, creator_sub, owner_sub, title, body, status, created_at, updated_at
			FROM tickets
			ORDER BY created_at, id
		`;
	}

	async findById(id: string): Promise<Ticket | undefined> {
		log.debug(`[findById] ticket ${id}`);
		const data = await this.sql<Ticket[]>`
			SELECT id, creator_sub, owner_sub, title, body, status, created_at, updated_at
			FROM tickets
			WHERE id = ${id}
		`;
		return data[0];
	}

	async create(
		creatorSub: string,
		input: { title: string; body?: string; status?: TicketStatus; owner_sub?: string | null }
	): Promise<Ticket> {
		log.debug(`[create] ticket for ${creatorSub}`);
		const data = await this.sql<Ticket[]>`
			INSERT INTO tickets (creator_sub, owner_sub, title, body, status)
			VALUES (
				${creatorSub},
				${input.owner_sub ?? null},
				${input.title},
				coalesce(${input.body ?? null}, ''),
				coalesce(${input.status ?? null}, 'backlog')
			)
			RETURNING id, creator_sub, owner_sub, title, body, status, created_at, updated_at
		`;
		return data[0];
	}

	async update(id: string, changes: TicketChanges): Promise<Ticket | undefined> {
		log.debug(`[update] ticket ${id}`, changes);
		return this.sql.begin(async (sql) => {
			const current = (
				await sql<Ticket[]>`
					SELECT id, creator_sub, owner_sub, title, body, status, created_at, updated_at
					FROM tickets
					WHERE id = ${id}
					FOR UPDATE
				`
			)[0];
			if (!current) return undefined;

			const title = changes.title ?? current.title;
			const body = changes.body ?? current.body;
			const status = changes.status ?? current.status;
			const ownerSub = 'owner_sub' in changes ? (changes.owner_sub ?? null) : current.owner_sub;

			const data = await sql<Ticket[]>`
				UPDATE tickets
				SET title = ${title}, body = ${body}, status = ${status},
					owner_sub = ${ownerSub}, updated_at = now()
				WHERE id = ${id}
				RETURNING id, creator_sub, owner_sub, title, body, status, created_at, updated_at
			`;
			return data[0];
		});
	}

	async delete(id: string): Promise<boolean> {
		log.debug(`[delete] ticket ${id}`);
		const data = await this.sql<{ id: string }[]>`
			DELETE FROM tickets WHERE id = ${id} RETURNING id
		`;
		return data.length > 0;
	}
}
