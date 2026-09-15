import { env } from '$env/dynamic/private';

export interface ImmichAlbumAsset {
	id: string;
	originalFileName: string;
	fileCreatedAt: string;
	type: string;
}

export interface ImmichAlbum {
	id: string;
	albumName: string;
	assets: ImmichAlbumAsset[];
}

export class ImmichClient {
	constructor(
		private readonly baseUrl: string = env.IMMICH_URL!,
		private readonly apiKey: string = env.IMMICH_API_KEY!
	) {}

	async getAlbum(albumId: string): Promise<ImmichAlbum> {
		const response = await fetch(`${this.baseUrl}/api/albums/${albumId}`, {
			headers: { 'x-api-key': this.apiKey, Accept: 'application/json' }
		});

		if (!response.ok) {
			throw new Error(`Immich request failed: ${response.status} ${response.statusText}`);
		}

		return (await response.json()) as ImmichAlbum;
	}

	async getAssetOriginal(assetId: string): Promise<ArrayBuffer> {
		const response = await fetch(`${this.baseUrl}/api/assets/${assetId}/original`, {
			headers: { 'x-api-key': this.apiKey }
		});

		if (!response.ok) {
			throw new Error(`Immich request failed: ${response.status} ${response.statusText}`);
		}

		return response.arrayBuffer();
	}

	async getAssetThumbnail(assetId: string): Promise<{ data: ArrayBuffer; contentType: string }> {
		const response = await fetch(`${this.baseUrl}/api/assets/${assetId}/thumbnail`, {
			headers: { 'x-api-key': this.apiKey }
		});

		if (!response.ok) {
			throw new Error(`Immich request failed: ${response.status} ${response.statusText}`);
		}

		return {
			data: await response.arrayBuffer(),
			contentType: response.headers.get('content-type') ?? 'image/jpeg'
		};
	}
}
