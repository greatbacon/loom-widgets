const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export function isUuid(value: unknown): value is string {
	return typeof value === 'string' && UUID_REGEX.test(value);
}

export function parseId(value: unknown, field: string): Validated<string> {
	return isUuid(value) ? { ok: true, value } : { ok: false, error: `${field} must be a valid id` };
}

export function parseText(value: unknown, field: string): Validated<string> {
	if (typeof value !== 'string' || value.trim() === '') {
		return { ok: false, error: `${field} must be a non-empty string` };
	}
	return { ok: true, value: value.trim() };
}

export function parseBody(value: unknown): Validated<string> {
	return typeof value === 'string'
		? { ok: true, value }
		: { ok: false, error: 'body must be a string' };
}
