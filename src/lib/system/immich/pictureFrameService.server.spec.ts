import { describe, it, expect, vi, beforeEach } from 'vitest';
import sinon from 'sinon';
import type { ImmichClient, ImmichAlbum } from './immichClient.server';
import type { Bloomin8Client } from '$lib/system/bloomin8/bloomin8Client.server';
import type { ProcessedImagesRepo } from './processedImagesRepo';
import type { ProcessedImageStorage } from './processedImageStorage.server';
import type { ProcessedImageRow } from './pictureFrame';

const mockEnv = vi.hoisted(() => ({
	IMMICH_URL: 'http://immich.test',
	IMMICH_ALBUM_ID: 'default-album-id'
}));

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const sharpInstance = vi.hoisted(() => ({
	metadata: vi.fn(),
	rotate: vi.fn(),
	extract: vi.fn(),
	resize: vi.fn(),
	jpeg: vi.fn(),
	toBuffer: vi.fn()
}));

vi.mock('sharp', () => ({ default: vi.fn(() => sharpInstance) }));

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

const makeProcessedRow = (overrides: Partial<ProcessedImageRow> = {}): ProcessedImageRow => ({
	asset_id: 'asset-1',
	filename: 'photo.jpg',
	crop_x: 0,
	crop_y: 0,
	crop_width: 3000,
	crop_height: 3000,
	device_width: 1200,
	device_height: 1600,
	file_path: 'data/processed/asset-1.jpg',
	created_at: new Date('2026-01-01T00:00:00Z'),
	updated_at: null,
	...overrides
});

