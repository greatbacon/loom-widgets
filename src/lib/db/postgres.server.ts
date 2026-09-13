import type {Sql, Options} from 'postgres';
import { env } from '$env/dynamic/private';

// Postgres.js - PostgreSQL client for Node.js
// https://github.com/porsager/postgres

export type PostgresSql = Sql<any>; // TODO type

// was using a type helper here, but worsens usage because of the complexity
export interface PostgresOptions extends Options<any> {
	host: string;
	port: number;
	database: string;
	username: string;
	password: string;
}

const toDefaultPostgresOptions = (): PostgresOptions => ({
	host: env.PGHOST,
	port: Number(env.PGPORT),
	database: env.PGDATABASE,
	username: env.PGUSER,
	password: env.PGPASSWORD,
	idle_timeout: Number(env.PGIDLE_TIMEOUT) || undefined,
	connect_timeout: Number(env.PGCONNECT_TIMEOUT) || undefined,
});

export const defaultPostgresOptions = toDefaultPostgresOptions();