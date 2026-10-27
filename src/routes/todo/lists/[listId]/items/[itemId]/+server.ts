import { error, json } from '@sveltejs/kit';
import { TodoItemsService } from '$lib/system/todo/todoItemsService.server';
import { readJsonBody } from '$lib/system/todo/readJsonBody';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await readJsonBody(request);

	const result = await new TodoItemsService().updateItem(params.listId, params.itemId, {
		content: body.content,
		completed: body.completed,
		position: body.position
	});

	if (!result.ok) {
		error(result.code, result.error);
	}

	return json(result.data);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const result = await new TodoItemsService().deleteItem(params.listId, params.itemId);

	if (!result.ok) {
		error(result.code, result.error);
	}

	return new Response(null, { status: 204 });
};
