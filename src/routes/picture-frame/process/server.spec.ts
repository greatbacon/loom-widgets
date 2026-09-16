import { describe, it, expect, vi, beforeEach } from 'vitest';

const processAsset = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/immich/pictureFrameService.server', () => ({
	PictureFrameService: vi.fn().mockImplementation(function PictureFrameService() {
		return { processAsset };
	})
}));

const { POST } = await import('./+server');

const makeRequest = (body: unknown) =>
	new Request('http://localhost/picture-frame/process', {
		method: 'POST',
		body: JSON.stringify(body)
	});

describe('POST /picture-frame/process', () => {
	beforeEach(() => {
		processAsset.mockReset();
	});

	it('calls processAsset with the assetId and crop from the request body', async () => {
		processAsset.mockResolvedValue({
			ok: true,
			data: {
				asset: { id: 'asset-1', filename: 'photo.jpg' },
				crop: { x: 10, y: 20, width: 300, height: 400 },
				device: { width: 1200, height: 1600 }
			},
			code: 200
		});

		const response = await POST({
			request: makeRequest({ assetId: 'asset-1', crop: { x: 10, y: 20, width: 300, height: 400 } })
		} as Parameters<typeof POST>[0]);

		expect(processAsset).toHaveBeenCalledWith('asset-1', { x: 10, y: 20, width: 300, height: 400 });
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			asset: { id: 'asset-1', filename: 'photo.jpg' },
			crop: { x: 10, y: 20, width: 300, height: 400 },
			device: { width: 1200, height: 1600 }
		});
	});

	it('throws a SvelteKit error when the service returns a non-ok result', async () => {
		processAsset.mockResolvedValue({
			ok: false,
			error: 'Crop rectangle is outside the image bounds',
			code: 400
		});

		await expect(
			POST({
				request: makeRequest({ assetId: 'asset-1', crop: { x: 0, y: 0, width: 1, height: 1 } })
			} as Parameters<typeof POST>[0])
		).rejects.toMatchObject({
			status: 400,
			body: { message: 'Crop rectangle is outside the image bounds' }
		});
	});
});
