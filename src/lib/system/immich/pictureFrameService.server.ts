import { env } from '$env/dynamic/private';
import sharp from 'sharp';
import { ImmichClient } from '$lib/system/immich/immichClient.server';
import { Bloomin8Client } from '$lib/system/bloomin8/bloomin8Client.server';
import type {
	PictureFrameAlbum,
	PictureFrameAsset,
	PictureFramePushResult
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

export class PictureFrameService {
	constructor(
		private readonly immichClient: ImmichClient = new ImmichClient(),
		private readonly bloomin8Client: Bloomin8Client = new Bloomin8Client()
	) {}

	async getAlbumContents(
		albumId: string = env.IMMICH_ALBUM_ID!
	): Promise<Result<PictureFrameAlbum> | Error> {
		try {
			const album = await this.immichClient.getAlbum(albumId);
			const baseUrl = env.IMMICH_URL!;

			const assets: PictureFrameAsset[] = album.assets.map((asset) => ({
				id: asset.id,
				filename: asset.originalFileName,
				takenAt: asset.fileCreatedAt,
				type: asset.type,
				thumbnailUrl: `${baseUrl}/api/assets/${asset.id}/thumbnail`,
				originalUrl: `${baseUrl}/api/assets/${asset.id}/original`
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

	async pushRandomAsset(
		albumId: string = env.IMMICH_ALBUM_ID!
	): Promise<Result<PictureFramePushResult> | Error> {
		try {
			const album = await this.immichClient.getAlbum(albumId);

			if (album.assets.length === 0) {
				return { ok: false, error: 'Album has no assets to push', code: 502 };
			}

			const asset = album.assets[Math.floor(Math.random() * album.assets.length)];
			const original = await this.immichClient.getAssetOriginal(asset.id);
			const device = await this.bloomin8Client.getDeviceInfo();

			const jpeg = await sharp(Buffer.from(original))
				.resize(device.width, device.height, { fit: 'cover' })
				.jpeg()
				.toBuffer();

			const upload = await this.bloomin8Client.uploadImage(jpeg, `${asset.id}.jpg`, {
				showNow: true
			});

			return {
				ok: true,
				data: {
					asset: { id: asset.id, filename: asset.originalFileName },
					device: { width: device.width, height: device.height },
					path: upload.path
				},
				code: 200
			};
		} catch (error) {
			log.error('Error pushing image to Bloomin8 frame:', error);
			return { ok: false, error: 'Failed to push image to Bloomin8 frame', code: 502 };
		}
	}
}
