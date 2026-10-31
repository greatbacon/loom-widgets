import { describe, it, expect, vi, beforeEach } from 'vitest';

const getArticle = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/wiki/wikiMigrateService.server', () => ({
	WikiMigrateService: vi.fn().mockImplementation(function WikiMigrateService() {
		return { getArticle };
	})
}));

const { GET } = await import('./+server');

const eventFor = (query: string) =>
	({ url: new URL(`http://localhost/wiki-migrate/article${query}`) }) as Parameters<typeof GET>[0];

describe('GET /wiki-migrate/article', () => {
	beforeEach(() => getArticle.mockReset());

	it('passes the from param and returns the article', async () => {
		const article = { title: 'Apple', text: 't', nextTitle: null };
		getArticle.mockResolvedValue({ ok: true, data: article, code: 200 });

		const response = await GET(eventFor('?from=Ap'));

		expect(getArticle).toHaveBeenCalledWith('Ap');
		expect(await response.json()).toEqual(article);
	});

	it('defaults from to an empty string and returns null when exhausted', async () => {
		getArticle.mockResolvedValue({ ok: true, data: null, code: 200 });

		const response = await GET(eventFor(''));

		expect(getArticle).toHaveBeenCalledWith('');
		expect(await response.json()).toBeNull();
	});

	it('throws a SvelteKit error on failure', async () => {
		getArticle.mockResolvedValue({ ok: false, error: 'Failed to load article', code: 502 });

		await expect(GET(eventFor(''))).rejects.toMatchObject({
			status: 502,
			body: { message: 'Failed to load article' }
		});
	});
});
