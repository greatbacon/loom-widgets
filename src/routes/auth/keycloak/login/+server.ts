import { redirect } from '@sveltejs/kit';
import * as client from 'openid-client';
import { getOidcConfig, oidcScopes } from '$lib/system/auth/oidcClient.server';
import {
	createOAuthStateCookieValue,
	OAUTH_STATE_COOKIE_NAME,
	OAUTH_STATE_MAX_AGE
} from '$lib/system/auth/oauthState.server';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET({ url, cookies }: RequestEvent) {
	const config = await getOidcConfig();
	const code_verifier = client.randomPKCECodeVerifier();
	const code_challenge = await client.calculatePKCECodeChallenge(code_verifier);
	const state = client.randomState();

	cookies.set(
		OAUTH_STATE_COOKIE_NAME,
		await createOAuthStateCookieValue({ state, code_verifier }),
		{
			path: '/auth/keycloak',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: OAUTH_STATE_MAX_AGE
		}
	);

	const redirectTo = client.buildAuthorizationUrl(config, {
		redirect_uri: `${url.origin}/auth/keycloak/callback`,
		scope: oidcScopes(),
		code_challenge,
		code_challenge_method: 'S256',
		state
	});

	throw redirect(302, redirectTo.href);
}
