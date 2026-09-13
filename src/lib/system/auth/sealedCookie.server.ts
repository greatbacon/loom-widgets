import { EncryptJWT, jwtDecrypt, type JWTPayload } from 'jose';
import { getEncryptionKeys, getLatestEncryptionKey } from '$lib/system/auth/cookieKeys.server';

export async function sealCookie<T extends JWTPayload>(
	payload: T,
	expiresInSeconds: number
): Promise<string> {
	return new EncryptJWT(payload)
		.setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
		.setIssuedAt()
		.setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
		.encrypt(getLatestEncryptionKey());
}

export async function unsealCookie<T>(value: string): Promise<T | null> {
	for (const key of getEncryptionKeys()) {
		try {
			const { payload } = await jwtDecrypt(value, key);
			return payload as T;
		} catch {
			// try the next key (rotation) or fall through to null
		}
	}
	return null;
}
