import { describe, it, expect } from 'vitest';
import { isUuid, parseBody, parseId, parseText } from './validation';

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

	it('parseBody allows any string, including empty, without trimming', () => {
		expect(parseBody('hello')).toEqual({ ok: true, value: 'hello' });
		expect(parseBody('')).toEqual({ ok: true, value: '' });
		expect(parseBody('  hi  ')).toEqual({ ok: true, value: '  hi  ' });
		expect(parseBody(1)).toEqual({ ok: false, error: 'body must be a string' });
		expect(parseBody(null).ok).toBe(false);
		expect(parseBody(undefined).ok).toBe(false);
	});
});
