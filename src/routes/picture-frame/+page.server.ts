import type { PageServerLoad } from './$types';
import { PictureFrameService } from '$lib/system/immich/pictureFrameService.server';

export const load: PageServerLoad = async () => {
	const service = new PictureFrameService();
	const [deviceResult, albumResult] = await Promise.all([
		service.getDeviceInfo(),
		service.getAlbumContents()
	]);

	return {
		device: deviceResult.ok ? deviceResult.data : null,
		deviceError: deviceResult.ok ? null : deviceResult.error,
		album: albumResult.ok ? albumResult.data : null,
		albumError: albumResult.ok ? null : albumResult.error
	};
};
