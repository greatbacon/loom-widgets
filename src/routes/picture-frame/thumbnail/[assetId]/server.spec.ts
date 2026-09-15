import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAssetThumbnail = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/immich/pictureFrameService.server', () => ({
	PictureFrameService: vi.fn().mockImplementation(function PictureFrameService() {
		return { getAssetThumbnail };
	})
}));

const { GET } = await import('./+server');

describe('GET /picture-frame/thumbnail/[assetId]', () => {
	beforeEach(() => {
		getAssetThumbnail.mockReset();
	});

	it('proxies the thumbnail bytes with the content type from the service', async () => {
		const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
		getAssetThumbnail.mockResolvedValue({
			ok: true,
			data: { data: bytes, contentType: 'image/webp' },
			code: 200
		});

		const response = await GET({
			params: { assetId: 'asset-1' }
		} as Parameters<typeof GET>[0]);

		expect(getAssetThumbnail).toHaveBeenCalledWith('asset-1');
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/webp');
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(bytes));
	});

	it('throws a SvelteKit error when the service returns a non-ok result', async () => {
		getAssetThumbnail.mockResolvedValue({
			ok: false,
			error: 'Failed to fetch thumbnail from Immich',
			code: 502
		});

		await expect(
			GET({ params: { assetId: 'asset-1' } } as Parameters<typeof GET>[0])
		).rejects.toMatchObject({
			status: 502,
			body: { message: 'Failed to fetch thumbnail from Immich' }
		});
	});
});
