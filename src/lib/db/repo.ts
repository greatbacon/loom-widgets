import type {PostgresSql} from '$lib/db/postgres.server.js';

export class Repo {
	constructor(		
		public readonly sql: PostgresSql,
	) {}
}