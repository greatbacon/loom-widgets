import { sealCookie, unsealCookie } from '$lib/system/auth/sealedCookie.server';

export interface OAuthStatePayload {
	state: string;
	code_verifier: string;
	[key: string]: unknown;
}

export const OAUTH_STATE_COOKIE_NAME = 'kc_oauth_state';
export const OAUTH_STATE_MAX_AGE = 60 * 5; // 5 minutes

export function createOAuthStateCookieValue(payload: OAuthStatePayload): Promise<string> {
	return sealCookie(payload, OAUTH_STATE_MAX_AGE);
}

export function readOAuthStateCookieValue(cookieValue: string): Promise<OAuthStatePayload | null> {
	return unsealCookie<OAuthStatePayload>(cookieValue);
}
