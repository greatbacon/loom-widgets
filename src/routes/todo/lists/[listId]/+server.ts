import { error, json } from '@sveltejs/kit';
import { TodoListsService } from '$lib/system/todo/todoListsService.server';
import { readJsonBody } from '$lib/system/todo/readJsonBody';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const result = await new TodoListsService().getList(params.listId);

	if (!result.ok) {
		error(result.code, result.error);
	}

	return json(result.data);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await readJsonBody(request);

	const result = await new TodoListsService().updateList(params.listId, {
		name: body.name,
		position: body.position
	});

	if (!result.ok) {
		error(result.code, result.error);
	}

	return json(result.data);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const result = await new TodoListsService().deleteList(params.listId);

	if (!result.ok) {
		error(result.code, result.error);
	}

	return new Response(null, { status: 204 });
};
