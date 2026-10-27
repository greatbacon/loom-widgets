import { describe, it, expect } from 'vitest';
import { isUuid, parseBoolean, parseId, parsePosition, parseText } from './validation';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('validation', () => {
	it('isUuid accepts uuids and rejects everything else', () => {
		expect(isUuid(UUID)).toBe(true);
		expect(isUuid(UUID.toUpperCase())).toBe(true);
		expect(isUuid('not-a-uuid')).toBe(false);
		expect(isUuid(`${UUID}x`)).toBe(false);
		expect(isUuid(42)).toBe(false);
		expect(isUuid(undefined)).toBe(false);
	});

	it('parseId names the field in the error', () => {
		expect(parseId(UUID, 'listId')).toEqual({ ok: true, value: UUID });
		expect(parseId('x', 'listId')).toEqual({ ok: false, error: 'listId must be a valid id' });
	});

	it('parseText trims and rejects empty or non-string values', () => {
		expect(parseText('  hi  ', 'name')).toEqual({ ok: true, value: 'hi' });
		expect(parseText('   ', 'name').ok).toBe(false);
		expect(parseText('', 'name').ok).toBe(false);
		expect(parseText(1, 'name').ok).toBe(false);
		expect(parseText(undefined, 'name').ok).toBe(false);
	});

	it('parsePosition requires a non-negative integer', () => {
		expect(parsePosition(0)).toEqual({ ok: true, value: 0 });
		expect(parsePosition(3)).toEqual({ ok: true, value: 3 });
		expect(parsePosition(-1).ok).toBe(false);
		expect(parsePosition(1.5).ok).toBe(false);
		expect(parsePosition('1').ok).toBe(false);
		expect(parsePosition(NaN).ok).toBe(false);
	});

	it('parseBoolean requires a boolean', () => {
		expect(parseBoolean(false, 'completed')).toEqual({ ok: true, value: false });
		expect(parseBoolean('true', 'completed').ok).toBe(false);
		expect(parseBoolean(1, 'completed').ok).toBe(false);
	});
});
