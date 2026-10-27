import { error, json } from '@sveltejs/kit';
import { TodoListsService } from '$lib/system/todo/todoListsService.server';
import { readJsonBody } from '$lib/system/todo/readJsonBody';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const result = await new TodoListsService().listLists();

	if (!result.ok) {
		error(result.code, result.error);
	}

	return json(result.data);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.keycloakSubject) error(401, 'Unauthorized');
	const body = await readJsonBody(request);

	const result = await new TodoListsService().createList(locals.keycloakSubject, body.name);

	if (!result.ok) {
		error(result.code, result.error);
	}

	return json(result.data, { status: result.code });
};
