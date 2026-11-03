import { error, json } from '@sveltejs/kit';
import { TicketsService } from '$lib/system/tickets/ticketsService.server';
import { readJsonBody } from '$lib/system/util/readJsonBody';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const result = await new TicketsService().listTickets();
	if (!result.ok) error(result.code, result.error);
	return json(result.data);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.keycloakSubject) error(401, 'Unauthorized');
	const body = await readJsonBody(request);
	const result = await new TicketsService().createTicket(locals.keycloakSubject, body);
	if (!result.ok) error(result.code, result.error);
	return json(result.data, { status: result.code });
};
