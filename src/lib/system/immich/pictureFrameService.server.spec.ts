import { describe, it, expect, vi, beforeEach } from 'vitest';
import sinon from 'sinon';
import type { ImmichClient, ImmichAlbum } from './immichClient.server';
import type { Bloomin8Client } from '$lib/system/bloomin8/bloomin8Client.server';

const mockEnv = vi.hoisted(() => ({
	IMMICH_URL: 'http://immich.test',
	IMMICH_ALBUM_ID: 'default-album-id'
}));

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

vi.mock('sharp', () => {
	const instance = {
		resize: vi.fn().mockReturnThis(),
		jpeg: vi.fn().mockReturnThis(),
		toBuffer: vi.fn().mockResolvedValue(Buffer.from('jpeg-bytes'))
	};
	return { default: vi.fn(() => instance) };
});

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
	let immichClient: {
		getAlbum: sinon.SinonStub;
		getAssetOriginal: sinon.SinonStub;
		getAssetThumbnail: sinon.SinonStub;
	};
	let bloomin8Client: { getDeviceInfo: sinon.SinonStub; uploadImage: sinon.SinonStub };
	let service: InstanceType<typeof PictureFrameService>;

	beforeEach(() => {
		mockEnv.IMMICH_URL = 'http://immich.test';
		mockEnv.IMMICH_ALBUM_ID = 'default-album-id';
		immichClient = {
			getAlbum: sinon.stub(),
			getAssetOriginal: sinon.stub(),
			getAssetThumbnail: sinon.stub()
		};
		bloomin8Client = { getDeviceInfo: sinon.stub(), uploadImage: sinon.stub() };
		service = new PictureFrameService(
			immichClient as unknown as ImmichClient,
			bloomin8Client as unknown as Bloomin8Client
		);
	});

	describe('getAlbumContents', () => {
		it('maps a successful getAlbum response into the expected shape', async () => {
			immichClient.getAlbum.resolves(makeAlbum());

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
							thumbnailUrl: '/picture-frame/thumbnail/asset-1',
							originalUrl: 'http://immich.test/api/assets/asset-1/original'
						}
					]
				},
				code: 200
			});
		});

		it('returns a 502 error when the client rejects', async () => {
			immichClient.getAlbum.rejects(new Error('unreachable'));

			const result = await service.getAlbumContents('album-1');

			expect(result).toEqual({
				ok: false,
				error: 'Failed to fetch album from Immich',
				code: 502
			});
		});

		it('calls client.getAlbum with the default IMMICH_ALBUM_ID when no argument is passed', async () => {
			immichClient.getAlbum.resolves(makeAlbum());

			await service.getAlbumContents();

			expect(immichClient.getAlbum.calledWithExactly('default-album-id')).toBe(true);
		});

		it('calls client.getAlbum with an explicit argument when one is passed', async () => {
			immichClient.getAlbum.resolves(makeAlbum());

			await service.getAlbumContents('explicit-album-id');

			expect(immichClient.getAlbum.calledWithExactly('explicit-album-id')).toBe(true);
		});
	});

	describe('pushAsset', () => {
		beforeEach(() => {
			immichClient.getAssetOriginal.resolves(new Uint8Array([1, 2, 3]).buffer);
			bloomin8Client.getDeviceInfo.resolves({ width: 1200, height: 1600 });
			bloomin8Client.uploadImage.resolves({ status: 100, path: '/gallerys/default/asset-1.jpg' });
		});

		it('picks a random asset, resizes it to the device resolution, uploads it, and returns the result', async () => {
			immichClient.getAlbum.resolves(makeAlbum());

			const result = await service.pushAsset(undefined, 'album-1');

			expect(immichClient.getAlbum.calledWithExactly('album-1')).toBe(true);
			expect(immichClient.getAssetOriginal.calledWithExactly('asset-1')).toBe(true);
			expect(bloomin8Client.getDeviceInfo.called).toBe(true);
			expect(
				bloomin8Client.uploadImage.calledWithExactly(Buffer.from('jpeg-bytes'), 'asset-1.jpg', {
					showNow: true
				})
			).toBe(true);
			expect(result).toEqual({
				ok: true,
				data: {
					asset: { id: 'asset-1', filename: 'photo.jpg' },
					device: { width: 1200, height: 1600 },
					path: '/gallerys/default/asset-1.jpg'
				},
				code: 200
			});
		});

		it('returns a 502 error without contacting other clients when the album has no assets', async () => {
			immichClient.getAlbum.resolves(makeAlbum({ assets: [] }));

			const result = await service.pushAsset(undefined, 'album-1');

			expect(result).toEqual({
				ok: false,
				error: 'Album has no assets to push',
				code: 502
			});
			expect(immichClient.getAssetOriginal.called).toBe(false);
			expect(bloomin8Client.getDeviceInfo.called).toBe(false);
			expect(bloomin8Client.uploadImage.called).toBe(false);
		});

		it('returns a 502 error when getAlbum rejects', async () => {
			immichClient.getAlbum.rejects(new Error('unreachable'));

			const result = await service.pushAsset(undefined, 'album-1');

			expect(result).toEqual({
				ok: false,
				error: 'Failed to push image to Bloomin8 frame',
				code: 502
			});
		});

		it('returns a 502 error when getAssetOriginal rejects', async () => {
			immichClient.getAlbum.resolves(makeAlbum());
			immichClient.getAssetOriginal.rejects(new Error('unreachable'));

			const result = await service.pushAsset(undefined, 'album-1');

			expect(result).toEqual({
				ok: false,
				error: 'Failed to push image to Bloomin8 frame',
				code: 502
			});
		});

		it('returns a 502 error when getDeviceInfo rejects', async () => {
			immichClient.getAlbum.resolves(makeAlbum());
			bloomin8Client.getDeviceInfo.rejects(new Error('unreachable'));

			const result = await service.pushAsset(undefined, 'album-1');

			expect(result).toEqual({
				ok: false,
				error: 'Failed to push image to Bloomin8 frame',
				code: 502
			});
		});

		it('returns a 502 error when uploadImage rejects', async () => {
			immichClient.getAlbum.resolves(makeAlbum());
			bloomin8Client.uploadImage.rejects(new Error('unreachable'));

			const result = await service.pushAsset(undefined, 'album-1');

			expect(result).toEqual({
				ok: false,
				error: 'Failed to push image to Bloomin8 frame',
				code: 502
			});
		});

		it('always selects the single asset when the album has only one', async () => {
			immichClient.getAlbum.resolves(makeAlbum());

			await service.pushAsset(undefined, 'album-1');

			expect(immichClient.getAssetOriginal.calledWithExactly('asset-1')).toBe(true);
		});

		it('calls getAlbum with the default IMMICH_ALBUM_ID when no argument is passed', async () => {
			immichClient.getAlbum.resolves(makeAlbum());

			await service.pushAsset();

			expect(immichClient.getAlbum.calledWithExactly('default-album-id')).toBe(true);
		});

		it('pushes the explicitly requested asset without involving random selection', async () => {
			immichClient.getAlbum.resolves(
				makeAlbum({
					assets: [
						{
							id: 'asset-1',
							originalFileName: 'photo.jpg',
							fileCreatedAt: '2026-01-01T00:00:00Z',
							type: 'IMAGE'
						},
						{
							id: 'asset-2',
							originalFileName: 'other.jpg',
							fileCreatedAt: '2026-01-02T00:00:00Z',
							type: 'IMAGE'
						}
					]
				})
			);

			const result = await service.pushAsset('asset-2', 'album-1');

			expect(immichClient.getAssetOriginal.calledWithExactly('asset-2')).toBe(true);
			expect(result).toEqual({
				ok: true,
				data: {
					asset: { id: 'asset-2', filename: 'other.jpg' },
					device: { width: 1200, height: 1600 },
					path: '/gallerys/default/asset-1.jpg'
				},
				code: 200
			});
		});

		it('returns a 404 error without contacting other clients when the asset id is not in the album', async () => {
			immichClient.getAlbum.resolves(makeAlbum());

			const result = await service.pushAsset('missing-asset', 'album-1');

			expect(result).toEqual({
				ok: false,
				error: 'Asset not found in album',
				code: 404
			});
			expect(immichClient.getAssetOriginal.called).toBe(false);
			expect(bloomin8Client.getDeviceInfo.called).toBe(false);
			expect(bloomin8Client.uploadImage.called).toBe(false);
		});
	});

	describe('getAssetThumbnail', () => {
		it('returns the thumbnail data and content type on success', async () => {
			const thumbnail = { data: new Uint8Array([1, 2, 3]).buffer, contentType: 'image/webp' };
			immichClient.getAssetThumbnail.resolves(thumbnail);

			const result = await service.getAssetThumbnail('asset-1');

			expect(result).toEqual({ ok: true, data: thumbnail, code: 200 });
		});

		it('returns a 502 error when the client rejects', async () => {
			immichClient.getAssetThumbnail.rejects(new Error('unreachable'));

			const result = await service.getAssetThumbnail('asset-1');

			expect(result).toEqual({
				ok: false,
				error: 'Failed to fetch thumbnail from Immich',
				code: 502
			});
		});
	});

	describe('getDeviceInfo', () => {
		it('returns the device info on success', async () => {
			const deviceInfo = {
				width: 1200,
				height: 1600,
				name: 'Frame',
				version: '1.2.3',
				type: 'bloomin8',
				battery: 87
			};
			bloomin8Client.getDeviceInfo.resolves(deviceInfo);

			const result = await service.getDeviceInfo();

			expect(result).toEqual({ ok: true, data: deviceInfo, code: 200 });
		});

		it('returns a 502 error when the client rejects', async () => {
			bloomin8Client.getDeviceInfo.rejects(new Error('unreachable'));

			const result = await service.getDeviceInfo();

			expect(result).toEqual({
				ok: false,
				error: 'Failed to fetch device info from Bloomin8 frame',
				code: 502
			});
		});
	});
});
