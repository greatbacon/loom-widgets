import type { User } from './usersService';
import { UsersRepo } from '$lib/system/users/usersRepo';
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

export class UsersService {
	usersRepo: UsersRepo;

	constructor(usersRepo?: UsersRepo) {
		this.usersRepo = usersRepo || new UsersRepo(postgres(defaultPostgresOptions));
	}

	async upsertUser(
		sub: string,
		iss: string,
		username: string,
		email: string | null,
		email_verified: boolean
	): Promise<Result<User> | Error> {
		if (!sub) {
			return { ok: false, error: 'sub is required', code: 400 };
		}
		if (!iss) {
			return { ok: false, error: 'iss is required', code: 400 };
		}
		if (!username) {
			return { ok: false, error: 'username is required', code: 400 };
		}

		try {
			const user = await this.usersRepo.upsert(sub, iss, username, email, email_verified);
			return { ok: true, data: user, code: 200 };
		} catch (error) {
			log.error('Error upserting user:', error);
			return { ok: false, error: 'Failed to upsert user', code: 500 };
		}
	}

	async listUsers(): Promise<Result<User[]> | Error> {
		try {
			const users = await this.usersRepo.findAll();
			return { ok: true, data: users, code: 200 };
		} catch (error) {
			log.error('Error listing users:', error);
			return { ok: false, error: 'Failed to list users', code: 500 };
		}
	}
}

export async function upsertLocalUser(
	sub: string,
	iss: string,
	username: string,
	email: string | null,
	email_verified: boolean
): Promise<void> {
	const result = await new UsersService().upsertUser(sub, iss, username, email, email_verified);
	if (!result.ok) {
		throw new Error(result.error);
	}
}
