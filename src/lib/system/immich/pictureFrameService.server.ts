import { env } from '$env/dynamic/private';
import sharp from 'sharp';
import postgres from 'postgres';
import { defaultPostgresOptions } from '$lib/db/postgres.server';
import { ImmichClient } from '$lib/system/immich/immichClient.server';
import { Bloomin8Client } from '$lib/system/bloomin8/bloomin8Client.server';
import type { Bloomin8DeviceInfo } from '$lib/system/bloomin8/bloomin8Client.server';
import { ProcessedImagesRepo } from '$lib/system/immich/processedImagesRepo';
import { ProcessedImageStorage } from '$lib/system/immich/processedImageStorage.server';
import type {
	CropRect,
	PictureFrameAlbum,
	PictureFrameAsset,
	PictureFramePushResult,
	PictureFrameProcessResult
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

export function extractActiveAssetId(imagePath: string): string | null {
	const basename = imagePath.split('/').pop()?.split('?')[0] ?? '';
	const match = basename.match(/^(.+)-(\d+)\.jpg$/);
	return match ? match[1] : null;
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
			const processedAssetIds = new Set(await this.processedImagesRepo.listAssetIds());

			const assets: PictureFrameAsset[] = album.assets.map((asset) => ({
				id: asset.id,
				filename: asset.originalFileName,
				takenAt: asset.fileCreatedAt,
				type: asset.type,
				thumbnailUrl: `/picture-frame/thumbnail/${asset.id}`,
				originalUrl: `/picture-frame/original/${asset.id}`,
				processed: processedAssetIds.has(asset.id)
			}));

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

			const original = await this.immichClient.getAssetOriginal(asset.id);
			const originalBuffer = Buffer.from(original.data);
			const metadata = await sharp(originalBuffer).metadata();
			// EXIF orientations 5-8 mean the stored raster is rotated 90/270 degrees
			// relative to how it's displayed (and how the browser reports naturalWidth/
			// naturalHeight, which is what the crop rect below is expressed in).
			const isSideways = (metadata.orientation ?? 1) >= 5;
			const naturalWidth = (isSideways ? metadata.height : metadata.width) ?? 0;
			const naturalHeight = (isSideways ? metadata.width : metadata.height) ?? 0;

			if (
				crop.x < 0 ||
				crop.y < 0 ||
				crop.x + crop.width > naturalWidth ||
				crop.y + crop.height > naturalHeight
			) {
				return { ok: false, error: 'Crop rectangle is outside the image bounds', code: 400 };
			}

			const device = await this.bloomin8Client.getDeviceInfo();

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
				ok: true,
				data: {
					asset: { id: asset.id, filename: asset.originalFileName },
					crop,
					device: { width: device.width, height: device.height }
				},
				code: 200
			};
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

			return {
				ok: true,
				data: {
					asset: { id: record.asset_id, filename: record.filename },
					device: { width: record.device_width, height: record.device_height },
					path: upload.path
				},
				code: 200
			};
		} catch (error) {
			log.error('Error pushing image to Bloomin8 frame:', error);
			return { ok: false, error: 'Failed to push image to Bloomin8 frame', code: 502 };
		}
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
}
