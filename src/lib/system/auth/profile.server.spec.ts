import { describe, it, expect } from 'vitest';
import { extractProfile } from './profile.server';

describe('extractProfile', () => {
	it('uses preferred_username when present', () => {
		const profile = extractProfile(
			{ preferred_username: 'alice', email: 'alice@example.com', email_verified: true },
			'kc-user-1'
		);

		expect(profile).toEqual({
			username: 'alice',
			email: 'alice@example.com',
			email_verified: true
		});
	});

	it('falls back to email when preferred_username is absent', () => {
		const profile = extractProfile({ email: 'alice@example.com' }, 'kc-user-1');

		expect(profile.username).toBe('alice@example.com');
	});

	it('falls back to the subject when neither preferred_username nor email is present', () => {
		const profile = extractProfile({}, 'kc-user-1');

		expect(profile.username).toBe('kc-user-1');
	});

	it('falls back to the subject when claims are undefined', () => {
		const profile = extractProfile(undefined, 'kc-user-1');

		expect(profile).toEqual({ username: 'kc-user-1', email: null, email_verified: false });
	});

	it('only treats a strict boolean true as email_verified', () => {
		expect(extractProfile({ email_verified: 'true' }, 'kc-user-1').email_verified).toBe(false);
		expect(extractProfile({ email_verified: 1 }, 'kc-user-1').email_verified).toBe(false);
		expect(extractProfile({ email_verified: true }, 'kc-user-1').email_verified).toBe(true);
	});

	it('returns null email when the claim is not a string', () => {
		const profile = extractProfile({ email: 12345 }, 'kc-user-1');

		expect(profile.email).toBeNull();
	});
});
