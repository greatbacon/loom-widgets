import { describe, it, expect, vi, beforeEach } from 'vitest';

const listCategories = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/wiki/wikiMigrateService.server', () => ({
	WikiMigrateService: vi.fn().mockImplementation(function WikiMigrateService() {
		return { listCategories };
	})
}));

const { load } = await import('./+page.server');

describe('/wiki-migrate +page.server', () => {
	beforeEach(() => listCategories.mockReset());

	it('returns the categories', async () => {
		listCategories.mockResolvedValue({ ok: true, data: [{ name: 'Foo', parents: [] }], code: 200 });

		const result = await load({} as Parameters<typeof load>[0]);

		expect(result).toEqual({ categories: [{ name: 'Foo', parents: [] }], categoriesError: null });
	});

	it('returns an empty list and the error on failure', async () => {
		listCategories.mockResolvedValue({ ok: false, error: 'Failed to load categories', code: 502 });

		const result = await load({} as Parameters<typeof load>[0]);

		expect(result).toEqual({ categories: [], categoriesError: 'Failed to load categories' });
	});
});
