import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
	IMMICH_URL: 'http://immich.test',
	IMMICH_API_KEY: 'test-key'
}));

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const { ImmichClient } = await import('./immichClient.server');

describe('ImmichClient', () => {
	beforeEach(() => {
		mockEnv.IMMICH_URL = 'http://immich.test';
		mockEnv.IMMICH_API_KEY = 'test-key';
		vi.unstubAllGlobals();
	});

	it('builds the request with the correct URL and x-api-key header', async () => {
		const fetchStub = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ id: 'album-1', albumName: 'Trip', assets: [] }), {
				status: 200
			})
		);
		vi.stubGlobal('fetch', fetchStub);

		const client = new ImmichClient();
		await client.getAlbum('album-1');

		expect(fetchStub).toHaveBeenCalledWith('http://immich.test/api/albums/album-1', {
			headers: { 'x-api-key': 'test-key', Accept: 'application/json' }
		});
	});

	it('returns the parsed JSON body on a 200 response', async () => {
		const album = { id: 'album-1', albumName: 'Trip', assets: [] };
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response(JSON.stringify(album), { status: 200 }))
		);

		const client = new ImmichClient();
		const result = await client.getAlbum('album-1');

		expect(result).toEqual(album);
	});

	it('throws a descriptive error when the response is non-ok', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response(null, { status: 404, statusText: 'Not Found' }))
		);

		const client = new ImmichClient();

		await expect(client.getAlbum('missing-album')).rejects.toThrow(
			'Immich request failed: 404 Not Found'
		);
	});

	it('propagates a network failure when fetch rejects', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

		const client = new ImmichClient();

		await expect(client.getAlbum('album-1')).rejects.toThrow('network down');
	});

	describe('getAssetOriginal', () => {
		it('builds the request with the correct URL and x-api-key header', async () => {
			const fetchStub = vi
				.fn()
				.mockResolvedValue(new Response(new Blob([new Uint8Array([1, 2, 3])]), { status: 200 }));
			vi.stubGlobal('fetch', fetchStub);

			const client = new ImmichClient();
			await client.getAssetOriginal('asset-1');

			expect(fetchStub).toHaveBeenCalledWith('http://immich.test/api/assets/asset-1/original', {
				headers: { 'x-api-key': 'test-key' }
			});
		});

		it('returns the raw bytes and content type on a 200 response', async () => {
			const bytes = new Uint8Array([1, 2, 3, 4]);
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(
					new Response(new Blob([bytes]), {
						status: 200,
						headers: { 'content-type': 'image/webp' }
					})
				)
			);

			const client = new ImmichClient();
			const result = await client.getAssetOriginal('asset-1');

			expect(new Uint8Array(result.data)).toEqual(bytes);
			expect(result.contentType).toBe('image/webp');
		});

		it('defaults content type to image/jpeg when the header is missing', async () => {
			const bytes = new Uint8Array([1, 2, 3, 4]);
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(new Response(new Blob([bytes]), { status: 200 }))
			);

			const client = new ImmichClient();
			const result = await client.getAssetOriginal('asset-1');

			expect(result.contentType).toBe('image/jpeg');
		});

		it('throws a descriptive error when the response is non-ok', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(new Response(null, { status: 404, statusText: 'Not Found' }))
			);

			const client = new ImmichClient();

			await expect(client.getAssetOriginal('missing-asset')).rejects.toThrow(
				'Immich request failed: 404 Not Found'
			);
		});

		it('propagates a network failure when fetch rejects', async () => {
			vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

			const client = new ImmichClient();

			await expect(client.getAssetOriginal('asset-1')).rejects.toThrow('network down');
		});
	});

	describe('getAssetThumbnail', () => {
		it('builds the request with the correct URL and x-api-key header', async () => {
			const fetchStub = vi.fn().mockResolvedValue(
				new Response(new Blob([new Uint8Array([1, 2, 3])]), {
					status: 200,
					headers: { 'content-type': 'image/webp' }
				})
			);
			vi.stubGlobal('fetch', fetchStub);

			const client = new ImmichClient();
			await client.getAssetThumbnail('asset-1');

			expect(fetchStub).toHaveBeenCalledWith('http://immich.test/api/assets/asset-1/thumbnail', {
				headers: { 'x-api-key': 'test-key' }
			});
		});

		it('returns the raw bytes and content type on a 200 response', async () => {
			const bytes = new Uint8Array([1, 2, 3, 4]);
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(
					new Response(new Blob([bytes]), {
						status: 200,
						headers: { 'content-type': 'image/webp' }
					})
				)
			);

			const client = new ImmichClient();
			const result = await client.getAssetThumbnail('asset-1');

			expect(new Uint8Array(result.data)).toEqual(bytes);
			expect(result.contentType).toBe('image/webp');
		});

		it('defaults content type to image/jpeg when the header is missing', async () => {
			const bytes = new Uint8Array([1, 2, 3, 4]);
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(new Response(new Blob([bytes]), { status: 200 }))
			);

			const client = new ImmichClient();
			const result = await client.getAssetThumbnail('asset-1');

			expect(result.contentType).toBe('image/jpeg');
		});

		it('throws a descriptive error when the response is non-ok', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(new Response(null, { status: 404, statusText: 'Not Found' }))
			);

			const client = new ImmichClient();

			await expect(client.getAssetThumbnail('missing-asset')).rejects.toThrow(
				'Immich request failed: 404 Not Found'
			);
		});

		it('propagates a network failure when fetch rejects', async () => {
			vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

			const client = new ImmichClient();

			await expect(client.getAssetThumbnail('asset-1')).rejects.toThrow('network down');
		});
	});
});
