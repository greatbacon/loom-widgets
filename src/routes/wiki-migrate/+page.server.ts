import type { PageServerLoad } from './$types';
import { WikiMigrateService } from '$lib/system/wiki/wikiMigrateService.server';

export const load: PageServerLoad = async () => {
	try {
		const result = await new WikiMigrateService().listCategories();

		return {
			categories: result.ok ? result.data : [],
			categoriesError: result.ok ? null : result.error
		};
	} catch (err) {
		return {
			categories: [],
			categoriesError: err instanceof Error ? err.message : 'Wiki is not configured'
		};
	}
};
