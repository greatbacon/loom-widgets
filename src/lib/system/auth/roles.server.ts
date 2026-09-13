import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const ADMIN_ROLES = ['founder', 'leader'];

function toRoleArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function extractRoles(claims: Record<string, unknown> | undefined): string[] {
	if (!claims) return [];

	const realmAccess = claims.realm_access as Record<string, unknown> | undefined;
	const realmRoles = toRoleArray(realmAccess?.roles);

	const clientId = env.OIDC_CLIENTID;
	const resourceAccess = claims.resource_access as Record<string, { roles?: unknown }> | undefined;
	const clientRoles = clientId ? toRoleArray(resourceAccess?.[clientId]?.roles) : [];

	return Array.from(new Set([...realmRoles, ...clientRoles]));
}

export function hasAnyRole(roles: string[] | undefined, required: string[]): boolean {
	if (!roles?.length) return false;
	return required.some((role) => roles.includes(role));
}

export function requireRole(locals: App.Locals, required: string[]): void {
	if (!hasAnyRole(locals.roles, required)) {
		error(403, 'Forbidden');
	}
}
