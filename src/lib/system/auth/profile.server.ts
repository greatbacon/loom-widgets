export interface OidcProfile {
	username: string;
	email: string | null;
	email_verified: boolean;
}

export function extractProfile(
	claims: Record<string, unknown> | undefined,
	fallbackSub: string
): OidcProfile {
	const preferredUsername =
		typeof claims?.preferred_username === 'string' ? claims.preferred_username : undefined;
	const email = typeof claims?.email === 'string' ? claims.email : null;

	return {
		username: preferredUsername || email || fallbackSub,
		email,
		email_verified: claims?.email_verified === true
	};
}
