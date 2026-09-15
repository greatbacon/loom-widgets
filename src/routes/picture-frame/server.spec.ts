import { describe, it, expect, vi, beforeEach } from 'vitest';

const pushAsset = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/immich/pictureFrameService.server', () => ({
	PictureFrameService: vi.fn().mockImplementation(function PictureFrameService() {
		return { pushAsset };
	})
}));

const { POST } = await import('./+server');

const makeRequest = (body?: unknown) =>
	new Request('http://localhost/picture-frame', {
		method: 'POST',
		body: body === undefined ? undefined : JSON.stringify(body)
	});

describe('POST /picture-frame', () => {
	beforeEach(() => {
		pushAsset.mockReset();
	});

	it('calls pushAsset with undefined when no body is sent', async () => {
		pushAsset.mockResolvedValue({
			ok: true,
			data: {
				asset: { id: 'asset-1', filename: 'photo.jpg' },
				device: { width: 1200, height: 1600 },
				path: '/gallerys/default/asset-1.jpg'
			},
			code: 200
		});

		const response = await POST({ request: makeRequest() } as Parameters<typeof POST>[0]);

		expect(pushAsset).toHaveBeenCalledWith(undefined);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			asset: { id: 'asset-1', filename: 'photo.jpg' },
			device: { width: 1200, height: 1600 },
			path: '/gallerys/default/asset-1.jpg'
		});
	});

	it('calls pushAsset with the assetId from the request body', async () => {
		pushAsset.mockResolvedValue({
			ok: true,
			data: {
				asset: { id: 'asset-2', filename: 'other.jpg' },
				device: { width: 1200, height: 1600 },
				path: '/gallerys/default/asset-2.jpg'
			},
			code: 200
		});

		await POST({ request: makeRequest({ assetId: 'asset-2' }) } as Parameters<typeof POST>[0]);

		expect(pushAsset).toHaveBeenCalledWith('asset-2');
	});

	it('throws a SvelteKit error when the service returns a non-ok result', async () => {
		pushAsset.mockResolvedValue({ ok: false, error: 'Asset not found in album', code: 404 });

		await expect(
			POST({ request: makeRequest({ assetId: 'missing' }) } as Parameters<typeof POST>[0])
		).rejects.toMatchObject({ status: 404, body: { message: 'Asset not found in album' } });
	});
});
