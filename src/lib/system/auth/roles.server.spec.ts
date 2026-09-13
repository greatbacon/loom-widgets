import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({ OIDC_CLIENTID: '' }));

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const { extractRoles, hasAnyRole, requireRole } = await import('./roles.server');

describe('extractRoles', () => {
	beforeEach(() => {
		mockEnv.OIDC_CLIENTID = '';
	});

	it('returns an empty array when claims are missing', () => {
		expect(extractRoles(undefined)).toEqual([]);
	});

	it('returns an empty array when no role claims are present', () => {
		expect(extractRoles({})).toEqual([]);
	});

	it('extracts realm roles', () => {
		const roles = extractRoles({ realm_access: { roles: ['founder', 'member'] } });

		expect(roles).toEqual(['founder', 'member']);
	});

	it('extracts client roles for the configured OIDC_CLIENTID', () => {
		mockEnv.OIDC_CLIENTID = 'my-client';

		const roles = extractRoles({
			resource_access: { 'my-client': { roles: ['leader'] } }
		});

		expect(roles).toEqual(['leader']);
	});

	it('ignores client roles when OIDC_CLIENTID is not configured', () => {
		mockEnv.OIDC_CLIENTID = '';

		const roles = extractRoles({
			resource_access: { 'my-client': { roles: ['leader'] } }
		});

		expect(roles).toEqual([]);
	});

	it('dedupes roles present in both realm and client claims', () => {
		mockEnv.OIDC_CLIENTID = 'my-client';

		const roles = extractRoles({
			realm_access: { roles: ['founder', 'member'] },
			resource_access: { 'my-client': { roles: ['member', 'leader'] } }
		});

		expect(roles).toEqual(['founder', 'member', 'leader']);
	});

	it('filters out non-string entries', () => {
		const roles = extractRoles({ realm_access: { roles: ['founder', 42, null, {}] } });

		expect(roles).toEqual(['founder']);
	});
});

describe('hasAnyRole', () => {
	it('returns false when roles is empty or undefined', () => {
		expect(hasAnyRole(undefined, ['founder'])).toBe(false);
		expect(hasAnyRole([], ['founder'])).toBe(false);
	});

	it('returns false when there is no overlap', () => {
		expect(hasAnyRole(['member'], ['founder', 'leader'])).toBe(false);
	});

	it('returns true when there is overlap', () => {
		expect(hasAnyRole(['member', 'leader'], ['founder', 'leader'])).toBe(true);
	});
});

describe('requireRole', () => {
	it('throws a SvelteKit 403 when the locals roles do not overlap', () => {
		expect(() => requireRole({ roles: ['member'] } as App.Locals, ['founder'])).toThrow();
	});

	it('does not throw when there is a role overlap', () => {
		expect(() =>
			requireRole({ roles: ['founder'] } as App.Locals, ['founder', 'leader'])
		).not.toThrow();
	});
});
