import { describe, it, expect, vi, beforeEach } from 'vitest';
import sinon from 'sinon';
import type { ImmichClient, ImmichAlbum } from './immichClient.server';

const mockEnv = vi.hoisted(() => ({
	IMMICH_URL: 'http://immich.test',
	IMMICH_ALBUM_ID: 'default-album-id'
}));

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const { PictureFrameService } = await import('./pictureFrameService.server');

const makeAlbum = (overrides: Partial<ImmichAlbum> = {}): ImmichAlbum => ({
	id: 'album-1',
	albumName: 'Trip',
	assets: [
		{
			id: 'asset-1',
			originalFileName: 'photo.jpg',
			fileCreatedAt: '2026-01-01T00:00:00Z',
			type: 'IMAGE'
		}
	],
	...overrides
});

describe('PictureFrameService', () => {
	let client: { getAlbum: sinon.SinonStub };
	let service: InstanceType<typeof PictureFrameService>;

	beforeEach(() => {
		mockEnv.IMMICH_URL = 'http://immich.test';
		mockEnv.IMMICH_ALBUM_ID = 'default-album-id';
		client = { getAlbum: sinon.stub() };
		service = new PictureFrameService(client as unknown as ImmichClient);
	});

	it('maps a successful getAlbum response into the expected shape', async () => {
		client.getAlbum.resolves(makeAlbum());

		const result = await service.getAlbumContents('album-1');

		expect(result).toEqual({
			ok: true,
			data: {
				albumId: 'album-1',
				albumName: 'Trip',
				assets: [
					{
						id: 'asset-1',
						filename: 'photo.jpg',
						takenAt: '2026-01-01T00:00:00Z',
						type: 'IMAGE',
						thumbnailUrl: 'http://immich.test/api/assets/asset-1/thumbnail',
						originalUrl: 'http://immich.test/api/assets/asset-1/original'
					}
				]
			},
			code: 200
		});
	});

	it('returns a 502 error when the client rejects', async () => {
		client.getAlbum.rejects(new Error('unreachable'));

		const result = await service.getAlbumContents('album-1');

		expect(result).toEqual({
			ok: false,
			error: 'Failed to fetch album from Immich',
			code: 502
		});
	});

	it('calls client.getAlbum with the default IMMICH_ALBUM_ID when no argument is passed', async () => {
		client.getAlbum.resolves(makeAlbum());

		await service.getAlbumContents();

		expect(client.getAlbum.calledWithExactly('default-album-id')).toBe(true);
	});

	it('calls client.getAlbum with an explicit argument when one is passed', async () => {
		client.getAlbum.resolves(makeAlbum());

		await service.getAlbumContents('explicit-album-id');

		expect(client.getAlbum.calledWithExactly('explicit-album-id')).toBe(true);
	});
});
