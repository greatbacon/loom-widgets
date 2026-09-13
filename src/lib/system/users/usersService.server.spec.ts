import { describe, it, expect, vi, beforeEach } from 'vitest';
import sinon from 'sinon';
import { UsersService, upsertLocalUser } from './usersService.server';
import type { UsersRepo } from './usersRepo';
import type { User } from './usersService';

const makeUser = (overrides: Partial<User> = {}): User => ({
	sub: 'kc-user-1',
	iss: 'https://keycloak.example.com/realms/loom',
	username: 'alice',
	email: 'alice@example.com',
	email_verified: true,
	created_at: new Date('2026-01-01T00:00:00Z'),
	updated_at: null,
	...overrides
});

describe('UsersService', () => {
	let usersRepo: { upsert: sinon.SinonStub; findAll: sinon.SinonStub; findBySub: sinon.SinonStub };
	let service: UsersService;

	beforeEach(() => {
		usersRepo = {
			upsert: sinon.stub(),
			findAll: sinon.stub(),
			findBySub: sinon.stub()
		};
		service = new UsersService(usersRepo as unknown as UsersRepo);
	});

	describe('upsertUser', () => {
		it('rejects a missing sub', async () => {
			const result = await service.upsertUser('', 'iss', 'username', null, false);

			expect(result).toEqual({ ok: false, error: 'sub is required', code: 400 });
			expect(usersRepo.upsert.called).toBe(false);
		});

		it('rejects a missing iss', async () => {
			const result = await service.upsertUser('sub', '', 'username', null, false);

			expect(result).toEqual({ ok: false, error: 'iss is required', code: 400 });
			expect(usersRepo.upsert.called).toBe(false);
		});

		it('rejects a missing username', async () => {
			const result = await service.upsertUser('sub', 'iss', '', null, false);

			expect(result).toEqual({ ok: false, error: 'username is required', code: 400 });
			expect(usersRepo.upsert.called).toBe(false);
		});

		it('upserts and returns the user on success', async () => {
			const user = makeUser();
			usersRepo.upsert.resolves(user);

			const result = await service.upsertUser(
				user.sub,
				user.iss,
				user.username,
				user.email,
				user.email_verified
			);

			expect(result).toEqual({ ok: true, data: user, code: 200 });
			expect(
				usersRepo.upsert.calledWithExactly(
					user.sub,
					user.iss,
					user.username,
					user.email,
					user.email_verified
				)
			).toBe(true);
		});

		it('returns a 500 error when the repo throws', async () => {
			usersRepo.upsert.rejects(new Error('connection lost'));

			const result = await service.upsertUser('sub', 'iss', 'username', null, false);

			expect(result).toEqual({ ok: false, error: 'Failed to upsert user', code: 500 });
		});
	});

	describe('listUsers', () => {
		it('returns all users on success', async () => {
			const users = [makeUser(), makeUser({ sub: 'kc-user-2' })];
			usersRepo.findAll.resolves(users);

			const result = await service.listUsers();

			expect(result).toEqual({ ok: true, data: users, code: 200 });
		});

		it('returns a 500 error when the repo throws', async () => {
			usersRepo.findAll.rejects(new Error('connection lost'));

			const result = await service.listUsers();

			expect(result).toEqual({ ok: false, error: 'Failed to list users', code: 500 });
		});
	});
});

describe('upsertLocalUser', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('resolves when the underlying upsert succeeds', async () => {
		vi.spyOn(UsersService.prototype, 'upsertUser').mockResolvedValue({
			ok: true,
			data: makeUser(),
			code: 200
		});

		await expect(upsertLocalUser('sub', 'iss', 'username', null, false)).resolves.toBeUndefined();
	});

	it('throws when the underlying upsert fails', async () => {
		vi.spyOn(UsersService.prototype, 'upsertUser').mockResolvedValue({
			ok: false,
			error: 'Failed to upsert user',
			code: 500
		});

		await expect(upsertLocalUser('sub', 'iss', 'username', null, false)).rejects.toThrow(
			'Failed to upsert user'
		);
	});
});
