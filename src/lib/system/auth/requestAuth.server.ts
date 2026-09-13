import {
	readKeycloakSession,
	KEYCLOAK_SESSION_COOKIE_NAME
} from '$lib/system/auth/keycloakSession.server';

export interface ResolvedSession {
	keycloakSubject?: string;
	roles?: string[];
}

export interface SessionCookies {
	get(name: string): string | undefined;
}

export async function resolveSession(cookies: SessionCookies): Promise<ResolvedSession> {
	const kcCookie = cookies.get(KEYCLOAK_SESSION_COOKIE_NAME);
	const kcSession = kcCookie ? await readKeycloakSession(kcCookie) : null;

	const resolved: ResolvedSession = {};
	if (kcSession) {
		resolved.keycloakSubject = kcSession.sub;
		resolved.roles = kcSession.roles;
	}
	return resolved;
}
