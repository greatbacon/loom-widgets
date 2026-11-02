import type { Validated } from '$lib/system/util/validation';

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
