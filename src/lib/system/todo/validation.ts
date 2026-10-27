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

export function parsePosition(value: unknown): Validated<number> {
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
		return { ok: false, error: 'position must be a non-negative integer' };
	}
	return { ok: true, value };
}

export function parseBoolean(value: unknown, field: string): Validated<boolean> {
	return typeof value === 'boolean'
		? { ok: true, value }
		: { ok: false, error: `${field} must be a boolean` };
}
