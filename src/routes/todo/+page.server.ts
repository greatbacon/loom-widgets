import type { PageServerLoad } from './$types';
import { TodoListsService } from '$lib/system/todo/todoListsService.server';

export const load: PageServerLoad = async () => {
	const result = await new TodoListsService().listListsWithItems();

	return {
		lists: result.ok ? result.data : [],
		error: result.ok ? null : result.error
	};
};
