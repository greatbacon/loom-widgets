import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { WikiMigrateService } = await import('./wikiMigrateService.server');
const { MediaWikiError } = await import('./mediaWikiClient.server');
import type { MediaWikiClient } from './mediaWikiClient.server';

const source = {
	getArticle: vi.fn(),
	getPageText: vi.fn()
};
const dest = {
	listCategories: vi.fn(),
	createPage: vi.fn()
};

const service = () =>
	new WikiMigrateService(source as unknown as MediaWikiClient, dest as unknown as MediaWikiClient);

describe('WikiMigrateService', () => {
	beforeEach(() => {
		Object.values(source).forEach((m) => m.mockReset());
		Object.values(dest).forEach((m) => m.mockReset());
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	describe('getArticle', () => {
		it('returns the article', async () => {
			const article = { title: 'A', text: 't', nextTitle: 'B' };
			source.getArticle.mockResolvedValue(article);

			expect(await service().getArticle('')).toEqual({ ok: true, data: article, code: 200 });
		});

		it('returns ok with null data when there is no article', async () => {
			source.getArticle.mockResolvedValue(null);

			expect(await service().getArticle('Z')).toEqual({ ok: true, data: null, code: 200 });
		});

		it('rejects titles over 255 characters', async () => {
			const result = await service().getArticle('x'.repeat(256));

			expect(result).toMatchObject({ ok: false, code: 400 });
		});

		it('maps upstream errors to 502', async () => {
			source.getArticle.mockRejectedValue(new Error('boom'));

			expect(await service().getArticle('')).toEqual({
				ok: false,
				error: 'Failed to load article',
				code: 502
			});
		});
	});

	describe('listCategories', () => {
		it('returns destination categories', async () => {
			dest.listCategories.mockResolvedValue(['Foo']);

			expect(await service().listCategories()).toEqual({ ok: true, data: ['Foo'], code: 200 });
		});

		it('maps upstream errors to 502', async () => {
			dest.listCategories.mockRejectedValue(new Error('secret detail'));

			expect(await service().listCategories()).toEqual({
				ok: false,
				error: 'Failed to load categories',
				code: 502
			});
		});
	});

	describe('uploadArticle', () => {
		it('appends the category and creates the page on the destination', async () => {
			source.getPageText.mockResolvedValue('body text\n\n');
			dest.createPage.mockResolvedValue(undefined);

			const result = await service().uploadArticle('Apple', 'Fruit');

			expect(result).toEqual({ ok: true, data: { title: 'Apple' }, code: 200 });
			expect(dest.createPage).toHaveBeenCalledWith('Apple', 'body text\n\n[[Category:Fruit]]\n');
		});

		it.each([
			[undefined, 'Fruit'],
			['  ', 'Fruit'],
			['Apple', undefined],
			['Apple', ''],
			['x'.repeat(256), 'Fruit'],
			['Apple', 'x'.repeat(256)],
			['Apple', 'Fr|uit'],
			['Apple', 'Fr[uit]'],
			['Apple', 'Fr{uit}'],
			['Apple', 'Fr#uit'],
			['Apple', 'Fr<uit>']
		])('returns 400 for title=%j category=%j', async (title, category) => {
			const result = await service().uploadArticle(title, category);

			expect(result).toMatchObject({ ok: false, code: 400 });
			expect(dest.createPage).not.toHaveBeenCalled();
		});

		it('maps articleexists to 409', async () => {
			source.getPageText.mockResolvedValue('t');
			dest.createPage.mockRejectedValue(new MediaWikiError('articleexists', 'exists'));

			expect(await service().uploadArticle('Apple', 'Fruit')).toEqual({
				ok: false,
				error: 'Article already exists on destination',
				code: 409
			});
		});

		it('maps missingtitle to 404', async () => {
			source.getPageText.mockRejectedValue(new MediaWikiError('missingtitle', 'gone'));

			expect(await service().uploadArticle('Apple', 'Fruit')).toMatchObject({
				ok: false,
				code: 404
			});
		});

		it('maps other errors to 502 with a generic message', async () => {
			source.getPageText.mockResolvedValue('t');
			dest.createPage.mockRejectedValue(new MediaWikiError('badtoken', 'internal detail'));

			expect(await service().uploadArticle('Apple', 'Fruit')).toEqual({
				ok: false,
				error: 'Failed to upload article',
				code: 502
			});
		});
	});
});
