import { redirect } from '@sveltejs/kit';
import * as client from 'openid-client';
import { getOidcConfig } from '$lib/system/auth/oidcClient.server';
import {
	readKeycloakSession,
	KEYCLOAK_SESSION_COOKIE_NAME
} from '$lib/system/auth/keycloakSession.server';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET({ cookies, url }: RequestEvent) {
	const kcCookie = cookies.get(KEYCLOAK_SESSION_COOKIE_NAME);
	const kcSession = kcCookie ? await readKeycloakSession(kcCookie) : null;

	cookies.delete(KEYCLOAK_SESSION_COOKIE_NAME, { path: '/' });

	if (kcSession) {
		const config = await getOidcConfig();
		const endSessionUrl = client.buildEndSessionUrl(config, {
			id_token_hint: kcSession.id_token,
			post_logout_redirect_uri: `${url.origin}/signin`
		});
		throw redirect(303, endSessionUrl.href);
	}

	throw redirect(303, '/signin');
}
