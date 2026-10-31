import { env } from '$env/dynamic/private';
import type { WikiArticle } from './wiki';

export class MediaWikiError extends Error {
	constructor(
		readonly code: string,
		message: string
	) {
		super(message);
	}
}

const RELOGIN_CODES = new Set(['badtoken', 'assertuserfailed', 'readapidenied']);

type Params = Record<string, string>;

interface ApiResponse {
	continue?: Params;
	query?: {
		allpages?: { title: string }[];
		allcategories?: { category: string }[];
		pages?: {
			missing?: boolean;
			revisions?: { slots?: { main?: { content?: string } } }[];
		}[];
		tokens?: Record<string, string>;
	};
	login?: { result?: string; reason?: string };
	error?: { code: string; info: string };
}

export class MediaWikiClient {
	private readonly cookies = new Map<string, string>();
	private loggedIn = false;
	private csrfToken: string | null = null;

	constructor(
		private readonly apiUrl: string,
		private readonly username?: string,
		private readonly password?: string,
		private readonly extraHeaders: Record<string, string> = {},
		private readonly staticCookie?: string
	) {}

	private get host(): string {
		try {
			return new URL(this.apiUrl).host;
		} catch {
			return this.apiUrl;
		}
	}

	async getArticle(from: string): Promise<WikiArticle | null> {
		const listing = await this.withRelogin(() =>
			this.request({
				action: 'query',
				list: 'allpages',
				apnamespace: '0',
				apfilterredir: 'nonredirects',
				apfrom: from,
				aplimit: '2'
			})
		);
		const pages = listing.query?.allpages ?? [];
		if (pages.length === 0) return null;

		const title = pages[0].title;
		const text = await this.getPageText(title);
		return { title, text, nextTitle: pages[1]?.title ?? null };
	}

	async getPageText(title: string): Promise<string> {
		const body = await this.withRelogin(() =>
			this.request({
				action: 'query',
				prop: 'revisions',
				rvprop: 'content',
				rvslots: 'main',
				titles: title
			})
		);
		const page = body.query?.pages?.[0];
		const content = page?.revisions?.[0]?.slots?.main?.content;
		if (!page || page.missing || typeof content !== 'string') {
			throw new MediaWikiError('missingtitle', `Page not found: ${title}`);
		}
		return content;
	}

	async listCategories(): Promise<string[]> {
		const names: string[] = [];
		let cont: Params | undefined;
		do {
			const params: Params = {
				action: 'query',
				list: 'allcategories',
				aclimit: 'max',
				...cont
			};
			const body = await this.withRelogin(() => this.request(params));
			for (const category of body.query?.allcategories ?? []) {
				names.push(category.category.replace(/^Category:/, ''));
			}
			cont = body.continue;
		} while (cont);
		return names;
	}

	async createPage(title: string, text: string): Promise<void> {
		await this.withRelogin(async () => {
			const token = await this.getCsrfToken();
			await this.request(
				{
					action: 'edit',
					title,
					text,
					createonly: '1',
					summary: 'Imported by loom-widgets wiki-migrate',
					token
				},
				true
			);
		});
	}

	private async withRelogin<T>(operation: () => Promise<T>): Promise<T> {
		try {
			return await operation();
		} catch (err) {
			if (this.username && err instanceof MediaWikiError && RELOGIN_CODES.has(err.code)) {
				this.loggedIn = false;
				this.csrfToken = null;
				this.cookies.clear();
				return await operation();
			}
			throw err;
		}
	}

	private async getCsrfToken(): Promise<string> {
		if (!this.csrfToken) {
			this.csrfToken = await this.getToken('csrf');
		}
		return this.csrfToken;
	}

	private async getToken(type: 'login' | 'csrf'): Promise<string> {
		const params = { action: 'query', meta: 'tokens', type };
		const body = type === 'login' ? await this.send(params, false) : await this.request(params);
		return body.query!.tokens![`${type}token`];
	}

	private async login(): Promise<void> {
		const lgtoken = await this.getToken('login');
		const body = await this.send(
			{
				action: 'login',
				lgname: this.username!,
				lgpassword: this.password ?? '',
				lgtoken
			},
			true
		);
		if (body.login?.result !== 'Success') {
			throw new MediaWikiError(
				'loginfailed',
				`MediaWiki login failed on ${this.host}: ${body.login?.reason ?? body.login?.result ?? 'unknown'}`
			);
		}
		this.loggedIn = true;
	}

	private async request(params: Params, post = false): Promise<ApiResponse> {
		if (this.username && !this.loggedIn) {
			await this.login();
		}
		return this.send(params, post);
	}

	private async send(params: Params, post: boolean): Promise<ApiResponse> {
		const all = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
		const headers: Record<string, string> = {
			...this.extraHeaders,
			'User-Agent': 'loom-widgets-wiki-migrate'
		};
		const cookie = [
			this.staticCookie,
			...[...this.cookies].map(([name, value]) => `${name}=${value}`)
		]
			.filter(Boolean)
			.join('; ');
		if (cookie) headers.Cookie = cookie;

		let response: Response;
		try {
			if (post) {
				headers['Content-Type'] = 'application/x-www-form-urlencoded';
				response = await fetch(this.apiUrl, { method: 'POST', headers, body: all.toString() });
			} else {
				response = await fetch(`${this.apiUrl}?${all.toString()}`, { headers });
			}
		} catch (err) {
			const reason = err instanceof Error ? err.message : String(err);
			throw new Error(`MediaWiki request to ${this.host} failed: ${reason}`, { cause: err });
		}

		if (!response.ok) {
			throw new Error(
				`MediaWiki request failed: ${response.status} ${response.statusText} (${this.host})`
			);
		}

		for (const setCookie of response.headers.getSetCookie?.() ?? []) {
			const [pair] = setCookie.split(';');
			const eq = pair.indexOf('=');
			if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
		}

		let body: ApiResponse;
		try {
			body = (await response.json()) as ApiResponse;
		} catch (err) {
			throw new Error(
				`MediaWiki response from ${this.host} was not JSON (expired SSO cookie or wrong API URL?)`,
				{ cause: err }
			);
		}
		if (body.error) {
			throw new MediaWikiError(body.error.code, `${body.error.info} (${this.host})`);
		}
		return body;
	}
}

function parseHeaders(raw: string | undefined, name: string): Record<string, string> {
	if (!raw) return {};
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error(`${name} must be a JSON object of header names to values`);
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new Error(`${name} must be a JSON object of header names to values`);
	}
	return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]));
}

function lazyClient(prefix: 'SOURCE' | 'DEST'): () => MediaWikiClient {
	let client: MediaWikiClient | undefined;
	return () => {
		if (!client) {
			const url = env[`WIKI_${prefix}_API_URL`];
			if (!url) throw new Error(`WIKI_${prefix}_API_URL is not configured`);
			client = new MediaWikiClient(
				url,
				env[`WIKI_${prefix}_USER`] || undefined,
				env[`WIKI_${prefix}_PASSWORD`] || undefined,
				parseHeaders(env[`WIKI_${prefix}_HEADERS`], `WIKI_${prefix}_HEADERS`),
				env[`WIKI_${prefix}_COOKIE`] || undefined
			);
		}
		return client;
	};
}

export const sourceWikiClient = lazyClient('SOURCE');
export const destWikiClient = lazyClient('DEST');
