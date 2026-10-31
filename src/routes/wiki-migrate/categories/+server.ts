import { error, json } from '@sveltejs/kit';
import { WikiMigrateService } from '$lib/system/wiki/wikiMigrateService.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const result = await new WikiMigrateService().listCategories();

	if (!result.ok) {
		error(result.code, result.error);
	}

	return json(result.data);
};
