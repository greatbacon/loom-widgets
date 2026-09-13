import { hkdfSync } from 'node:crypto';
import { env } from '$env/dynamic/private';

const HKDF_SALT = 'loom-app/keycloak-session/salt';
const HKDF_INFO = 'loom-app/keycloak-session';

export function parseCookieKeys(raw: string): string[] {
	return raw
		.split('__')
		.map((part) => part.replace(/^(latest|older|oldest)_secret_/, ''))
		.filter(Boolean);
}

function deriveEncryptionKey(secret: string): Uint8Array {
	return new Uint8Array(hkdfSync('sha256', secret, HKDF_SALT, HKDF_INFO, 32));
}

export function getEncryptionKeys(): Uint8Array[] {
	return parseCookieKeys(env.COOKIE_KEYS!).map(deriveEncryptionKey);
}

export function getLatestEncryptionKey(): Uint8Array {
	return getEncryptionKeys()[0];
}
