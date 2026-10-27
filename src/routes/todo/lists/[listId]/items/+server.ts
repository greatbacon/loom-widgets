import { error, json } from '@sveltejs/kit';
import { TodoItemsService } from '$lib/system/todo/todoItemsService.server';
import { readJsonBody } from '$lib/system/todo/readJsonBody';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const result = await new TodoItemsService().listItems(params.listId);

	if (!result.ok) {
		error(result.code, result.error);
	}

	return json(result.data);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.keycloakSubject) error(401, 'Unauthorized');
	const body = await readJsonBody(request);

	const result = await new TodoItemsService().createItem(
		params.listId,
		locals.keycloakSubject,
		body.content
	);

	if (!result.ok) {
		error(result.code, result.error);
	}

	return json(result.data, { status: result.code });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const result = await new TodoItemsService().deleteCompletedItems(params.listId);

	if (!result.ok) {
		error(result.code, result.error);
	}

	return new Response(null, { status: 204 });
};
