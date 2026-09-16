import type { PageServerLoad } from './$types';
import {
	PictureFrameService,
	extractActiveAssetId
} from '$lib/system/immich/pictureFrameService.server';

export const load: PageServerLoad = async () => {
	const service = new PictureFrameService();
	const [deviceResult, albumResult] = await Promise.all([
		service.getDeviceInfo(),
		service.getAlbumContents()
	]);

	// Device and album are fetched independently for latency, then joined here
	// by parsing the frame's reported image filename back to an asset id.
	const activeAssetId = deviceResult.ok ? extractActiveAssetId(deviceResult.data.image) : null;

	return {
		device: deviceResult.ok ? deviceResult.data : null,
		deviceError: deviceResult.ok ? null : deviceResult.error,
		album: albumResult.ok
			? {
					...albumResult.data,
					assets: albumResult.data.assets.map((asset) => ({
						...asset,
						active: asset.id === activeAssetId
					}))
				}
			: null,
		albumError: albumResult.ok ? null : albumResult.error
	};
};
