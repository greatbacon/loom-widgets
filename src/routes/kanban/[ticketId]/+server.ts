import { error, json } from '@sveltejs/kit';
import { TicketsService } from '$lib/system/tickets/ticketsService.server';
import { readJsonBody } from '$lib/system/util/readJsonBody';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const result = await new TicketsService().getTicket(params.ticketId);
	if (!result.ok) error(result.code, result.error);
	return json(result.data);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await readJsonBody(request);
	const result = await new TicketsService().updateTicket(params.ticketId, body);
	if (!result.ok) error(result.code, result.error);
	return json(result.data);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const result = await new TicketsService().deleteTicket(params.ticketId);
	if (!result.ok) error(result.code, result.error);
	return new Response(null, { status: 204 });
};
