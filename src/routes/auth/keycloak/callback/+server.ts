import { redirect } from '@sveltejs/kit';
import * as client from 'openid-client';
import { getOidcConfig } from '$lib/system/auth/oidcClient.server';
import {
	readOAuthStateCookieValue,
	OAUTH_STATE_COOKIE_NAME
} from '$lib/system/auth/oauthState.server';
import {
	createKeycloakSessionCookieValue,
	KEYCLOAK_SESSION_COOKIE_NAME,
	KEYCLOAK_SESSION_MAX_AGE
} from '$lib/system/auth/keycloakSession.server';
import { extractRoles } from '$lib/system/auth/roles.server';
import { extractProfile } from '$lib/system/auth/profile.server';
import { upsertLocalUser } from '$lib/system/users/usersService.server';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET({ url, cookies }: RequestEvent) {
	const stateCookie = cookies.get(OAUTH_STATE_COOKIE_NAME);
	cookies.delete(OAUTH_STATE_COOKIE_NAME, { path: '/auth/keycloak' });

	const saved = stateCookie ? await readOAuthStateCookieValue(stateCookie) : null;
	if (!saved) {
		throw redirect(303, '/signin');
	}

	const config = await getOidcConfig();
	const tokens = await client.authorizationCodeGrant(config, url, {
		pkceCodeVerifier: saved.code_verifier,
		expectedState: saved.state
	});

	const claims = tokens.claims();
	if (!claims?.sub) {
		throw redirect(303, '/signin');
	}

	const roles = extractRoles(claims);
	const profile = extractProfile(claims, claims.sub);
	try {
		await upsertLocalUser(
			claims.sub,
			claims.iss,
			profile.username,
			profile.email,
			profile.email_verified
		);
	} catch (error) {
		console.error(`Failed to persist local user record for ${claims.sub}:`, error);
	}

	cookies.set(
		KEYCLOAK_SESSION_COOKIE_NAME,
		await createKeycloakSessionCookieValue(
			{ sub: claims.sub, id_token: tokens.id_token!, roles },
			KEYCLOAK_SESSION_MAX_AGE
		),
		{ path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: KEYCLOAK_SESSION_MAX_AGE }
	);

	throw redirect(303, '/');
}
