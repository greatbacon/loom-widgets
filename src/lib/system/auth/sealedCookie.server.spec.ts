import { describe, it, expect, vi } from 'vitest';

const mockEnv = vi.hoisted(() => ({ COOKIE_KEYS: '' }));

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const { sealCookie, unsealCookie } = await import('./sealedCookie.server');

describe('sealCookie / unsealCookie', () => {
	it('round-trips a payload', async () => {
		mockEnv.COOKIE_KEYS =
			'AAAAAAAAAAAAAAAA__BBBBBBBBBBBBBBBB__CCCCCCCCCCCCCCCC';

		const sealed = await sealCookie({ sub: 'user-1' }, 60);
		const result = await unsealCookie<{ sub: string }>(sealed);

		expect(result?.sub).toBe('user-1');
	});

	it('returns null for an already-expired payload', async () => {
		mockEnv.COOKIE_KEYS =
			'latest_secret_AAAAAAAAAAAAAAAA__older_secret_BBBBBBBBBBBBBBBB__oldest_secret_CCCCCCCCCCCCCCCC';

		const sealed = await sealCookie({ sub: 'user-1' }, -60);
		const result = await unsealCookie(sealed);

		expect(result).toBeNull();
	});

	it('still unseals once the sealing secret has rotated to an older position', async () => {
		mockEnv.COOKIE_KEYS =
			'latest_secret_AAAAAAAAAAAAAAAA__older_secret_BBBBBBBBBBBBBBBB__oldest_secret_CCCCCCCCCCCCCCCC';
		const sealed = await sealCookie({ sub: 'user-1' }, 60);

		mockEnv.COOKIE_KEYS =
			'latest_secret_DDDDDDDDDDDDDDDD__older_secret_AAAAAAAAAAAAAAAA__oldest_secret_BBBBBBBBBBBBBBBB';
		const result = await unsealCookie<{ sub: string }>(sealed);

		expect(result?.sub).toBe('user-1');
	});

	it('returns null (not a throw) for a tampered value', async () => {
		mockEnv.COOKIE_KEYS =
			'latest_secret_AAAAAAAAAAAAAAAA__older_secret_BBBBBBBBBBBBBBBB__oldest_secret_CCCCCCCCCCCCCCCC';
		const sealed = await sealCookie({ sub: 'user-1' }, 60);
		const tampered = sealed.slice(0, -4) + (sealed.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');

		await expect(unsealCookie(tampered)).resolves.toBeNull();
	});
});
