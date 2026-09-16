import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAssetOriginal = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/immich/pictureFrameService.server', () => ({
	PictureFrameService: vi.fn().mockImplementation(function PictureFrameService() {
		return { getAssetOriginal };
	})
}));

const { GET } = await import('./+server');

describe('GET /picture-frame/original/[assetId]', () => {
	beforeEach(() => {
		getAssetOriginal.mockReset();
	});

	it('proxies the original bytes with the content type from the service', async () => {
		const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
		getAssetOriginal.mockResolvedValue({
			ok: true,
			data: { data: bytes, contentType: 'image/jpeg' },
			code: 200
		});

		const response = await GET({
			params: { assetId: 'asset-1' }
		} as Parameters<typeof GET>[0]);

		expect(getAssetOriginal).toHaveBeenCalledWith('asset-1');
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/jpeg');
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(bytes));
	});

	it('throws a SvelteKit error when the service returns a non-ok result', async () => {
		getAssetOriginal.mockResolvedValue({
			ok: false,
			error: 'Failed to fetch original from Immich',
			code: 502
		});

		await expect(
			GET({ params: { assetId: 'asset-1' } } as Parameters<typeof GET>[0])
		).rejects.toMatchObject({
			status: 502,
			body: { message: 'Failed to fetch original from Immich' }
		});
	});
});
