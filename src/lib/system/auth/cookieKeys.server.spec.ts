import { describe, it, expect, vi } from 'vitest';

const mockEnv = vi.hoisted(() => ({ COOKIE_KEYS: '' }));

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const { parseCookieKeys, getEncryptionKeys, getLatestEncryptionKey } = await import(
	'./cookieKeys.server'
);

describe('parseCookieKeys', () => {
	it('parses the three named, __-delimited secrets in newest-first order', () => {
		mockEnv.COOKIE_KEYS = 'AAA__BBB__CCC';

		expect(parseCookieKeys(mockEnv.COOKIE_KEYS)).toEqual(['AAA', 'BBB', 'CCC']);
	});
});

describe('getEncryptionKeys / getLatestEncryptionKey', () => {
	it('derives one key per secret, newest first, and matches getLatestEncryptionKey', () => {
		mockEnv.COOKIE_KEYS = 'AAA__BBB__CCC';

		const keys = getEncryptionKeys();

		expect(keys).toHaveLength(3);
		expect(keys[0]).toEqual(getLatestEncryptionKey());
		expect(keys[0]).not.toEqual(keys[1]);
		expect(keys[1]).not.toEqual(keys[2]);
	});
});
