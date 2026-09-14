import { env } from '$env/dynamic/private';
import { ImmichClient } from '$lib/system/immich/immichClient.server';
import type { PictureFrameAlbum, PictureFrameAsset } from '$lib/system/immich/pictureFrame';

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
	constructor(private readonly client: ImmichClient = new ImmichClient()) {}

	async getAlbumContents(
		albumId: string = env.IMMICH_ALBUM_ID!
	): Promise<Result<PictureFrameAlbum> | Error> {
		try {
			const album = await this.client.getAlbum(albumId);
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
}
