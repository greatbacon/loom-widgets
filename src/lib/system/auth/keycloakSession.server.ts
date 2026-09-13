import { sealCookie, unsealCookie } from '$lib/system/auth/sealedCookie.server';

export interface KeycloakSessionPayload {
	sub: string;
	id_token: string;
	roles?: string[];
	[key: string]: unknown;
}

export const KEYCLOAK_SESSION_COOKIE_NAME = 'kc_session';
export const KEYCLOAK_SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 1 week

export function createKeycloakSessionCookieValue(
	payload: KeycloakSessionPayload,
	expiresInSeconds: number
): Promise<string> {
	return sealCookie(payload, expiresInSeconds);
}

export function readKeycloakSession(cookieValue: string): Promise<KeycloakSessionPayload | null> {
	return unsealCookie<KeycloakSessionPayload>(cookieValue);
}
