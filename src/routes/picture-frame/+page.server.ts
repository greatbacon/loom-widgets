import type { PageServerLoad } from './$types';
import { PictureFrameService } from '$lib/system/immich/pictureFrameService.server';

export const load: PageServerLoad = async () => {
	const result = await new PictureFrameService().getAlbumContents();

	return {
		album: result.ok ? result.data : null,
		albumError: result.ok ? null : result.error
	};
};
