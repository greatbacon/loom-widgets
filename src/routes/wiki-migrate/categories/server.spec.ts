import { describe, it, expect, vi, beforeEach } from 'vitest';

const listCategories = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/wiki/wikiMigrateService.server', () => ({
	WikiMigrateService: vi.fn().mockImplementation(function WikiMigrateService() {
		return { listCategories };
	})
}));

const { GET } = await import('./+server');

describe('GET /wiki-migrate/categories', () => {
	beforeEach(() => listCategories.mockReset());

	it('returns the categories', async () => {
		listCategories.mockResolvedValue({
			ok: true,
			data: [
				{ name: 'Foo', parents: [] },
				{ name: 'Bar', parents: ['Foo'] }
			],
			code: 200
		});

		const response = await GET({} as Parameters<typeof GET>[0]);

		expect(await response.json()).toEqual([
			{ name: 'Foo', parents: [] },
			{ name: 'Bar', parents: ['Foo'] }
		]);
	});

	it('throws a SvelteKit error on failure', async () => {
		listCategories.mockResolvedValue({ ok: false, error: 'Failed to load categories', code: 502 });

		await expect(GET({} as Parameters<typeof GET>[0])).rejects.toMatchObject({
			status: 502,
			body: { message: 'Failed to load categories' }
		});
	});
});
