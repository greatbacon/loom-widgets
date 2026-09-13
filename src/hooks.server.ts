import { redirect, type Handle } from '@sveltejs/kit';
import { resolveSession } from '$lib/system/auth/requestAuth.server';

const publicRoutes = ['/signin', '/auth/keycloak/login', '/auth/keycloak/callback', '/auth/logout'];

export const handle: Handle = async ({ event, resolve }) => {
	const { keycloakSubject, roles } = await resolveSession(event.cookies);

	if (!keycloakSubject && !publicRoutes.includes(event.url.pathname)) {
		throw redirect(303, '/signin');
	}

	if (keycloakSubject) {
		event.locals.keycloakSubject = keycloakSubject;
		event.locals.roles = roles ?? [];
	}

	return resolve(event);
};
