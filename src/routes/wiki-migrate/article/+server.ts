import { error, json } from '@sveltejs/kit';
import { WikiMigrateService } from '$lib/system/wiki/wikiMigrateService.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const result = await new WikiMigrateService().getArticle(url.searchParams.get('from') ?? '');

	if (!result.ok) {
		error(result.code, result.error);
	}

	return json(result.data);
};
