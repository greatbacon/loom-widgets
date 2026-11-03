import { describe, it, expect } from 'vitest';
import { parseOwnerSub, parseStatus } from './validation';

describe('ticket validation', () => {
	it('parseStatus accepts every known status', () => {
		for (const s of ['backlog', 'todo', 'in_progress', 'done']) {
			expect(parseStatus(s)).toEqual({ ok: true, value: s });
		}
	});

	it('parseStatus rejects unknown and non-string values', () => {
		expect(parseStatus('blocked')).toEqual({
			ok: false,
			error: 'status must be one of: backlog, todo, in_progress, done'
		});
		expect(parseStatus('').ok).toBe(false);
		expect(parseStatus(1).ok).toBe(false);
		expect(parseStatus(undefined).ok).toBe(false);
	});

	it('parseOwnerSub allows null and trims strings', () => {
		expect(parseOwnerSub(null)).toEqual({ ok: true, value: null });
		expect(parseOwnerSub(' abc ')).toEqual({ ok: true, value: 'abc' });
	});

	it('parseOwnerSub rejects empty, blank, and non-string values', () => {
		expect(parseOwnerSub('').ok).toBe(false);
		expect(parseOwnerSub('   ').ok).toBe(false);
		expect(parseOwnerSub(5).ok).toBe(false);
		expect(parseOwnerSub(undefined).ok).toBe(false);
	});
});
