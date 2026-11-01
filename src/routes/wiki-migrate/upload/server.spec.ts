import { describe, it, expect, vi, beforeEach } from 'vitest';

const uploadArticle = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/wiki/wikiMigrateService.server', () => ({
	WikiMigrateService: vi.fn().mockImplementation(function WikiMigrateService() {
		return { uploadArticle };
	})
}));

const { POST } = await import('./+server');

const requestWith = (body: string) =>
	({
		request: new Request('http://localhost/wiki-migrate/upload', { method: 'POST', body })
	}) as Parameters<typeof POST>[0];

describe('POST /wiki-migrate/upload', () => {
	beforeEach(() => uploadArticle.mockReset());

	it('uploads and returns the title', async () => {
		uploadArticle.mockResolvedValue({ ok: true, data: { title: 'Apple' }, code: 200 });

		const response = await POST(requestWith(JSON.stringify({ title: 'Apple', category: 'Fruit' })));

		expect(uploadArticle).toHaveBeenCalledWith('Apple', 'Fruit', undefined);
		expect(await response.json()).toEqual({ title: 'Apple' });
	});

	it('passes edited text through', async () => {
		uploadArticle.mockResolvedValue({ ok: true, data: { title: 'Apple' }, code: 200 });

		await POST(requestWith(JSON.stringify({ title: 'Apple', category: 'Fruit', text: 'edited' })));

		expect(uploadArticle).toHaveBeenCalledWith('Apple', 'Fruit', 'edited');
	});

	it('passes undefined for non-string fields', async () => {
		uploadArticle.mockResolvedValue({ ok: false, error: 'Title is required', code: 400 });

		await expect(POST(requestWith(JSON.stringify({ title: 5 })))).rejects.toMatchObject({
			status: 400
		});
		expect(uploadArticle).toHaveBeenCalledWith(undefined, undefined, undefined);
	});

	it('returns 400 for invalid JSON', async () => {
		await expect(POST(requestWith('nope'))).rejects.toMatchObject({
			status: 400,
			body: { message: 'Invalid JSON body' }
		});
	});

	it('maps a 409 conflict', async () => {
		uploadArticle.mockResolvedValue({
			ok: false,
			error: 'Article already exists on destination',
			code: 409
		});

		await expect(
			POST(requestWith(JSON.stringify({ title: 'Apple', category: 'Fruit' })))
		).rejects.toMatchObject({
			status: 409,
			body: { message: 'Article already exists on destination' }
		});
	});
});
