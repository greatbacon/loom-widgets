import { error, json } from '@sveltejs/kit';
import { readJsonBody } from '$lib/system/todo/readJsonBody';
import { WikiMigrateService } from '$lib/system/wiki/wikiMigrateService.server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);

	const result = await new WikiMigrateService().uploadArticle(
		typeof body.title === 'string' ? body.title : undefined,
		typeof body.category === 'string' ? body.category : undefined
	);

	if (!result.ok) {
		error(result.code, result.error);
	}

	return json(result.data);
};
