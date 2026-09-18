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

const { PictureFrameService, extractActiveAssetId, computeDefaultCrop } = await import(
	'./pictureFrameService.server'
);

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

describe('extractActiveAssetId', () => {
	it('returns null for an empty string', () => {
		expect(extractActiveAssetId('')).toBeNull();
	});

	it('extracts the asset id from a full gallery path', () => {
		expect(extractActiveAssetId('/gallerys/default/asset-1-1700000000000.jpg')).toBe('asset-1');
	});

	it('correctly splits a UUID-style asset id containing hyphens', () => {
		expect(
			extractActiveAssetId(
				'/gallerys/default/3fa85f64-5717-4562-b3fc-2c963f66afa6-1700000000000.jpg'
			)
		).toBe('3fa85f64-5717-4562-b3fc-2c963f66afa6');
	});

	it('returns null for a filename that does not match the convention', () => {
		expect(extractActiveAssetId('/gallerys/default/demo.jpg')).toBeNull();
	});
});

describe('PictureFrameService', () => {
	let immichClient: {
		getAlbum: sinon.SinonStub;
		getAssetOriginal: sinon.SinonStub;
		getAssetThumbnail: sinon.SinonStub;
		getAssetPreview: sinon.SinonStub;
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
			getAssetThumbnail: sinon.stub(),
			getAssetPreview: sinon.stub()
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
			processedImagesRepo.listAssetIds.resolves(['asset-1']);

			await service.getAlbumContents();

			expect(immichClient.getAlbum.calledWithExactly('default-album-id')).toBe(true);
		});

		it('calls client.getAlbum with an explicit argument when one is passed', async () => {
			immichClient.getAlbum.resolves(makeAlbum());
			processedImagesRepo.listAssetIds.resolves(['asset-1']);

			await service.getAlbumContents('explicit-album-id');

			expect(immichClient.getAlbum.calledWithExactly('explicit-album-id')).toBe(true);
		});

		it('performs no writes when unprocessed assets exist', async () => {
			immichClient.getAlbum.resolves(makeAlbum());
			processedImagesRepo.listAssetIds.resolves([]);

			const result = await service.getAlbumContents('album-1');

			expect(immichClient.getAssetOriginal.called).toBe(false);
			expect(bloomin8Client.getDeviceInfo.called).toBe(false);
			expect(imageStorage.write.called).toBe(false);
			expect(processedImagesRepo.upsert.called).toBe(false);
			expect(result).toMatchObject({
				ok: true,
				data: { assets: [expect.objectContaining({ id: 'asset-1', processed: false })] }
			});
		});
	});

	describe('processUnprocessedAssets', () => {
		beforeEach(() => {
			bloomin8Client.getDeviceInfo.resolves({ width: 1200, height: 1600 });
			immichClient.getAssetOriginal.resolves({
				data: new Uint8Array([1, 2, 3]).buffer,
				contentType: 'image/jpeg'
			});
			imageStorage.write.resolves('data/processed/asset-1.jpg');
			processedImagesRepo.upsert.resolves(makeProcessedRow());
		});

		it('auto-processes an unprocessed asset with a computed centered crop and returns incremented counts', async () => {
			immichClient.getAlbum.resolves(makeAlbum());
			processedImagesRepo.listAssetIds.resolves([]);
			sharpInstance.metadata.mockResolvedValue({ width: 4000, height: 3000 });

			const result = await service.processUnprocessedAssets('album-1');

			expect(bloomin8Client.getDeviceInfo.called).toBe(true);
			// device aspect ratio 1200/1600 = 0.75; natural 4000x3000 -> width-limited,
			// height = 4000/0.75 = 5333.., exceeds 3000, so height-limited instead:
			// height = 3000, width = 3000*0.75 = 2250, centered.
			expect(sharpInstance.extract).toHaveBeenCalledWith({
				left: 875,
				top: 0,
				width: 2250,
				height: 3000
			});
			expect(imageStorage.write.calledWithExactly('asset-1', Buffer.from('jpeg-bytes'))).toBe(true);
			expect(processedImagesRepo.upsert.called).toBe(true);
			expect(result).toEqual({ ok: true, data: { processedCount: 1, failedCount: 0 }, code: 200 });
		});

		it('does not fetch device info or attempt processing when no assets are unprocessed', async () => {
			immichClient.getAlbum.resolves(makeAlbum());
			processedImagesRepo.listAssetIds.resolves(['asset-1']);

			const result = await service.processUnprocessedAssets('album-1');

			expect(bloomin8Client.getDeviceInfo.called).toBe(false);
			expect(immichClient.getAssetOriginal.called).toBe(false);
			expect(result).toEqual({ ok: true, data: { processedCount: 0, failedCount: 0 }, code: 200 });
		});

		it('continues auto-processing remaining assets when one fails, counting successes and failures', async () => {
			immichClient.getAlbum.resolves(
				makeAlbum({
					assets: [
						{
							id: 'asset-1',
							originalFileName: 'a.jpg',
							fileCreatedAt: '2026-01-01T00:00:00Z',
							type: 'IMAGE'
						},
						{
							id: 'asset-2',
							originalFileName: 'b.jpg',
							fileCreatedAt: '2026-01-01T00:00:00Z',
							type: 'IMAGE'
						}
					]
				})
			);
			processedImagesRepo.listAssetIds.resolves([]);
			immichClient.getAssetOriginal
				.withArgs('asset-1')
				.rejects(new Error('unreachable'))
				.withArgs('asset-2')
				.resolves({ data: new Uint8Array([1, 2, 3]).buffer, contentType: 'image/jpeg' });

			const result = await service.processUnprocessedAssets('album-1');

			expect(result).toEqual({ ok: true, data: { processedCount: 1, failedCount: 1 }, code: 200 });
		});

		it('returns zero counts without attempting any processing when device info fetch fails', async () => {
			immichClient.getAlbum.resolves(makeAlbum());
			processedImagesRepo.listAssetIds.resolves([]);
			bloomin8Client.getDeviceInfo.rejects(new Error('unreachable'));

			const result = await service.processUnprocessedAssets('album-1');

			expect(immichClient.getAssetOriginal.called).toBe(false);
			expect(result).toEqual({ ok: true, data: { processedCount: 0, failedCount: 0 }, code: 200 });
		});

		it('returns a 502 error when getAlbum rejects', async () => {
			immichClient.getAlbum.rejects(new Error('unreachable'));

			const result = await service.processUnprocessedAssets('album-1');

			expect(result).toEqual({
				ok: false,
				error: 'Failed to auto-process album assets',
				code: 502
			});
		});
	});

	describe('computeDefaultCrop', () => {
		it('crops to the full image height, centering horizontally, when the image is proportionally wider than the device', () => {
			// device aspect ratio 0.75; image 4000x3000 (aspect ~1.33) is proportionally wider,
			// so a full-width crop (height = 4000/0.75 = 5333.33) would overflow the natural
			// height (3000) -> falls back to full height instead: height = 3000, width = 2250.
			const crop = computeDefaultCrop(4000, 3000, { width: 1200, height: 1600 });

			expect(crop).toEqual({ x: 875, y: 0, width: 2250, height: 3000 });
		});

		it('crops to the full image width, centering vertically, when the image is proportionally narrower than the device', () => {
			// device aspect ratio 0.75; image 2000x4000 (aspect 0.5) is proportionally narrower,
			// so a full-width crop (height = 2000/0.75 = 2666.67) fits within the natural
			// height (4000) -> uses the full width: width = 2000, height = 2667 (rounded).
			const crop = computeDefaultCrop(2000, 4000, { width: 1200, height: 1600 });

			expect(crop).toEqual({ x: 0, y: 667, width: 2000, height: 2667 });
		});

		it('returns the full image as the crop when its aspect ratio exactly matches the device', () => {
			const crop = computeDefaultCrop(1200, 1600, { width: 1200, height: 1600 });

			expect(crop).toEqual({ x: 0, y: 0, width: 1200, height: 1600 });
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

		it('falls back to the Immich preview when sharp cannot decode the original (e.g. a RAW format)', async () => {
			immichClient.getAlbum.resolves(makeAlbum());
			immichClient.getAssetPreview.resolves({
				data: new Uint8Array([4, 5, 6]).buffer,
				contentType: 'image/jpeg'
			});
			sharpInstance.metadata
				.mockRejectedValueOnce(new Error('Input buffer contains unsupported image format'))
				.mockResolvedValueOnce({ width: 3000, height: 3000 });

			const result = await service.processAsset('asset-1', crop, 'album-1');

			expect(immichClient.getAssetPreview.calledWithExactly('asset-1')).toBe(true);
			expect(sharpInstance.extract).toHaveBeenCalledWith({
				left: 0,
				top: 0,
				width: 3000,
				height: 3000
			});
			expect(result).toMatchObject({ ok: true });
		});

		it('returns a 502 error when the Immich preview fallback also fails to decode', async () => {
			immichClient.getAlbum.resolves(makeAlbum());
			immichClient.getAssetPreview.resolves({
				data: new Uint8Array([4, 5, 6]).buffer,
				contentType: 'image/jpeg'
			});
			sharpInstance.metadata.mockRejectedValue(new Error('unsupported image format'));

			const result = await service.processAsset('asset-1', crop, 'album-1');

			expect(result).toEqual({ ok: false, error: 'Failed to process image', code: 502 });
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

	describe('cycleActiveAsset', () => {
		beforeEach(() => {
			imageStorage.read.resolves(Buffer.from('jpeg-bytes'));
			bloomin8Client.uploadImage.resolves({ status: 100, path: '/gallerys/default/asset-2.jpg' });
		});

		it('returns a 409 error when there are no processed candidates', async () => {
			processedImagesRepo.listAll.resolves([]);

			const result = await service.cycleActiveAsset();

			expect(result).toEqual({
				ok: false,
				error: 'No processed assets available to cycle',
				code: 409
			});
			expect(bloomin8Client.getDeviceInfo.called).toBe(false);
		});

		it('skips without pushing when getDeviceInfo rejects', async () => {
			processedImagesRepo.listAll.resolves([makeProcessedRow()]);
			bloomin8Client.getDeviceInfo.rejects(new Error('unreachable'));

			const result = await service.cycleActiveAsset();

			expect(result).toEqual({
				ok: true,
				data: { status: 'skipped', reason: 'Failed to fetch device info' },
				code: 200
			});
			expect(bloomin8Client.uploadImage.called).toBe(false);
		});

		it('skips without pushing when the device image does not match the naming convention', async () => {
			processedImagesRepo.listAll.resolves([makeProcessedRow()]);
			bloomin8Client.getDeviceInfo.resolves({ image: '/gallerys/default/demo.jpg' });

			const result = await service.cycleActiveAsset();

			expect(result).toEqual({
				ok: true,
				data: { status: 'skipped', reason: 'No resolvable active asset' },
				code: 200
			});
			expect(bloomin8Client.uploadImage.called).toBe(false);
		});

		it('skips without pushing when the resolved active asset is not among the processed candidates', async () => {
			processedImagesRepo.listAll.resolves([makeProcessedRow({ asset_id: 'asset-1' })]);
			bloomin8Client.getDeviceInfo.resolves({
				image: '/gallerys/default/asset-9-1700000000000.jpg'
			});

			const result = await service.cycleActiveAsset();

			expect(result).toEqual({
				ok: true,
				data: { status: 'skipped', reason: 'No resolvable active asset' },
				code: 200
			});
			expect(bloomin8Client.uploadImage.called).toBe(false);
		});

		it('pushes the next candidate after the active one in sorted order', async () => {
			const candidates = [
				makeProcessedRow({ asset_id: 'asset-1', file_path: 'data/processed/asset-1.jpg' }),
				makeProcessedRow({ asset_id: 'asset-2', file_path: 'data/processed/asset-2.jpg' }),
				makeProcessedRow({ asset_id: 'asset-3', file_path: 'data/processed/asset-3.jpg' })
			];
			processedImagesRepo.listAll.resolves(candidates);
			bloomin8Client.getDeviceInfo.resolves({
				image: '/gallerys/default/asset-1-1700000000000.jpg'
			});

			const result = await service.cycleActiveAsset();

			expect(imageStorage.read.calledWithExactly('data/processed/asset-2.jpg')).toBe(true);
			expect(
				bloomin8Client.uploadImage.calledWithExactly(
					Buffer.from('jpeg-bytes'),
					`asset-2-${candidates[1].created_at.getTime()}.jpg`,
					{ showNow: true }
				)
			).toBe(true);
			expect(result).toEqual({
				ok: true,
				data: {
					status: 'pushed',
					push: {
						asset: { id: 'asset-2', filename: 'photo.jpg' },
						device: { width: 1200, height: 1600 },
						path: '/gallerys/default/asset-2.jpg'
					}
				},
				code: 200
			});
		});

		it('wraps around to the first candidate when the active one is last in sorted order', async () => {
			const candidates = [
				makeProcessedRow({ asset_id: 'asset-1', file_path: 'data/processed/asset-1.jpg' }),
				makeProcessedRow({ asset_id: 'asset-2', file_path: 'data/processed/asset-2.jpg' }),
				makeProcessedRow({ asset_id: 'asset-3', file_path: 'data/processed/asset-3.jpg' })
			];
			processedImagesRepo.listAll.resolves(candidates);
			bloomin8Client.getDeviceInfo.resolves({
				image: '/gallerys/default/asset-3-1700000000000.jpg'
			});

			const result = await service.cycleActiveAsset();

			expect(imageStorage.read.calledWithExactly('data/processed/asset-1.jpg')).toBe(true);
			expect(result).toMatchObject({
				ok: true,
				data: { status: 'pushed', push: { asset: { id: 'asset-1' } } }
			});
		});

		it('returns a 502 error when imageStorage.read rejects during the push', async () => {
			processedImagesRepo.listAll.resolves([makeProcessedRow()]);
			bloomin8Client.getDeviceInfo.resolves({
				image: '/gallerys/default/asset-1-1700000000000.jpg'
			});
			imageStorage.read.rejects(new Error('disk error'));

			const result = await service.cycleActiveAsset();

			expect(result).toEqual({
				ok: false,
				error: 'Failed to cycle active picture',
				code: 502
			});
		});

		it('returns a 502 error when uploadImage rejects during the push', async () => {
			processedImagesRepo.listAll.resolves([makeProcessedRow()]);
			bloomin8Client.getDeviceInfo.resolves({
				image: '/gallerys/default/asset-1-1700000000000.jpg'
			});
			bloomin8Client.uploadImage.rejects(new Error('unreachable'));

			const result = await service.cycleActiveAsset();

			expect(result).toEqual({
				ok: false,
				error: 'Failed to cycle active picture',
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
				battery: 87,
				image: '/gallerys/default/asset-1-1700000000000.jpg'
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
