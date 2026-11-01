import { MediaWikiError, destWikiClient, sourceWikiClient } from './mediaWikiClient.server';
import type { MediaWikiClient } from './mediaWikiClient.server';
import type { WikiArticle, WikiCategory } from './wiki';

const log = console;

export interface Result<T> {
	ok: true;
	data: T;
	code: number;
}

export interface Error {
	ok: false;
	error: string;
	code: number;
}

const MAX_LENGTH = 255;
const INVALID_CATEGORY_CHARS = /[|[\]{}#<>]/;

export class WikiMigrateService {
	constructor(
		private readonly source: MediaWikiClient = sourceWikiClient(),
		private readonly dest: MediaWikiClient = destWikiClient()
	) {}

	async getArticle(from: string): Promise<Result<WikiArticle | null> | Error> {
		if (from.length > MAX_LENGTH) {
			return { ok: false, error: 'Title is too long', code: 400 };
		}
		try {
			return { ok: true, data: await this.source.getArticle(from), code: 200 };
		} catch (err) {
			return this.upstreamError('Failed to load article', err);
		}
	}

	async listCategories(): Promise<Result<WikiCategory[]> | Error> {
		try {
			return { ok: true, data: await this.dest.listCategories(), code: 200 };
		} catch (err) {
			return this.upstreamError('Failed to load categories', err);
		}
	}

	async uploadArticle(
		title: string | undefined,
		category: string | undefined,
		text?: string
	): Promise<Result<{ title: string }> | Error> {
		if (!title || !title.trim()) {
			return { ok: false, error: 'Title is required', code: 400 };
		}
		if (!category || !category.trim()) {
			return { ok: false, error: 'Category is required', code: 400 };
		}
		if (title.length > MAX_LENGTH || category.length > MAX_LENGTH) {
			return { ok: false, error: 'Title or category is too long', code: 400 };
		}
		if (text !== undefined && !text.trim()) {
			return { ok: false, error: 'Text must not be empty', code: 400 };
		}
		if (INVALID_CATEGORY_CHARS.test(category)) {
			return { ok: false, error: 'Category contains invalid characters', code: 400 };
		}

		try {
			const body = text ?? (await this.source.getPageText(title));
			await this.dest.createPage(title, `${body.trimEnd()}\n\n[[Category:${category}]]\n`);
			return { ok: true, data: { title }, code: 200 };
		} catch (err) {
			if (err instanceof MediaWikiError) {
				if (err.code === 'articleexists') {
					return { ok: false, error: 'Article already exists on destination', code: 409 };
				}
				if (err.code === 'missingtitle') {
					return { ok: false, error: 'Article not found on source', code: 404 };
				}
			}
			return this.upstreamError('Failed to upload article', err);
		}
	}

	private upstreamError(message: string, err: unknown): Error {
		log.error(message, err);
		return { ok: false, error: message, code: 502 };
	}
}
