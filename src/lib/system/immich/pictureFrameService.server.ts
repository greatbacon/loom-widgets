import { env } from '$env/dynamic/private';
import sharp, { type Metadata } from 'sharp';
import postgres from 'postgres';
import { defaultPostgresOptions } from '$lib/db/postgres.server';
import { ImmichClient } from '$lib/system/immich/immichClient.server';
import { Bloomin8Client } from '$lib/system/bloomin8/bloomin8Client.server';
import type {
	Bloomin8DeviceInfo,
	Bloomin8PullSettings,
	Bloomin8PullSettingsInput
} from '$lib/system/bloomin8/bloomin8Client.server';
import { ProcessedImagesRepo } from '$lib/system/immich/processedImagesRepo';
import { ProcessedImageStorage } from '$lib/system/immich/processedImageStorage.server';
import type {
	CropRect,
	PictureFrameAlbum,
	PictureFrameAsset,
	PictureFramePushResult,
	PictureFrameProcessResult,
	PictureFrameBatchResult,
	ProcessedImageRow
} from '$lib/system/immich/pictureFrame';

export interface Result<T> {
	ok: true;
	data: T;
	code: number;
}

export interface Error {
	ok: false;
	error: string;
	code: number;
}

const log = console;

export function computeDefaultCrop(
	naturalWidth: number,
	naturalHeight: number,
	device: { width: number; height: number }
): CropRect {
	const aspectRatio = device.width / device.height;
	let width = naturalWidth;
	let height = width / aspectRatio;
	if (height > naturalHeight) {
		height = naturalHeight;
		width = height * aspectRatio;
	}
	return {
		x: Math.round((naturalWidth - width) / 2),
		y: Math.round((naturalHeight - height) / 2),
		width: Math.round(width),
		height: Math.round(height)
	};
}

export function shouldCycleOnPull(now: Date = new Date()): boolean {
	console.log('should we cycle?', now.getHours());
	//return now.getHours() === 1;
	return true;
}

