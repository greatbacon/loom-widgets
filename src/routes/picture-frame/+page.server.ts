import type { PageServerLoad } from './$types';
import { PictureFrameService } from '$lib/system/immich/pictureFrameService.server';

export const load: PageServerLoad = async () => {
	const result = await new PictureFrameService().getDeviceInfo();

	return {
		device: result.ok ? result.data : null,
		deviceError: result.ok ? null : result.error
	};
};
