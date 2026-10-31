import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({}) as Record<string, string | undefined>);

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const { MediaWikiClient, MediaWikiError, sourceWikiClient } = await import(
	'./mediaWikiClient.server'
);

const API = 'http://wiki.test/w/api.php';

const json = (body: unknown, headers: HeadersInit = {}) =>
	new Response(JSON.stringify(body), { status: 200, headers });

const loginResponses = () => [
	json({ query: { tokens: { logintoken: 'LT+\\' } } }, { 'set-cookie': 'sess=abc; Path=/' }),
	json({ login: { result: 'Success' } }, { 'set-cookie': 'user=bot; Path=/' })
];

const csrf = () => json({ query: { tokens: { csrftoken: 'CT+\\' } } });

const urlOf = (stub: ReturnType<typeof vi.fn>, call: number) => new URL(stub.mock.calls[call][0]);

describe('MediaWikiClient', () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	describe('getArticle', () => {
		it('returns title, text and nextTitle, querying from the given title', async () => {
			const fetchStub = vi
				.fn()
				.mockResolvedValueOnce(
					json({ query: { allpages: [{ title: 'Apple' }, { title: 'Banana' }] } })
				)
				.mockResolvedValueOnce(
					json({
						query: {
							pages: [
								{ title: 'Apple', revisions: [{ slots: { main: { content: 'red fruit' } } }] }
							]
						}
					})
				);
			vi.stubGlobal('fetch', fetchStub);

			const article = await new MediaWikiClient(API).getArticle('A');

			expect(article).toEqual({ title: 'Apple', text: 'red fruit', nextTitle: 'Banana' });
			const url = urlOf(fetchStub, 0);
			expect(url.searchParams.get('apfrom')).toBe('A');
			expect(url.searchParams.get('apnamespace')).toBe('0');
			expect(url.searchParams.get('apfilterredir')).toBe('nonredirects');
			expect(url.searchParams.get('aplimit')).toBe('2');
		});

		it('returns a null nextTitle on the last article', async () => {
			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					.mockResolvedValueOnce(json({ query: { allpages: [{ title: 'Zebra' }] } }))
					.mockResolvedValueOnce(
						json({
							query: { pages: [{ revisions: [{ slots: { main: { content: 'stripes' } } }] }] }
						})
					)
			);

			const article = await new MediaWikiClient(API).getArticle('Z');

			expect(article?.nextTitle).toBeNull();
		});

		it('returns null when the list is empty', async () => {
			const fetchStub = vi.fn().mockResolvedValue(json({ query: { allpages: [] } }));
			vi.stubGlobal('fetch', fetchStub);

			expect(await new MediaWikiClient(API).getArticle('')).toBeNull();
			expect(fetchStub).toHaveBeenCalledTimes(1);
		});
	});

	describe('getPageText', () => {
		it('throws missingtitle when the page has no content', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(json({ query: { pages: [{ title: 'Nope', missing: true }] } }))
			);

			await expect(new MediaWikiClient(API).getPageText('Nope')).rejects.toMatchObject({
				code: 'missingtitle'
			});
		});
	});

	describe('listCategories', () => {
		it('queries categories with parents, merges across batches and strips the prefix', async () => {
			const fetchStub = vi
				.fn()
				.mockResolvedValueOnce(
					json({
						continue: { clcontinue: '1|Foo|Bar', continue: '||' },
						query: {
							pages: [
								{ title: 'Category:Foo', categories: [{ title: 'Category:Bar' }] },
								{ title: 'Category:Baz' }
							]
						}
					})
				)
				.mockResolvedValueOnce(
					json({
						query: {
							pages: [{ title: 'Category:Foo', categories: [{ title: 'Category:Qux' }] }]
						}
					})
				);
			vi.stubGlobal('fetch', fetchStub);

			const result = await new MediaWikiClient(API).listCategories();

			expect(result).toEqual([
				{ name: 'Foo', parents: ['Bar', 'Qux'] },
				{ name: 'Baz', parents: [] }
			]);
			expect(fetchStub).toHaveBeenCalledTimes(2);
			const first = urlOf(fetchStub, 0);
			expect(first.searchParams.get('generator')).toBe('allcategories');
			expect(first.searchParams.get('prop')).toBe('categories|info');
			expect(urlOf(fetchStub, 1).searchParams.get('clcontinue')).toBe('1|Foo|Bar');
		});
	});

	describe('listCategories redirects', () => {
		it('excludes redirect categories and removes them from parents', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(
					json({
						query: {
							pages: [
								{ title: 'Category:Old', redirect: true, categories: [{ title: 'Category:Root' }] },
								{ title: 'Category:Root' },
								{ title: 'Category:Kid', categories: [{ title: 'Category:Old' }] }
							]
						}
					})
				)
			);

			const result = await new MediaWikiClient(API).listCategories();

			expect(result).toEqual([
				{ name: 'Root', parents: [] },
				{ name: 'Kid', parents: [] }
			]);
		});
	});

	describe('createPage', () => {
		it('logs in, then edits with createonly, csrf token and cookies', async () => {
			const fetchStub = vi
				.fn()
				.mockResolvedValueOnce(loginResponses()[0])
				.mockResolvedValueOnce(loginResponses()[1])
				.mockResolvedValueOnce(csrf())
				.mockResolvedValueOnce(json({ edit: { result: 'Success' } }));
			vi.stubGlobal('fetch', fetchStub);

			await new MediaWikiClient(API, 'bot', 'pw').createPage('Apple', 'text');

			const loginInit = fetchStub.mock.calls[1][1];
			expect(loginInit.method).toBe('POST');
			expect(loginInit.headers.Cookie).toBe('sess=abc');
			const loginBody = new URLSearchParams(loginInit.body);
			expect(loginBody.get('action')).toBe('login');
			expect(loginBody.get('lgname')).toBe('bot');
			expect(loginBody.get('lgtoken')).toBe('LT+\\');

			const editInit = fetchStub.mock.calls[3][1];
			expect(editInit.method).toBe('POST');
			expect(editInit.headers.Cookie).toBe('sess=abc; user=bot');
			expect(editInit.headers['User-Agent']).toBe('loom-widgets-wiki-migrate');
			const editBody = new URLSearchParams(editInit.body);
			expect(editBody.get('action')).toBe('edit');
			expect(editBody.get('createonly')).toBe('1');
			expect(editBody.get('token')).toBe('CT+\\');
			expect(editBody.get('title')).toBe('Apple');
			expect(editBody.get('text')).toBe('text');
		});

		it('maps articleexists to a MediaWikiError', async () => {
			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					.mockResolvedValueOnce(csrf())
					.mockResolvedValueOnce(
						json({
							error: {
								code: 'articleexists',
								info: 'The article you tried to create has been created already.'
							}
						})
					)
			);

			const promise = new MediaWikiClient(API).createPage('Apple', 'text');

			await expect(promise).rejects.toBeInstanceOf(MediaWikiError);
			await expect(promise).rejects.toMatchObject({ code: 'articleexists' });
		});

		it('does not log in when no username is configured', async () => {
			const fetchStub = vi
				.fn()
				.mockResolvedValueOnce(csrf())
				.mockResolvedValueOnce(json({ edit: { result: 'Success' } }));
			vi.stubGlobal('fetch', fetchStub);

			await new MediaWikiClient(API).createPage('Apple', 'text');

			expect(fetchStub).toHaveBeenCalledTimes(2);
			expect(urlOf(fetchStub, 0).searchParams.get('type')).toBe('csrf');
		});

		it('re-logs in exactly once on badtoken', async () => {
			const fetchStub = vi
				.fn()
				// first attempt: login, csrf, edit -> badtoken
				.mockResolvedValueOnce(loginResponses()[0])
				.mockResolvedValueOnce(loginResponses()[1])
				.mockResolvedValueOnce(csrf())
				.mockResolvedValueOnce(json({ error: { code: 'badtoken', info: 'Invalid CSRF token.' } }))
				// retry: login, csrf, edit -> success
				.mockResolvedValueOnce(loginResponses()[0])
				.mockResolvedValueOnce(loginResponses()[1])
				.mockResolvedValueOnce(csrf())
				.mockResolvedValueOnce(json({ edit: { result: 'Success' } }));
			vi.stubGlobal('fetch', fetchStub);

			await new MediaWikiClient(API, 'bot', 'pw').createPage('Apple', 'text');

			expect(fetchStub).toHaveBeenCalledTimes(8);
		});

		it('gives up after one retry when badtoken persists', async () => {
			const bad = () => json({ error: { code: 'badtoken', info: 'Invalid CSRF token.' } });
			const fetchStub = vi
				.fn()
				.mockResolvedValueOnce(loginResponses()[0])
				.mockResolvedValueOnce(loginResponses()[1])
				.mockResolvedValueOnce(csrf())
				.mockResolvedValueOnce(bad())
				.mockResolvedValueOnce(loginResponses()[0])
				.mockResolvedValueOnce(loginResponses()[1])
				.mockResolvedValueOnce(csrf())
				.mockResolvedValueOnce(bad());
			vi.stubGlobal('fetch', fetchStub);

			await expect(
				new MediaWikiClient(API, 'bot', 'pw').createPage('Apple', 'text')
			).rejects.toMatchObject({ code: 'badtoken' });
			expect(fetchStub).toHaveBeenCalledTimes(8);
		});
	});

	describe('login', () => {
		it('throws when login does not succeed', async () => {
			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					.mockResolvedValueOnce(loginResponses()[0])
					.mockResolvedValueOnce(json({ login: { result: 'Failed', reason: 'Wrong password' } }))
			);

			await expect(new MediaWikiClient(API, 'bot', 'bad').listCategories()).rejects.toThrow(
				'MediaWiki login failed on wiki.test: Wrong password'
			);
		});
	});

	describe('errors', () => {
		it('throws a descriptive error when the response is non-ok', async () => {
			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					.mockResolvedValue(new Response(null, { status: 503, statusText: 'Service Unavailable' }))
			);

			await expect(new MediaWikiClient(API).listCategories()).rejects.toThrow(
				'MediaWiki request failed: 503 Service Unavailable (wiki.test)'
			);
		});

		it('explains a non-JSON response such as an SSO login page', async () => {
			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Sign in</html>')));

			await expect(new MediaWikiClient(API).listCategories()).rejects.toThrow(
				'MediaWiki response from wiki.test was not JSON'
			);
		});

		it('propagates a network failure when fetch rejects', async () => {
			vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

			await expect(new MediaWikiClient(API).listCategories()).rejects.toThrow(
				'MediaWiki request to wiki.test failed: network down'
			);
		});
	});

	describe('extra headers', () => {
		it('sends configured headers on every request', async () => {
			const fetchStub = vi.fn().mockResolvedValue(json({ query: { pages: [] } }));
			vi.stubGlobal('fetch', fetchStub);

			await new MediaWikiClient(API, undefined, undefined, {
				'CF-Access-Client-Id': 'id'
			}).listCategories();

			expect(fetchStub.mock.calls[0][1].headers['CF-Access-Client-Id']).toBe('id');
			expect(fetchStub.mock.calls[0][1].headers['User-Agent']).toBe('loom-widgets-wiki-migrate');
		});

		it('sends the static cookie alongside MediaWiki session cookies', async () => {
			const fetchStub = vi
				.fn()
				.mockResolvedValueOnce(loginResponses()[0])
				.mockResolvedValueOnce(loginResponses()[1])
				.mockResolvedValueOnce(json({ query: { pages: [] } }));
			vi.stubGlobal('fetch', fetchStub);

			await new MediaWikiClient(API, 'bot', 'pw', {}, '_oauth2_proxy=xyz').listCategories();

			expect(fetchStub.mock.calls[0][1].headers.Cookie).toBe('_oauth2_proxy=xyz');
			expect(fetchStub.mock.calls[2][1].headers.Cookie).toBe(
				'_oauth2_proxy=xyz; sess=abc; user=bot'
			);
		});

		it('parses WIKI_SOURCE_HEADERS and rejects invalid JSON', async () => {
			mockEnv.WIKI_SOURCE_API_URL = API;
			mockEnv.WIKI_SOURCE_HEADERS = 'not json';

			expect(() => sourceWikiClient()).toThrow('WIKI_SOURCE_HEADERS must be a JSON object');
		});
	});

	describe('sourceWikiClient', () => {
		it('throws a clear error when the API URL is missing', () => {
			delete mockEnv.WIKI_SOURCE_API_URL;

			expect(() => sourceWikiClient()).toThrow('WIKI_SOURCE_API_URL is not configured');
		});
	});
});
