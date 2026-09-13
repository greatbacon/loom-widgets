import { describe, it, expect, vi, beforeEach } from 'vitest';
import sinon from 'sinon';

vi.mock('$lib/system/auth/keycloakSession.server', () => ({
	KEYCLOAK_SESSION_COOKIE_NAME: 'kc_session',
	readKeycloakSession: vi.fn()
}));

const { resolveSession } = await import('./requestAuth.server');
const { readKeycloakSession } = await import('$lib/system/auth/keycloakSession.server');

describe('resolveSession', () => {
	let cookies: { get: sinon.SinonStub };

	beforeEach(() => {
		cookies = { get: sinon.stub().returns(undefined) };
		vi.mocked(readKeycloakSession).mockReset();
	});

	it('resolves keycloakSubject when a valid Keycloak session cookie is present', async () => {
		cookies.get.withArgs('kc_session').returns('sealed-value');
		vi.mocked(readKeycloakSession).mockResolvedValue({
			sub: 'kc-user-1',
			id_token: 'id-token'
		});

		const result = await resolveSession(cookies);

		expect(result).toEqual({ keycloakSubject: 'kc-user-1', roles: undefined });
	});

	it('resolves roles alongside keycloakSubject when the cookie carries them', async () => {
		cookies.get.withArgs('kc_session').returns('sealed-value');
		vi.mocked(readKeycloakSession).mockResolvedValue({
			sub: 'kc-user-1',
			id_token: 'id-token',
			roles: ['founder', 'member']
		});

		const result = await resolveSession(cookies);

		expect(result).toEqual({ keycloakSubject: 'kc-user-1', roles: ['founder', 'member'] });
	});

	it('resolves nothing when no Keycloak session cookie is present', async () => {
		const result = await resolveSession(cookies);

		expect(result).toEqual({});
		expect(readKeycloakSession).not.toHaveBeenCalled();
	});

	it('treats an expired/invalid Keycloak cookie as absent', async () => {
		cookies.get.withArgs('kc_session').returns('sealed-value');
		vi.mocked(readKeycloakSession).mockResolvedValue(null);

		const result = await resolveSession(cookies);

		expect(result).toEqual({});
	});
});
