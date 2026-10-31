import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { replaceState } from '$app/navigation';
import Page from './+page.svelte';
import type { WikiArticle } from '$lib/system/wiki/wiki';

const mockPage = vi.hoisted(() => ({ url: new URL('http://localhost/wiki-migrate'), state: {} }));
vi.mock('$app/state', () => ({ page: mockPage }));
vi.mock('$app/navigation', () => ({ replaceState: vi.fn() }));

const lastCursorUrl = () => {
	const calls = vi.mocked(replaceState).mock.calls;
	return (calls[calls.length - 1][0] as URL).searchParams.get('from');
};

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function stubFetch(handler: Handler) {
	const fetchStub = vi.fn(async (url: string, init?: RequestInit) => handler(url, init));
	vi.stubGlobal('fetch', fetchStub);
	return fetchStub;
}

afterEach(() => {
	mockPage.url = new URL('http://localhost/wiki-migrate');
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const data = {
	isAuthenticated: true,
	categories: [
		{ name: 'Fruit', parents: [] },
		{ name: 'Veg', parents: [] },
		{ name: 'Apple', parents: ['Fruit'] }
	],
	categoriesError: null as string | null
};

const article = (title: string, nextTitle: string | null): WikiArticle => ({
	title,
	text: `text of ${title}`,
	nextTitle
});

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const articleHandler =
	(articles: Record<string, WikiArticle | null>, onUpload?: Handler): Handler =>
	(url, init) => {
		if (url.startsWith('/wiki-migrate/article')) {
			const from = new URL(url, 'http://localhost').searchParams.get('from') ?? '';
			return json(articles[from] ?? null);
		}
		if (url === '/wiki-migrate/upload') {
			return onUpload ? onUpload(url, init) : json({ title: 'x' });
		}
		return new Response('unexpected', { status: 500 });
	};

describe('/wiki-migrate/+page.svelte', () => {
	it('loads and shows the first article on Start', async () => {
		stubFetch(articleHandler({ '': article('Apple', 'Banana') }));
		render(Page, { data });

		await page.getByRole('button', { name: 'Start' }).click();

		await expect.element(page.getByRole('heading', { name: 'Apple' })).toBeInTheDocument();
		await expect.element(page.getByText('text of Apple')).toBeInTheDocument();
	});

	it('sends the start-from value as from', async () => {
		const fetchStub = stubFetch(articleHandler({ 'Ca t': article('Ca t', null) }));
		render(Page, { data });

		await page.getByLabelText('Start from').fill('Ca t');
		await page.getByRole('button', { name: 'Start' }).click();

		await expect.element(page.getByRole('heading', { name: 'Ca t' })).toBeInTheDocument();
		expect(fetchStub).toHaveBeenCalledWith('/wiki-migrate/article?from=Ca%20t');
	});

	it('disables Upload until a category is picked', async () => {
		stubFetch(articleHandler({ '': article('Apple', null) }));
		render(Page, { data });
		await page.getByRole('button', { name: 'Start' }).click();

		const upload = page.getByRole('button', { name: 'Upload with category' });
		await expect.element(upload).toBeDisabled();

		await page.getByRole('button', { name: 'Veg', exact: true }).click();

		await expect.element(upload).toBeEnabled();
	});

	it('uploads the title and category, then shows the next article', async () => {
		const fetchStub = stubFetch(
			articleHandler({ '': article('Apple', 'Banana'), Banana: article('Banana', null) })
		);
		render(Page, { data });
		await page.getByRole('button', { name: 'Start' }).click();

		await page.getByRole('button', { name: 'Veg', exact: true }).click();
		await page.getByRole('button', { name: 'Upload with category' }).click();

		await expect.element(page.getByRole('heading', { name: 'Banana' })).toBeInTheDocument();
		const uploadCall = fetchStub.mock.calls.find(([url]) => url === '/wiki-migrate/upload');
		expect(JSON.parse(uploadCall![1]!.body as string)).toEqual({
			title: 'Apple',
			category: 'Veg'
		});
		await expect.element(page.getByText('Uploaded: 1')).toBeInTheDocument();
		await expect.element(page.getByText('No category selected')).toBeInTheDocument();
	});

	it('uploads the leaf reached by drilling down', async () => {
		const fetchStub = stubFetch(articleHandler({ '': article('Apple pie', null) }));
		render(Page, { data });
		await page.getByRole('button', { name: 'Start' }).click();

		await page.getByRole('button', { name: 'Fruit', exact: false }).first().click();
		await page.getByRole('button', { name: 'Apple', exact: true }).click();
		await page.getByRole('button', { name: 'Upload with category' }).click();

		await expect.element(page.getByText('end of list reached!')).toBeInTheDocument();
		const uploadCall = fetchStub.mock.calls.find(([url]) => url === '/wiki-migrate/upload');
		expect(JSON.parse(uploadCall![1]!.body as string)).toEqual({
			title: 'Apple pie',
			category: 'Apple'
		});
	});

	it('skips to the next article without calling upload', async () => {
		const fetchStub = stubFetch(
			articleHandler({ '': article('Apple', 'Banana'), Banana: article('Banana', null) })
		);
		render(Page, { data });
		await page.getByRole('button', { name: 'Start' }).click();

		await page.getByRole('button', { name: 'Skip' }).click();

		await expect.element(page.getByRole('heading', { name: 'Banana' })).toBeInTheDocument();
		expect(fetchStub.mock.calls.some(([url]) => url === '/wiki-migrate/upload')).toBe(false);
		await expect.element(page.getByText('Skipped: 1')).toBeInTheDocument();
	});

	it('shows the error and keeps the article when upload fails with 409', async () => {
		stubFetch(
			articleHandler(
				{ '': article('Apple', 'Banana') },
				() =>
					new Response(JSON.stringify({ message: 'Article already exists on destination' }), {
						status: 409
					})
			)
		);
		render(Page, { data });
		await page.getByRole('button', { name: 'Start' }).click();

		await page.getByRole('button', { name: 'Veg', exact: true }).click();
		await page.getByRole('button', { name: 'Upload with category' }).click();

		await expect
			.element(page.getByText('Article already exists on destination'))
			.toBeInTheDocument();
		await expect.element(page.getByRole('heading', { name: 'Apple' })).toBeInTheDocument();
		await expect.element(page.getByText('Uploaded: 0')).toBeInTheDocument();
	});

	it('shows the end-of-list banner when skipping the last article', async () => {
		stubFetch(articleHandler({ '': article('Zebra', null) }));
		render(Page, { data });
		await page.getByRole('button', { name: 'Start' }).click();

		await page.getByRole('button', { name: 'Skip' }).click();

		await expect.element(page.getByText('end of list reached!')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Start from')).toHaveValue('');
		expect(lastCursorUrl()).toBeNull();
	});

	it('shows the end-of-list banner when the start title yields nothing', async () => {
		stubFetch(articleHandler({}));
		render(Page, { data });

		await page.getByRole('button', { name: 'Start' }).click();

		await expect.element(page.getByText('end of list reached!')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Start from')).toHaveValue('');
	});

	it('pre-fills and auto-loads from ?from=', async () => {
		mockPage.url = new URL('http://localhost/wiki-migrate?from=Banana');
		const fetchStub = stubFetch(articleHandler({ Banana: article('Banana', null) }));
		render(Page, { data });

		await expect.element(page.getByRole('heading', { name: 'Banana' })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Start from')).toHaveValue('Banana');
		expect(fetchStub).toHaveBeenCalledWith('/wiki-migrate/article?from=Banana');
	});

	it('does not auto-load without ?from=', async () => {
		const fetchStub = stubFetch(articleHandler({}));
		render(Page, { data });

		await expect.element(page.getByLabelText('Start from')).toHaveValue('');
		expect(fetchStub).not.toHaveBeenCalled();
	});

	it('field and URL follow the shown article after upload', async () => {
		stubFetch(articleHandler({ '': article('Apple', 'Banana'), Banana: article('Banana', null) }));
		render(Page, { data });
		await page.getByRole('button', { name: 'Start' }).click();

		await page.getByRole('button', { name: 'Veg', exact: true }).click();
		await page.getByRole('button', { name: 'Upload with category' }).click();

		await expect.element(page.getByRole('heading', { name: 'Banana' })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Start from')).toHaveValue('Banana');
		expect(lastCursorUrl()).toBe('Banana');
	});

	it('field and URL follow the shown article after skip', async () => {
		stubFetch(articleHandler({ '': article('Apple', 'Banana'), Banana: article('Banana', null) }));
		render(Page, { data });
		await page.getByRole('button', { name: 'Start' }).click();

		await page.getByRole('button', { name: 'Skip' }).click();

		await expect.element(page.getByRole('heading', { name: 'Banana' })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Start from')).toHaveValue('Banana');
		expect(lastCursorUrl()).toBe('Banana');
	});

	it('updates the field to the returned title when starting with a prefix', async () => {
		stubFetch(articleHandler({ Ap: article('Apple', null) }));
		render(Page, { data });

		await page.getByLabelText('Start from').fill('Ap');
		await page.getByRole('button', { name: 'Start' }).click();

		await expect.element(page.getByRole('heading', { name: 'Apple' })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Start from')).toHaveValue('Apple');
	});

	it('leaves the field unchanged on article fetch error', async () => {
		stubFetch(() => new Response('boom', { status: 500 }));
		render(Page, { data });

		await page.getByLabelText('Start from').fill('Ap');
		await page.getByRole('button', { name: 'Start' }).click();

		await expect.element(page.getByText('boom')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Start from')).toHaveValue('Ap');
		expect(replaceState).not.toHaveBeenCalled();
	});

	it('shows the categories error', async () => {
		render(Page, {
			data: { ...data, categories: [], categoriesError: 'Failed to load categories' }
		});

		await expect.element(page.getByText('Failed to load categories')).toBeInTheDocument();
	});
});
