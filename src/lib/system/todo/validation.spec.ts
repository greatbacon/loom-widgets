import { describe, it, expect } from 'vitest';
import { parseBoolean, parsePosition } from './validation';

describe('validation', () => {
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