describe('PictureFrameService', () => {
	let immichClient: {
		getAlbum: sinon.SinonStub;
		getAssetOriginal: sinon.SinonStub;
		getAssetThumbnail: sinon.SinonStub;
	};
	let bloomin8Client: { getDeviceInfo: sinon.SinonStub; uploadImage: sinon.SinonStub };
	let processedImagesRepo: {
		findByAssetId: sinon.SinonStub;
		listAll: sinon.SinonStub;
		listAssetIds: sinon.SinonStub;
		upsert: sinon.SinonStub;
	};
	let imageStorage: { write: sinon.SinonStub; read: sinon.SinonStub };
	let service: InstanceType<typeof PictureFrameService>;

	beforeEach(() => {
		mockEnv.IMMICH_URL = 'http://immich.test';
		mockEnv.IMMICH_ALBUM_ID = 'default-album-id';
		sharpInstance.metadata.mockReset().mockResolvedValue({ width: 4000, height: 3000 });
		sharpInstance.rotate.mockReset().mockReturnValue(sharpInstance);
		sharpInstance.extract.mockReset().mockReturnValue(sharpInstance);
		sharpInstance.resize.mockReset().mockReturnValue(sharpInstance);
		sharpInstance.jpeg.mockReset().mockReturnValue(sharpInstance);
		sharpInstance.toBuffer.mockReset().mockResolvedValue(Buffer.from('jpeg-bytes'));
		immichClient = {
			getAlbum: sinon.stub(),
			getAssetOriginal: sinon.stub(),
			getAssetThumbnail: sinon.stub()
		};
		bloomin8Client = { getDeviceInfo: sinon.stub(), uploadImage: sinon.stub() };
		processedImagesRepo = {
			findByAssetId: sinon.stub(),
			listAll: sinon.stub(),
			listAssetIds: sinon.stub().resolves([]),
			upsert: sinon.stub()
		};
		imageStorage = { write: sinon.stub(), read: sinon.stub() };
		service = new PictureFrameService(
			immichClient as unknown as ImmichClient,
			bloomin8Client as unknown as Bloomin8Client,
			processedImagesRepo as unknown as ProcessedImagesRepo,
			imageStorage as unknown as ProcessedImageStorage
		);
	});

	describe('getAlbumContents', () => {
		it('maps a successful getAlbum response into the expected shape', async () => {
			immichClient.getAlbum.resolves(makeAlbum());
			processedImagesRepo.listAssetIds.resolves([]);

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
							originalUrl: '/picture-frame/original/asset-1',
							processed: false
						}
					]
				},
				code: 200
			});
		});

		it('marks assets as processed when their id is in processedImagesRepo.listAssetIds()', async () => {
			immichClient.getAlbum.resolves(makeAlbum());
			processedImagesRepo.listAssetIds.resolves(['asset-1']);

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
							originalUrl: '/picture-frame/original/asset-1',
							processed: true
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

	describe('processAsset', () => {
		const crop = { x: 0, y: 0, width: 3000, height: 3000 };

		beforeEach(() => {
			immichClient.getAssetOriginal.resolves({
				data: new Uint8Array([1, 2, 3]).buffer,
				contentType: 'image/jpeg'
			});
			bloomin8Client.getDeviceInfo.resolves({ width: 1200, height: 1600 });
			imageStorage.write.resolves('data/processed/asset-1.jpg');
			processedImagesRepo.upsert.resolves(makeProcessedRow());
		});

		it('extracts and resizes the crop region, persists it, and returns the result', async () => {
			immichClient.getAlbum.resolves(makeAlbum());

			const result = await service.processAsset('asset-1', crop, 'album-1');

			expect(immichClient.getAlbum.calledWithExactly('album-1')).toBe(true);
			expect(immichClient.getAssetOriginal.calledWithExactly('asset-1')).toBe(true);
			expect(sharpInstance.rotate).toHaveBeenCalled();
			expect(sharpInstance.extract).toHaveBeenCalledWith({
				left: 0,
				top: 0,
				width: 3000,
				height: 3000
			});
			expect(imageStorage.write.calledWithExactly('asset-1', Buffer.from('jpeg-bytes'))).toBe(true);
			expect(
				processedImagesRepo.upsert.calledWithExactly(
					'asset-1',
					'photo.jpg',
					0,
					0,
					3000,
					3000,
					1200,
					1600,
					'data/processed/asset-1.jpg'
				)
			).toBe(true);
			expect(result).toEqual({
				ok: true,
				data: {
					asset: { id: 'asset-1', filename: 'photo.jpg' },
					crop,
					device: { width: 1200, height: 1600 }
				},
				code: 200
			});
		});

		it('validates the crop against display (rotated) dimensions when EXIF orientation is sideways', async () => {
			// Raw raster is landscape (4000x3000) but EXIF orientation 6 means it displays
			// as portrait (3000x4000) — the crop rect below is expressed in display space,
			// matching what the browser reported as naturalWidth/naturalHeight.
			sharpInstance.metadata.mockResolvedValue({ width: 4000, height: 3000, orientation: 6 });
			immichClient.getAlbum.resolves(makeAlbum());

			const portraitCrop = { x: 0, y: 500, width: 3000, height: 3000 };
			const result = await service.processAsset('asset-1', portraitCrop, 'album-1');

			expect(sharpInstance.rotate).toHaveBeenCalled();
			expect(sharpInstance.extract).toHaveBeenCalledWith({
				left: 0,
				top: 500,
				width: 3000,
				height: 3000
			});
			expect(result).toMatchObject({ ok: true });
		});

		it('returns a 400 error when a display-space crop exceeds the rotated bounds', async () => {
			sharpInstance.metadata.mockResolvedValue({ width: 4000, height: 3000, orientation: 6 });
			immichClient.getAlbum.resolves(makeAlbum());

			// Exceeds the display height (4000) but would be in-bounds against the raw,
			// un-rotated height (3000) if orientation weren't accounted for.
			const result = await service.processAsset('asset-1', {
				x: 0,
				y: 3600,
				width: 3000,
				height: 500
			});

			expect(result).toEqual({
				ok: false,
				error: 'Crop rectangle is outside the image bounds',
				code: 400
			});
		});

		it('returns a 404 error without contacting other clients when the asset is not in the album', async () => {
			immichClient.getAlbum.resolves(makeAlbum());

			const result = await service.processAsset('missing-asset', crop, 'album-1');

			expect(result).toEqual({
				ok: false,
				error: 'Asset not found in album',
				code: 404
			});
			expect(immichClient.getAssetOriginal.called).toBe(false);
			expect(bloomin8Client.getDeviceInfo.called).toBe(false);
			expect(imageStorage.write.called).toBe(false);
			expect(processedImagesRepo.upsert.called).toBe(false);
		});

		it('returns a 400 error for non-positive crop dimensions', async () => {
			immichClient.getAlbum.resolves(makeAlbum());

			const result = await service.processAsset('asset-1', { x: 0, y: 0, width: 0, height: 100 });

			expect(result).toEqual({
				ok: false,
				error: 'Invalid crop dimensions',
				code: 400
			});
			expect(immichClient.getAssetOriginal.called).toBe(false);
		});

		it('returns a 400 error when the crop rectangle exceeds the natural image bounds', async () => {
			immichClient.getAlbum.resolves(makeAlbum());

			const result = await service.processAsset('asset-1', {
				x: 3900,
				y: 0,
				width: 200,
				height: 200
			});

			expect(result).toEqual({
				ok: false,
				error: 'Crop rectangle is outside the image bounds',
				code: 400
			});
			expect(bloomin8Client.getDeviceInfo.called).toBe(false);
		});

		it('returns a 502 error when getAlbum rejects', async () => {
			immichClient.getAlbum.rejects(new Error('unreachable'));

			const result = await service.processAsset('asset-1', crop);

			expect(result).toEqual({ ok: false, error: 'Failed to process image', code: 502 });
		});

		it('returns a 502 error when getAssetOriginal rejects', async () => {
			immichClient.getAlbum.resolves(makeAlbum());
			immichClient.getAssetOriginal.rejects(new Error('unreachable'));

			const result = await service.processAsset('asset-1', crop);

			expect(result).toEqual({ ok: false, error: 'Failed to process image', code: 502 });
		});

		it('returns a 502 error when getDeviceInfo rejects', async () => {
			immichClient.getAlbum.resolves(makeAlbum());
			bloomin8Client.getDeviceInfo.rejects(new Error('unreachable'));

			const result = await service.processAsset('asset-1', crop);

			expect(result).toEqual({ ok: false, error: 'Failed to process image', code: 502 });
		});

		it('returns a 502 error when imageStorage.write rejects', async () => {
			immichClient.getAlbum.resolves(makeAlbum());
			imageStorage.write.rejects(new Error('disk full'));

			const result = await service.processAsset('asset-1', crop);

			expect(result).toEqual({ ok: false, error: 'Failed to process image', code: 502 });
		});

		it('returns a 502 error when processedImagesRepo.upsert rejects', async () => {
			immichClient.getAlbum.resolves(makeAlbum());
			processedImagesRepo.upsert.rejects(new Error('db down'));

			const result = await service.processAsset('asset-1', crop);

			expect(result).toEqual({ ok: false, error: 'Failed to process image', code: 502 });
		});
	});

	describe('pushAsset', () => {
		beforeEach(() => {
			imageStorage.read.resolves(Buffer.from('jpeg-bytes'));
			bloomin8Client.uploadImage.resolves({ status: 100, path: '/gallerys/default/asset-1.jpg' });
		});

		it('pushes the previously processed asset for an explicit assetId, versioning the filename by processed time', async () => {
			const row = makeProcessedRow();
			processedImagesRepo.findByAssetId.resolves(row);

			const result = await service.pushAsset('asset-1');

			expect(processedImagesRepo.findByAssetId.calledWithExactly('asset-1')).toBe(true);
			expect(imageStorage.read.calledWithExactly('data/processed/asset-1.jpg')).toBe(true);
			expect(
				bloomin8Client.uploadImage.calledWithExactly(
					Buffer.from('jpeg-bytes'),
					`asset-1-${row.created_at.getTime()}.jpg`,
					{ showNow: true }
				)
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

		it('versions the filename by updated_at, not created_at, once the asset has been re-processed', async () => {
			const row = makeProcessedRow({ updated_at: new Date('2026-02-01T00:00:00Z') });
			processedImagesRepo.findByAssetId.resolves(row);

			await service.pushAsset('asset-1');

			expect(
				bloomin8Client.uploadImage.calledWithExactly(
					Buffer.from('jpeg-bytes'),
					`asset-1-${row.updated_at!.getTime()}.jpg`,
					{ showNow: true }
				)
			).toBe(true);
		});

		it('returns a 409 error when the explicit assetId has no processed record', async () => {
			processedImagesRepo.findByAssetId.resolves(undefined);

			const result = await service.pushAsset('asset-1');

			expect(result).toEqual({
				ok: false,
				error: 'Asset has not been processed yet',
				code: 409
			});
			expect(imageStorage.read.called).toBe(false);
			expect(bloomin8Client.uploadImage.called).toBe(false);
		});

		it('returns a 409 error when no assetId is given and nothing has been processed', async () => {
			processedImagesRepo.listAll.resolves([]);

			const result = await service.pushAsset();

			expect(result).toEqual({
				ok: false,
				error: 'No processed assets available to push',
				code: 409
			});
			expect(imageStorage.read.called).toBe(false);
			expect(bloomin8Client.uploadImage.called).toBe(false);
		});

		it('selects and pushes a random processed record when no assetId is given', async () => {
			const row = makeProcessedRow();
			processedImagesRepo.listAll.resolves([row]);

			const result = await service.pushAsset();

			expect(imageStorage.read.calledWithExactly(row.file_path)).toBe(true);
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

		it('returns a 502 error when imageStorage.read rejects', async () => {
			processedImagesRepo.findByAssetId.resolves(makeProcessedRow());
			imageStorage.read.rejects(new Error('disk error'));

			const result = await service.pushAsset('asset-1');

			expect(result).toEqual({
				ok: false,
				error: 'Failed to push image to Bloomin8 frame',
				code: 502
			});
		});

		it('returns a 502 error when uploadImage rejects', async () => {
			processedImagesRepo.findByAssetId.resolves(makeProcessedRow());
			bloomin8Client.uploadImage.rejects(new Error('unreachable'));

			const result = await service.pushAsset('asset-1');

			expect(result).toEqual({
				ok: false,
				error: 'Failed to push image to Bloomin8 frame',
				code: 502
			});
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

	describe('getAssetOriginal', () => {
		it('returns the original data and content type on success', async () => {
			const original = { data: new Uint8Array([1, 2, 3]).buffer, contentType: 'image/jpeg' };
			immichClient.getAssetOriginal.resolves(original);

			const result = await service.getAssetOriginal('asset-1');

			expect(result).toEqual({ ok: true, data: original, code: 200 });
		});

		it('returns a 502 error when the client rejects', async () => {
			immichClient.getAssetOriginal.rejects(new Error('unreachable'));

			const result = await service.getAssetOriginal('asset-1');

			expect(result).toEqual({
				ok: false,
				error: 'Failed to fetch original from Immich',
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