export function computeNextCronTime(now: Date = new Date()): string {
	console.log('next pull time')
	//const next = new Date(now.getTime() + (60 * 60 * 1000));
	const next = new Date(now.getTime() + (10 * 60 * 1000));
	return next.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export class PictureFrameService {
	constructor(
		private readonly immichClient: ImmichClient = new ImmichClient(),
		private readonly bloomin8Client: Bloomin8Client = new Bloomin8Client(),
		private readonly processedImagesRepo: ProcessedImagesRepo = new ProcessedImagesRepo(
			postgres(defaultPostgresOptions)
		),
		private readonly imageStorage: ProcessedImageStorage = new ProcessedImageStorage()
	) {}

	async getAlbumContents(
		albumId: string = env.IMMICH_ALBUM_ID!
	): Promise<Result<PictureFrameAlbum> | Error> {
		try {
			const album = await this.immichClient.getAlbum(albumId);
			const [processedAssetIds, activeAssetId] = await Promise.all([
				this.processedImagesRepo.listAssetIds().then((ids) => new Set(ids)),
				this.processedImagesRepo.findActiveAssetId()
			]);

			const assets: PictureFrameAsset[] = album.assets
				.map((asset) => ({
					id: asset.id,
					filename: asset.originalFileName,
					takenAt: asset.fileCreatedAt,
					type: asset.type,
					thumbnailUrl: `/picture-frame/thumbnail/${asset.id}`,
					originalUrl: `/picture-frame/original/${asset.id}`,
					processed: processedAssetIds.has(asset.id),
					active: asset.id === activeAssetId
				}))
				.sort((a, b) => a.id.localeCompare(b.id));

			return {
				ok: true,
				data: { albumId: album.id, albumName: album.albumName, assets },
				code: 200
			};
		} catch (error) {
			log.error('Error fetching Immich album:', error);
			return { ok: false, error: 'Failed to fetch album from Immich', code: 502 };
		}
	}

	async processUnprocessedAssets(
		albumId: string = env.IMMICH_ALBUM_ID!
	): Promise<Result<PictureFrameBatchResult> | Error> {
		try {
			const album = await this.immichClient.getAlbum(albumId);
			const processedAssetIds = new Set(await this.processedImagesRepo.listAssetIds());
			const unprocessedAssets = album.assets.filter((asset) => !processedAssetIds.has(asset.id));

			if (unprocessedAssets.length === 0) {
				return { ok: true, data: { processedCount: 0, failedCount: 0 }, code: 200 };
			}

			let device: Bloomin8DeviceInfo;
			try {
				device = await this.bloomin8Client.getDeviceInfo();
			} catch (error) {
				log.error('Best-effort auto-processing skipped: failed to fetch device info:', error);
				return { ok: true, data: { processedCount: 0, failedCount: 0 }, code: 200 };
			}

			let processedCount = 0;
			let failedCount = 0;
			for (const asset of unprocessedAssets) {
				try {
					await this.autoProcessAsset(asset, device);
					processedCount++;
				} catch (error) {
					log.error(`Best-effort auto-processing failed for asset ${asset.id}:`, error);
					failedCount++;
				}
			}

			return { ok: true, data: { processedCount, failedCount }, code: 200 };
		} catch (error) {
			log.error('Error auto-processing album assets:', error);
			return { ok: false, error: 'Failed to auto-process album assets', code: 502 };
		}
	}

	async getAssetThumbnail(
		assetId: string
	): Promise<Result<{ data: ArrayBuffer; contentType: string }> | Error> {
		try {
			const thumbnail = await this.immichClient.getAssetThumbnail(assetId);
			return { ok: true, data: thumbnail, code: 200 };
		} catch (error) {
			log.error('Error fetching Immich thumbnail:', error);
			return { ok: false, error: 'Failed to fetch thumbnail from Immich', code: 502 };
		}
	}

	async getAssetOriginal(
		assetId: string
	): Promise<Result<{ data: ArrayBuffer; contentType: string }> | Error> {
		try {
			const original = await this.immichClient.getAssetOriginal(assetId);
			return { ok: true, data: original, code: 200 };
		} catch (error) {
			log.error('Error fetching Immich original:', error);
			return { ok: false, error: 'Failed to fetch original from Immich', code: 502 };
		}
	}

	private async fetchOriginalWithNaturalDimensions(
		assetId: string
	): Promise<{ originalBuffer: Buffer; naturalWidth: number; naturalHeight: number }> {
		const original = await this.immichClient.getAssetOriginal(assetId);
		let originalBuffer = Buffer.from(original.data);
		let metadata: Metadata;
		try {
			metadata = await sharp(originalBuffer).metadata();
		} catch {
			// sharp/libvips can't decode this original directly - camera RAW formats
			// (e.g. .arw, .cr2, .nef) aren't supported input formats. Immich already
			// decodes RAW originals into a JPEG preview for its own gallery, so fall
			// back to that instead of failing the whole asset.
			const preview = await this.immichClient.getAssetPreview(assetId);
			originalBuffer = Buffer.from(preview.data);
			metadata = await sharp(originalBuffer).metadata();
		}
		// EXIF orientations 5-8 mean the stored raster is rotated 90/270 degrees
		// relative to how it's displayed (and how the browser reports naturalWidth/
		// naturalHeight, which is what crop rects are expressed in).
		const isSideways = (metadata.orientation ?? 1) >= 5;
		const naturalWidth = (isSideways ? metadata.height : metadata.width) ?? 0;
		const naturalHeight = (isSideways ? metadata.width : metadata.height) ?? 0;
		return { originalBuffer, naturalWidth, naturalHeight };
	}

	private async cropResizeAndPersist(
		asset: { id: string; originalFileName: string },
		crop: CropRect,
		device: { width: number; height: number },
		originalBuffer: Buffer
	): Promise<PictureFrameProcessResult> {
		const jpeg = await sharp(originalBuffer)
			.rotate()
			.extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height })
			.resize(device.width, device.height)
			.jpeg()
			.toBuffer();

		const filePath = await this.imageStorage.write(asset.id, jpeg);

		await this.processedImagesRepo.upsert(
			asset.id,
			asset.originalFileName,
			crop.x,
			crop.y,
			crop.width,
			crop.height,
			device.width,
			device.height,
			filePath
		);

		return {
			asset: { id: asset.id, filename: asset.originalFileName },
			crop,
			device: { width: device.width, height: device.height }
		};
	}

	private async autoProcessAsset(
		asset: { id: string; originalFileName: string },
		device: { width: number; height: number }
	): Promise<void> {
		const { originalBuffer, naturalWidth, naturalHeight } =
			await this.fetchOriginalWithNaturalDimensions(asset.id);
		const crop = computeDefaultCrop(naturalWidth, naturalHeight, device);
		await this.cropResizeAndPersist(asset, crop, device, originalBuffer);
	}

	async processAsset(
		assetId: string,
		crop: CropRect,
		albumId: string = env.IMMICH_ALBUM_ID!
	): Promise<Result<PictureFrameProcessResult> | Error> {
		try {
			const album = await this.immichClient.getAlbum(albumId);
			const asset = album.assets.find((a) => a.id === assetId);
			if (!asset) {
				return { ok: false, error: 'Asset not found in album', code: 404 };
			}

			if (crop.width <= 0 || crop.height <= 0) {
				return { ok: false, error: 'Invalid crop dimensions', code: 400 };
			}

			const { originalBuffer, naturalWidth, naturalHeight } =
				await this.fetchOriginalWithNaturalDimensions(asset.id);

			if (
				crop.x < 0 ||
				crop.y < 0 ||
				crop.x + crop.width > naturalWidth ||
				crop.y + crop.height > naturalHeight
			) {
				return { ok: false, error: 'Crop rectangle is outside the image bounds', code: 400 };
			}

			const device = await this.bloomin8Client.getDeviceInfo();
			const data = await this.cropResizeAndPersist(asset, crop, device, originalBuffer);

			return { ok: true, data, code: 200 };
		} catch (error) {
			log.error('Error processing image for picture frame:', error);
			return { ok: false, error: 'Failed to process image', code: 502 };
		}
	}

	async pushAsset(assetId?: string): Promise<Result<PictureFramePushResult> | Error> {
		try {
			let record;
			if (assetId) {
				record = await this.processedImagesRepo.findByAssetId(assetId);
				if (!record) {
					return { ok: false, error: 'Asset has not been processed yet', code: 409 };
				}
			} else {
				const candidates = await this.processedImagesRepo.listAll();
				if (candidates.length === 0) {
					return { ok: false, error: 'No processed assets available to push', code: 409 };
				}
				record = candidates[Math.floor(Math.random() * candidates.length)];
			}

			const data = await this.pushRecord(record);
			return { ok: true, data, code: 200 };
		} catch (error) {
			log.error('Error pushing image to Bloomin8 frame:', error);
			return { ok: false, error: 'Failed to push image to Bloomin8 frame', code: 502 };
		}
	}

	async cycleActiveAsset(): Promise<Result<PictureFramePushResult> | Error> {
		try {
			const candidates = await this.processedImagesRepo.listAll();
			if (candidates.length === 0) {
				return { ok: false, error: 'No processed assets available to cycle', code: 409 };
			}

			const activeAssetId = await this.processedImagesRepo.findActiveAssetId();
			const activeIndex = activeAssetId
				? candidates.findIndex((candidate) => candidate.asset_id === activeAssetId)
				: -1;
			const nextIndex = activeIndex === -1 ? 0 : (activeIndex + 1) % candidates.length;

			const data = await this.pushRecord(candidates[nextIndex]);
			return { ok: true, data, code: 200 };
		} catch (error) {
			log.error('Error cycling active picture on Bloomin8 frame:', error);
			return { ok: false, error: 'Failed to cycle active picture', code: 502 };
		}
	}

	private async pushRecord(record: ProcessedImageRow): Promise<PictureFramePushResult> {
		const jpeg = await this.imageStorage.read(record.file_path);
		// The Bloomin8 frame appears to cache display state per filename, so a
		// re-processed image pushed under its old filename can render stale. Stamp
		// the filename with the processed record's version so each re-crop is seen
		// as a new file.
		const version = (record.updated_at ?? record.created_at).getTime();
		const upload = await this.bloomin8Client.uploadImage(
			jpeg,
			`${record.asset_id}-${version}.jpg`,
			{ showNow: true }
		);

		try {
			await this.processedImagesRepo.setActive(record.asset_id);
		} catch (error) {
			log.error(
				`Failed to persist active state for asset ${record.asset_id} after a successful push:`,
				error
			);
		}

		return {
			asset: { id: record.asset_id, filename: record.filename },
			device: { width: record.device_width, height: record.device_height },
			path: upload.path
		};
	}

	async handleEinkPull(now: Date = new Date()): Promise<{ nextCronTime: string }> {
		console.debug('handling pull request cycle')
		if (shouldCycleOnPull(now)) {
			console.debug('determined it is time to cycle')
			const result = await this.cycleActiveAsset();
			if (!result.ok) {
				log.error('Eink pull cycle failed:', result.error);
			}
		}
		const nextCronTime = computeNextCronTime(now);
		console.log('returning ruquest with new pull time: ', nextCronTime)
		return { nextCronTime };
	}

	async getDeviceInfo(): Promise<Result<Bloomin8DeviceInfo> | Error> {
		try {
			const device = await this.bloomin8Client.getDeviceInfo();
			return { ok: true, data: device, code: 200 };
		} catch (error) {
			log.error('Error fetching Bloomin8 device info:', error);
			return { ok: false, error: 'Failed to fetch device info from Bloomin8 frame', code: 502 };
		}
	}

	async getUpstreamPullSettings(): Promise<Result<Bloomin8PullSettings> | Error> {
		try {
			const settings = await this.bloomin8Client.getUpstreamPullSettings();
			return { ok: true, data: settings, code: 200 };
		} catch (error) {
			log.error('Error fetching Bloomin8 upstream pull settings:', error);
			return {
				ok: false,
				error: 'Failed to fetch upstream pull settings from Bloomin8 frame',
				code: 502
			};
		}
	}

	async setUpstreamPullSettings(
		settings: Bloomin8PullSettingsInput
	): Promise<Result<null> | Error> {
		try {
			await this.bloomin8Client.setUpstreamPullSettings(settings);
			return { ok: true, data: null, code: 200 };
		} catch (error) {
			log.error('Error updating Bloomin8 upstream pull settings:', error);
			return {
				ok: false,
				error: 'Failed to update upstream pull settings on Bloomin8 frame',
				code: 502
			};
		}
	}
}
