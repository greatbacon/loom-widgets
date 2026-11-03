import type { Validated } from '$lib/system/util/validation';
import { TICKET_STATUSES, type TicketStatus } from './ticket';

export function parseStatus(value: unknown): Validated<TicketStatus> {
	if (typeof value === 'string' && (TICKET_STATUSES as readonly string[]).includes(value)) {
		return { ok: true, value: value as TicketStatus };
	}
	return { ok: false, error: `status must be one of: ${TICKET_STATUSES.join(', ')}` };
}

export function parseOwnerSub(value: unknown): Validated<string | null> {
	if (value === null) return { ok: true, value: null };
	if (typeof value !== 'string' || value.trim() === '') {
		return { ok: false, error: 'owner_sub must be a non-empty string or null' };
	}
	return { ok: true, value: value.trim() };
}
