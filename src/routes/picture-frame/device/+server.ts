import { error, json } from '@sveltejs/kit';
import { PictureFrameService } from '$lib/system/immich/pictureFrameService.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const result = await new PictureFrameService().getDeviceInfo();

	if (!result.ok) {
		error(result.code, result.error);
	}

	return json(result.data);
};
