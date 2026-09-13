import * as client from 'openid-client';
import { env } from '$env/dynamic/private';

let configPromise: Promise<client.Configuration> | null = null;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function getOidcConfig(): Promise<client.Configuration> {
	if (!configPromise) {
		const issuer = new URL(env.OIDC_URL!);
		const options = LOOPBACK_HOSTS.has(issuer.hostname)
			? { execute: [client.allowInsecureRequests] }
			: undefined;
		configPromise = client.discovery(
			issuer,
			env.OIDC_CLIENTID!,
			env.OIDC_SECRET,
			undefined,
			options
		);
	}
	return configPromise;
}

export const oidcScopes = () => env.OIDC_SCOPES || 'openid';
